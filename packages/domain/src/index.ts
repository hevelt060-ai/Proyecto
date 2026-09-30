export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export interface TenantScoped {
  tenantId: TenantId;
}

export interface DomainEvent<TPayload = unknown> {
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export class DomainError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  public constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  public constructor(message: string, details: Record<string, unknown> = {}) {
    super("VALIDATION_ERROR", message, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends DomainError {
  public constructor(message = "Authentication required") {
    super("AUTHENTICATION_REQUIRED", message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends DomainError {
  public constructor(message = "Access denied") {
    super("AUTHORIZATION_DENIED", message);
    this.name = "AuthorizationError";
  }
}

export class TenantAccessDeniedError extends DomainError {
  public constructor() {
    super("TENANT_ACCESS_DENIED", "Access denied");
    this.name = "TenantAccessDeniedError";
  }
}

export class NotFoundError extends DomainError {
  public constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  public constructor(message: string) {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}

export * from "./workshop.js";
