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

  app.disable("x-powered-by");

  // 1. Manejador Global de CORS y Preflight OPTIONS
  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-request-id, x-tenant-id",
    );
    response.setHeader("Access-Control-Max-Age", "86400");

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }
    next();
  });

  // 2. Encabezados de Seguridad
  app.use((_request, response, next) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
    if (config.environment === "production")
      response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  app.use((request, response, next) => {
    const requestId = request.header("x-request-id")?.trim() || randomUUID();
    response.setHeader("x-request-id", requestId);
    (request as RequestContext).requestId = requestId;
    next();
  });

  const authenticated = async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      (request as RequestContext).tenantContext = await identity.authenticate(
        tokenFrom(request),
        request.header("x-tenant-id") as TenantContext["tenantId"] | undefined,
      );
      next();
    } catch (error) {
      next(error);
    }
  };

  const auditRequest = async (
    request: RequestContext,
    action: string,
    resource: string,
    resourceId?: string,
    organizationId?: string,
  ): Promise<void> =>
    audit.record({
      id: randomUUID(),
      ...(request.tenantContext?.tenantId ? { tenantId: request.tenantContext.tenantId } : {}),
      ...(request.tenantContext?.userId ? { userId: request.tenantContext.userId } : {}),
      action,
      resource,
      ...(resourceId ? { resourceId } : {}),
      ...(organizationId ? { organizationId } : {}),
      timestamp: new Date(),
      requestId: request.requestId,
      metadata: {},
      ...(request.ip ? { ip: request.ip } : {}),
      ...(() => {
        const userAgent = request.header("user-agent");
        return userAgent ? { userAgent } : {};
      })(),
    });

  const requirePermission = (request: Request): TenantContext => {
    const context = (request as RequestContext).tenantContext;
    if (!context) throw new AuthenticationError();
    return context;
  };

  // Rutas de Autenticación e Identidad
  app.get(`${config.apiPrefix}/health`, (_request, response) =>
    response.status(200).json({
      success: true,
      data: { status: "ok" },
      requestId: response.getHeader("x-request-id"),
    }),
  );

  app.post(`${config.apiPrefix}/auth/register`, async (request, response, next) => {
    try {
      if (!rateLimiter.check(`register:${request.ip}`))
        throw new DomainError("RATE_LIMITED", "Too many requests");
      const result = await identity.register(registerSchema.parse(request.body));
      await audit.record({
        id: randomUUID(),
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: "user.created",
        resource: "user",
        resourceId: result.user.id,
        timestamp: new Date(),
        requestId: (request as RequestContext).requestId,
        metadata: {},
      });
      await audit.record({
        id: randomUUID(),
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: "tenant.created",
        resource: "tenant",
        resourceId: result.tenant.id,
        timestamp: new Date(),
        requestId: (request as RequestContext).requestId,
        metadata: {},
      });
      response.status(201).json({
        success: true,
        data: {
          user: result.user,
          tenant: result.tenant,
          token: result.token,
          context: result.context,
        },
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(`${config.apiPrefix}/auth/login`, async (request, response, next) => {
    try {
      if (
        !rateLimiter.check(`login:${request.ip}:${String(request.body?.email ?? "").toLowerCase()}`)
      )
        throw new DomainError("RATE_LIMITED", "Too many requests");
      const input = loginSchema.parse(request.body);
      const result = await identity.login(
        input.email,
        input.password,
        input.tenantId as TenantContext["tenantId"] | undefined,
      );
      await audit.record({
        id: randomUUID(),
        tenantId: result.context.tenantId,
        userId: result.user.id,
        action: "login",
        resource: "session",
        timestamp: new Date(),
        requestId: (request as RequestContext).requestId,
        metadata: {},
      });
      response.status(200).json({
        success: true,
        data: { user: result.user, context: result.context, token: result.token },
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      await audit.record({
        id: randomUUID(),
        action: "failed.login",
        resource: "session",
        timestamp: new Date(),
        requestId: (request as RequestContext).requestId,
        metadata: {},
      });
      next(error);
    }
  });

  app.post(`${config.apiPrefix}/auth/logout`, authenticated, async (request, response, next) => {
    try {
      await identity.logout(tokenFrom(request));
      await auditRequest(request as RequestContext, "logout", "session");
      response
        .status(200)
        .json({ success: true, data: {}, requestId: (request as RequestContext).requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${config.apiPrefix}/users`, authenticated, async (request, response, next) => {
    try {
      const context = requirePermission(request);
      const user = await identity.getUser(context.userId);
      response.json({
        success: true,
        data: [user],
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${config.apiPrefix}/users/me`, authenticated, async (request, response, next) => {
    try {
      const context = requirePermission(request);
      const user = await identity.getUser(context.userId);
      response.json({
        success: true,
        data: { user, context },
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(`${config.apiPrefix}/tenants`, authenticated, async (request, response, next) => {
    try {
      const context = requirePermission(request);
      const tenant = await identity.getTenant(context.tenantId);
      response.json({
        success: true,
        data: [tenant],
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(`${config.apiPrefix}/memberships`, authenticated, async (request, response, next) => {
    try {
      const context = requirePermission(request);
      const input = membershipSchema.parse(request.body);
      const value = await identity.createMembership(
        context,
        input.userId as never,
        context.tenantId,
        input.roles as RoleName[],
        input.scopes as TenantScope[],
      );
      await auditRequest(
        request as RequestContext,
        "tenant.membership.created",
        "membership",
        value.id,
      );
      response
        .status(201)
        .json({ success: true, data: value, requestId: (request as RequestContext).requestId });
    } catch (error) {
      next(error);
    }
  });

  app.patch(
    `${config.apiPrefix}/memberships/:membershipId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        const input = membershipUpdateSchema.parse(request.body);
        const membershipId = request.params.membershipId;
        if (typeof membershipId !== "string")
          throw new DomainError("VALIDATION_ERROR", "Invalid membership id");
        const value = await identity.updateMembership(
          context,
          membershipId,
          input.roles as RoleName[],
          input.scopes as TenantScope[],
          input.status,
        );
        await auditRequest(
          request as RequestContext,
          "tenant.membership.updated",
          "membership",
          value.id,
        );
        response.json({
          success: true,
          data: value,
          requestId: (request as RequestContext).requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(`${config.apiPrefix}/organizations`, authenticated, async (request, response, next) => {
    try {
      const context = requirePermission(request);
      identity.authorize(context, "organization.read", context.tenantId);
      response.json({
        success: true,
        data: await organization.listOrganizations(context),
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(`${config.apiPrefix}/organizations`, authenticated, async (request, response, next) => {
    try {
      const context = requirePermission(request);
      identity.authorize(context, "organization.create", context.tenantId);
      const value = await organization.createOrganization(
        context,
        nameSchema.parse(request.body).name,
      );
      await auditRequest(
        request as RequestContext,
        "organization.created",
        "organization",
        value.id,
      );
      response
        .status(201)
        .json({ success: true, data: value, requestId: (request as RequestContext).requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get(
    `${config.apiPrefix}/companies/:organizationId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.read", context.tenantId);
        response.json({
          success: true,
          data: await organization.listCompanies(context, request.params.organizationId as never),
          requestId: (request as RequestContext).requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    `${config.apiPrefix}/companies/:organizationId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.create", context.tenantId);
        const value = await organization.createCompany(
          context,
          request.params.organizationId as never,
          nameSchema.parse(request.body).name,
        );
        const organizationId = request.params.organizationId;
        if (typeof organizationId !== "string")
          throw new DomainError("VALIDATION_ERROR", "Invalid organization id");
        await auditRequest(
          request as RequestContext,
          "company.created",
          "company",
          value.id,
          organizationId,
        );
        response
          .status(201)
          .json({ success: true, data: value, requestId: (request as RequestContext).requestId });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    `${config.apiPrefix}/branches/:companyId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.branch.read", context.tenantId);
        response.json({
          success: true,
          data: await organization.listBranches(context, request.params.companyId as never),
          requestId: (request as RequestContext).requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    `${config.apiPrefix}/branches/:companyId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.branch.create", context.tenantId);
        const value = await organization.createBranch(
          context,
          request.params.companyId as never,
          nameSchema.parse(request.body).name,
        );
        await auditRequest(request as RequestContext, "branch.created", "branch", value.id);
        response
          .status(201)
          .json({ success: true, data: value, requestId: (request as RequestContext).requestId });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    `${config.apiPrefix}/warehouses/:branchId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.warehouse.read", context.tenantId);
        response.json({
          success: true,
          data: await organization.listWarehouses(context, request.params.branchId as never),
          requestId: (request as RequestContext).requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    `${config.apiPrefix}/warehouses/:branchId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.warehouse.create", context.tenantId);
        const value = await organization.createWarehouse(
          context,
          request.params.branchId as never,
          nameSchema.parse(request.body).name,
        );
        await auditRequest(request as RequestContext, "warehouse.created", "warehouse", value.id);
        response
          .status(201)
          .json({ success: true, data: value, requestId: (request as RequestContext).requestId });
      } catch (error) {
        next(error);
      }
    },
  );

  const requireWorkOrderId = (request: Request): string => {
    const orderId = request.params.orderId;
    if (typeof orderId !== "string" || orderId.length === 0)
      throw new DomainError("VALIDATION_ERROR", "Invalid work order id");
    return orderId;
  };

  // Handlers del módulo de taller
  const getWorkOrdersHandler = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const context = requirePermission(request);
      identity.authorize(context, "organization.read", context.tenantId);
      const orders = await getDatabase()
        .collection<WorkOrder>("work_orders")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      response.json({
        success: true,
        data: orders,
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  };

  const createWorkOrderHandler = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const context = requirePermission(request);
      identity.authorize(context, "organization.read", context.tenantId);
      const input = createWorkOrderSchema.parse(request.body);
      const db = getDatabase();
      const now = new Date();
      const equipmentId = randomUUID();
      const orderId = randomUUID();
      const year = now.getFullYear();
      const sequence = (await db.collection("work_orders").countDocuments()) + 1;
      const folio = `OT-${year}-${String(sequence).padStart(5, "0")}`;
      const equipment: Equipment = {
        id: equipmentId,
        serialNumber: input.equipment.serialNumber,
        brand: input.equipment.brand,
        model: input.equipment.model,
        category: input.equipment.category,
        customerId: input.equipment.customerId,
        createdAt: now,
      };
      const { odometerKm, ...intakeChecklist } = input.intakeChecklist;
      const order: WorkOrder = {
        id: orderId,
        folio,
        equipmentId,
        customerId: input.equipment.customerId,
        status: "RECEIVED",
        intakeChecklist: {
          ...intakeChecklist,
          ...(odometerKm === undefined ? {} : { odometerKm }),
        },
        parts: [],
        laborCost: input.laborCost,
        totalCost: input.laborCost,
        statusHistory: [],
        createdAt: now,
        updatedAt: now,
      };
      await db.collection<Equipment>("equipment").insertOne(equipment);
      await db.collection<WorkOrder>("work_orders").insertOne(order);
      await auditRequest(
        request as RequestContext,
        "workshop.work_order.created",
        "work_order",
        orderId,
      );
      response.status(201).json({
        success: true,
        data: order,
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  };

  const transitionStatusHandler = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const context = requirePermission(request);
      identity.authorize(context, "organization.read", context.tenantId);
      const orderId = requireWorkOrderId(request);
      const input = transitionStatusSchema.parse(request.body);
      await WorkshopDomainService.transitionWorkOrderStatus(
        orderId,
        input.status as WorkOrderStatus,
        context.userId,
        input.notes,
      );
      const order = await getDatabase()
        .collection<WorkOrder>("work_orders")
        .findOne({ id: orderId });
      await auditRequest(
        request as RequestContext,
        "workshop.work_order.status.changed",
        "work_order",
        orderId,
      );
      response.json({
        success: true,
        data: order,
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  };

  const getInventoryHandler = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const context = requirePermission(request);
      identity.authorize(context, "organization.read", context.tenantId);
      const items = await getDatabase().collection("inventory").find({}).toArray();
      response.json({
        success: true,
        data: items,
        requestId: (request as RequestContext).requestId,
      });
    } catch (error) {
      next(error);
    }
  };

  // Endpoints homologados con apps/web
  app.get(`${config.apiPrefix}/work-orders`, authenticated, getWorkOrdersHandler);
  app.get(`${config.apiPrefix}/workshop/work-orders`, authenticated, getWorkOrdersHandler);

  app.post(`${config.apiPrefix}/work-orders`, authenticated, createWorkOrderHandler);
  app.post(`${config.apiPrefix}/workshop/work-orders`, authenticated, createWorkOrderHandler);

  app.patch(
    `${config.apiPrefix}/work-orders/:orderId/status`,
    authenticated,
    transitionStatusHandler,
  );
  app.patch(
    `${config.apiPrefix}/workshop/work-orders/:orderId/status`,
    authenticated,
    transitionStatusHandler,
  );

  app.get(`${config.apiPrefix}/inventory`, authenticated, getInventoryHandler);
  app.get(`${config.apiPrefix}/workshop/inventory`, authenticated, getInventoryHandler);

  app.get(
    `${config.apiPrefix}/workshop/work-orders/:orderId`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.read", context.tenantId);
        const order = await getDatabase()
          .collection<WorkOrder>("work_orders")
          .findOne({ id: requireWorkOrderId(request) });
        if (!order) throw new DomainError("NOT_FOUND", "Work order not found");
        response.json({
          success: true,
          data: order,
          requestId: (request as RequestContext).requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    `${config.apiPrefix}/workshop/work-orders/:orderId/parts`,
    authenticated,
    async (request, response, next) => {
      try {
        const context = requirePermission(request);
        identity.authorize(context, "organization.read", context.tenantId);
        const orderId = requireWorkOrderId(request);
        const input = addPartSchema.parse(request.body);
        await WorkshopDomainService.reservePartForOrder(orderId, input.sku, input.quantity);
        const order = await getDatabase()
          .collection<WorkOrder>("work_orders")
          .findOne({ id: orderId });
        await auditRequest(
          request as RequestContext,
          "workshop.part.reserved",
          "work_order",
          orderId,
        );
        response.json({
          success: true,
          data: order,
          requestId: (request as RequestContext).requestId,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Manejo de Excepciones y Rutas no Encontradas
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const mapped = publicError(error);
    if (mapped.status >= 500)
      console.error(
        JSON.stringify({ requestId: (request as RequestContext).requestId, code: mapped.code }),
      );
    response.status(mapped.status).json({
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(Object.keys(mapped.details).length ? { details: mapped.details } : {}),
      },
      requestId: (request as RequestContext).requestId,
    });
  });

  app.use((request: Request, response: Response) => {
    response.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
      requestId: (request as RequestContext).requestId,
    });
  });

  return app;
};

export const start = async (): Promise<void> => {
  const config = loadConfig();
  let app: ReturnType<typeof createApp>;
  if (config.useMongoDb) {
    const database = await connectDatabase(config.mongoUri, config.mongoDatabase);
    await ensureIndexes(database);
    const { MongoIdentityStore } = await import("@erp/identity");
    const { MongoOrganizationStore } = await import("@erp/organization");
    app = createApp({
      identity: new IdentityService(new MongoIdentityStore(database)),
      organization: new OrganizationService(new MongoOrganizationStore(database)),
      config,
    });
  } else app = createApp({ config });
  app.listen(config.port, () => console.log(`ERP API listening on port ${config.port}`));
};

if (process.env.NODE_ENV !== "test") void start();
