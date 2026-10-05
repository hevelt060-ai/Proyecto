import { randomUUID } from "node:crypto";

import express, { type NextFunction, type Request, type Response } from "express";
import { z, ZodError } from "zod";

import { loadConfig, type AppConfig } from "@erp/config";
import { WorkshopDomainService, connectDatabase, ensureIndexes, getDatabase } from "@erp/database";
import {
  AuthenticationError,
  AuthorizationError,
  DomainError,
  TenantAccessDeniedError,
  type Equipment,
  type WorkOrder,
  type WorkOrderStatus,
} from "@erp/domain";
import {
  InMemoryAuditLogger,
  InMemoryIdentityStore,
  IdentityService,
  type RoleName,
  type TenantScope,
  type TenantContext,
} from "@erp/identity";
import { InMemoryOrganizationStore, OrganizationService } from "@erp/organization";

interface RequestContext extends Request {
  requestId: string;
  tenantContext?: TenantContext;
}

export interface ApiDependencies {
  config?: AppConfig;
  identity?: IdentityService;
  organization?: OrganizationService;
  audit?: InMemoryAuditLogger;
  rateLimiter?: RateLimiter;
}

export interface RateLimiter {
  check(key: string): boolean;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  public constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  public check(key: string): boolean {
    const now = Date.now();
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= this.maxAttempts;
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(2).max(120),
  tenantName: z.string().min(2).max(120),
  tenantSlug: z.string().regex(/^[a-z0-9-]{3,64}$/),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().optional(),
});

const nameSchema = z.object({ name: z.string().min(2).max(120) });

const membershipSchema = z.object({
  userId: z.string().min(1),
  roles: z
    .array(
      z.enum([
        "platform.super_admin",
        "tenant.owner",
        "tenant.admin",
        "manager",
        "employee",
        "viewer",
      ]),
    )
    .min(1),
  scopes: z.array(z.enum(["tenant", "organization", "company", "branch", "warehouse"])).min(1),
});

const membershipUpdateSchema = membershipSchema
  .omit({ userId: true })
  .extend({ status: z.enum(["active", "disabled"]) });

const createWorkOrderSchema = z.object({
  equipment: z.object({
    serialNumber: z.string().min(3),
    brand: z.string().min(2),
    model: z.string().min(2),
    category: z.enum(["MTB", "ROAD", "GRAVEL", "E_BIKE", "SUSPENSION"]),
    customerId: z.string().min(1),
  }),
  intakeChecklist: z.object({
    damagesReported: z.array(z.string()).default([]),
    odometerKm: z.number().optional(),
    suspensionLockWorking: z.boolean().default(true),
    initialCleanliness: z.enum(["CLEAN", "DIRTY", "MUDDY"]).default("DIRTY"),
  }),
  laborCost: z.number().nonnegative().default(0),
});

const addPartSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

const transitionStatusSchema = z.object({
  status: z.enum([
    "RECEIVED",
    "IN_DIAGNOSIS",
    "WAITING_PARTS",
    "IN_PROGRESS",
    "QUALITY_CHECK",
    "READY_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]),
  notes: z.string().max(500).optional(),
});

const tokenFrom = (request: Request): string => {
  const value = request.header("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : "";
};

const publicError = (
  error: unknown,
): { status: number; code: string; message: string; details: Record<string, unknown> } => {
  if (error instanceof ZodError)
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      details: { issues: error.issues.map((issue) => issue.path.join(".")) },
    };
  if (error instanceof AuthenticationError)
    return { status: 401, code: error.code, message: error.message, details: {} };
  if (error instanceof TenantAccessDeniedError || error instanceof AuthorizationError)
    return { status: 403, code: error.code, message: error.message, details: {} };
  if (error instanceof DomainError)
    return {
      status:
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "CONFLICT"
            ? 409
            : error.code === "RATE_LIMITED"
              ? 429
              : 400,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    details: {},
  };
};

export const createApp = (dependencies: ApiDependencies = {}) => {
  const config = dependencies.config ?? loadConfig();
  const identity = dependencies.identity ?? new IdentityService(new InMemoryIdentityStore());
  const organization =
    dependencies.organization ?? new OrganizationService(new InMemoryOrganizationStore());
  const audit = dependencies.audit ?? new InMemoryAuditLogger();
  const rateLimiter =
    dependencies.rateLimiter ??
    new InMemoryRateLimiter(config.rateLimitMax, config.rateLimitWindowMs);
  const app = express();