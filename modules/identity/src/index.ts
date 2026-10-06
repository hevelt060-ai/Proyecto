import { createHash, randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import type { Collection, Db } from "mongodb";

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DomainError,
  NotFoundError,
  TenantAccessDeniedError,
  ValidationError,
  type TenantId,
  type UserId,
} from "@erp/domain";

export type IdentityId = string;
export type RoleName =
  "platform.super_admin" | "tenant.owner" | "tenant.admin" | "manager" | "employee" | "viewer";
export type Permission = string;
export type TenantScope = "tenant" | "organization" | "company" | "branch" | "warehouse";

export interface User {
  id: UserId;
  email: string;
  name: string;
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
  createdBy?: UserId;
  updatedBy?: UserId;
}

interface UserCredential {
  userId: UserId;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  status: "active" | "disabled";
  createdAt: Date;
}

export interface TenantMembership {
  id: IdentityId;
  tenantId: TenantId;
  userId: UserId;
  roles: RoleName[];
  scopes: TenantScope[];
  status: "active" | "disabled";
  createdAt: Date;
}

export interface Session {
  id: IdentityId;
  userId: UserId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  deviceId?: string;
}

export interface AuditLog {
  id: IdentityId;
  tenantId?: TenantId;
  organizationId?: string;
  userId?: UserId;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: Date;
  requestId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogger {
  record(log: AuditLog): Promise<void>;
}

export interface TenantContext {
  userId: UserId;
  tenantId: TenantId;
  membershipId: IdentityId;
  roles: RoleName[];
  permissions: Permission[];
  scopes: TenantScope[];
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  tenantName?: string | undefined;
  tenantSlug?: string | undefined;
}

export interface IdentityStore {
  createUser(user: User): Promise<void>;
  findUserByEmail(email: string): Promise<User | undefined>;
  findUserById(id: UserId): Promise<User | undefined>;
  createCredential(credential: UserCredential): Promise<void>;
  findCredential(userId: UserId): Promise<UserCredential | undefined>;
  createTenant(tenant: Tenant): Promise<void>;
  findTenantBySlug(slug: string): Promise<Tenant | undefined>;
  findTenantById(id: TenantId): Promise<Tenant | undefined>;
  addMembership(membership: TenantMembership): Promise<void>;
  findMembershipById(id: IdentityId): Promise<TenantMembership | undefined>;
  updateMembership(
    membershipId: IdentityId,
    update: Pick<TenantMembership, "roles" | "scopes" | "status">,
  ): Promise<void>;
  findMembership(userId: UserId, tenantId: TenantId): Promise<TenantMembership | undefined>;
  countUsers(): Promise<number>;
  listMemberships(userId: UserId): Promise<TenantMembership[]>;
  createSession(session: Session): Promise<void>;
  findSession(tokenHash: string): Promise<Session | undefined>;
  revokeSession(sessionId: IdentityId, revokedAt: Date): Promise<void>;
  disableUser(userId: UserId, updatedAt: Date): Promise<void>;
}

const rolePermissions: Record<RoleName, Permission[]> = {
  "platform.super_admin": ["*"],
  "tenant.owner": [
    "identity.user.read",
    "identity.user.create",
    "identity.user.update",
    "identity.user.disable",
    "identity.membership.create",
    "identity.membership.update",
    "organization.read",
    "organization.create",
    "organization.update",
    "organization.branch.read",
    "organization.branch.create",
    "organization.branch.update",
    "organization.warehouse.read",
    "organization.warehouse.create",
    "organization.warehouse.update",
  ],
  "tenant.admin": [
    "identity.user.read",
    "organization.read",
    "organization.create",
    "organization.update",
    "organization.branch.read",
    "organization.branch.create",
    "organization.warehouse.read",
    "organization.warehouse.create",
  ],
  manager: ["organization.read", "organization.branch.read", "organization.warehouse.read"],
  employee: ["organization.read", "organization.branch.read", "organization.warehouse.read"],
  viewer: ["organization.read"],
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export class IdentityService {
  public constructor(
    private readonly store: IdentityStore,
    private readonly sessionTtlMs = 8 * 60 * 60 * 1000,
  ) {}

  public async register(input: RegisterInput): Promise<{
    user: User;
    tenant: Tenant;
    tenantCreated: boolean;
    token: string;
    context: TenantContext;
  }> {
    const email = normalizeEmail(input.email);
    const tenantSlug = input.tenantSlug?.trim().toLowerCase() || "workshop-erp";
    if (
      !email.includes("@") ||
      input.password.length < 12 ||
      input.name.trim().length < 2 ||
      tenantSlug.length < 3
    ) {
      throw new ValidationError("Invalid registration data");
    }
    if ((await this.store.countUsers()) >= 3) {
      throw new DomainError(
        "USER_LIMIT_REACHED",
        "Límite alcanzado: el sistema solo permite un máximo de 3 usuarios administradores.",
      );
    }
    if (await this.store.findUserByEmail(email)) {
      throw new ConflictError("Email already registered");
    }
    const existingTenant = await this.store.findTenantBySlug(tenantSlug);

    const now = new Date();
    const user: User = {
      id: randomUUID() as UserId,
      email,
      name: input.name.trim(),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const tenant: Tenant = existingTenant ?? {
      id: randomUUID() as TenantId,
      name: input.tenantName?.trim() || "Workshop ERP",
      slug: tenantSlug,
      status: "active",
      createdAt: now,
    };
    const membership: TenantMembership = {
      id: randomUUID(),
      tenantId: tenant.id,
      userId: user.id,
      roles: ["tenant.owner"],
      scopes: ["tenant"],
      status: "active",
      createdAt: now,
    };

    await this.store.createUser(user);
    await this.store.createCredential({
      userId: user.id,
      passwordHash: await bcrypt.hash(input.password, 12),
      createdAt: now,
      updatedAt: now,
    });
    if (!existingTenant) await this.store.createTenant(tenant);
    await this.store.addMembership(membership);
    const session = await this.createSession(user.id);
    const context = this.contextFromMembership(membership);
    return { user, tenant, tenantCreated: !existingTenant, token: session.token, context };
  }

  public async login(
    emailInput: string,
    password: string,
    tenantId?: TenantId,
  ): Promise<{ token: string; context: TenantContext; user: User }> {
    const user = await this.store.findUserByEmail(normalizeEmail(emailInput));
    const credential = user ? await this.store.findCredential(user.id) : undefined;
    if (
      !user ||
      !credential ||
      user.status !== "active" ||
      !(await bcrypt.compare(password, credential.passwordHash))
    ) {
      throw new AuthenticationError("Invalid credentials");
    }
    const memberships = await this.store.listMemberships(user.id);
    const membership = tenantId
      ? memberships.find((item) => item.tenantId === tenantId)
      : memberships.length === 1
        ? memberships[0]
        : undefined;
    if (!membership || membership.status !== "active") {
      throw new TenantAccessDeniedError();
    }
    const session = await this.createSession(user.id);
    return { token: session.token, context: this.contextFromMembership(membership), user };
  }

  public async authenticate(token: string, requestedTenantId?: TenantId): Promise<TenantContext> {
    if (!token) throw new AuthenticationError();
    const session = await this.store.findSession(hashToken(token));
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new AuthenticationError();
    const memberships = await this.store.listMemberships(session.userId);
    const membership = requestedTenantId
      ? memberships.find((item) => item.tenantId === requestedTenantId)
      : memberships.length === 1
        ? memberships[0]
        : undefined;
    if (!membership || membership.status !== "active") throw new TenantAccessDeniedError();
    return this.contextFromMembership(membership);
  }

  public async logout(token: string): Promise<void> {
    const session = await this.store.findSession(hashToken(token));
    if (session) await this.store.revokeSession(session.id, new Date());
  }

  public async disableUser(userId: UserId): Promise<void> {
    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundError("User");
    await this.store.disableUser(userId, new Date());
  }

  public async getUser(userId: UserId): Promise<User> {
    const user = await this.store.findUserById(userId);
    if (!user) throw new NotFoundError("User");
    return user;
  }

  public async getTenant(tenantId: TenantId): Promise<Tenant> {
    const tenant = await this.store.findTenantById(tenantId);
    if (!tenant) throw new NotFoundError("Tenant");
    return tenant;
  }

  public authorize(
    context: TenantContext,
    permission: Permission,
    requestedTenantId: TenantId,
  ): void {
    if (context.tenantId !== requestedTenantId) throw new TenantAccessDeniedError();
    if (!context.permissions.includes("*") && !context.permissions.includes(permission))
      throw new AuthorizationError();
  }

  public async createMembership(
    actor: TenantContext,
    userId: UserId,
    tenantId: TenantId,
    roles: RoleName[],
    scopes: TenantScope[],
  ): Promise<TenantMembership> {
    this.authorize(actor, "identity.membership.create", tenantId);
    if (userId === actor.userId || roles.includes("platform.super_admin")) {
      throw new AuthorizationError();
    }
    const membership: TenantMembership = {
      id: randomUUID(),
      tenantId,
      userId,
      roles,
      scopes,
      status: "active",
      createdAt: new Date(),
    };
    await this.store.addMembership(membership);
    return membership;
  }

  public async updateMembership(
    actor: TenantContext,
    membershipId: IdentityId,
    roles: RoleName[],
    scopes: TenantScope[],
    status: TenantMembership["status"],
  ): Promise<TenantMembership> {
    const membership = await this.store.findMembershipById(membershipId);
    if (!membership) throw new NotFoundError("Membership");
    this.authorize(actor, "identity.membership.update", membership.tenantId);
    if (membership.userId === actor.userId || roles.includes("platform.super_admin")) {
      throw new AuthorizationError();
    }
    const update = { roles, scopes, status };
    await this.store.updateMembership(membershipId, update);
    return { ...membership, ...update };
  }

  private contextFromMembership(membership: TenantMembership): TenantContext {
    const permissions = [
      ...new Set(membership.roles.flatMap((role) => rolePermissions[role] ?? [])),
    ];
    return {
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roles: membership.roles,
      permissions,
      scopes: membership.scopes,
    };
  }

  private async createSession(userId: UserId): Promise<{ session: Session; token: string }> {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + this.sessionTtlMs),
      createdAt: now,
    };
    await this.store.createSession(session);
    return { session, token };
  }
}

export class InMemoryIdentityStore implements IdentityStore {
  private readonly users = new Map<UserId, User>();
  private readonly credentials = new Map<UserId, UserCredential>();
  private readonly tenants = new Map<TenantId, Tenant>();
  private readonly memberships = new Map<IdentityId, TenantMembership>();
  private readonly sessions = new Map<IdentityId, Session>();

  public async createUser(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
  public async findUserByEmail(email: string): Promise<User | undefined> {
    return [...this.users.values()].find((user) => user.email === normalizeEmail(email));
  }
  public async findUserById(id: UserId): Promise<User | undefined> {
    return this.users.get(id);
  }
  public async createCredential(credential: UserCredential): Promise<void> {
    this.credentials.set(credential.userId, credential);
  }
  public async findCredential(userId: UserId): Promise<UserCredential | undefined> {
    return this.credentials.get(userId);
  }
  public async createTenant(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant);
  }
  public async findTenantBySlug(slug: string): Promise<Tenant | undefined> {
    return [...this.tenants.values()].find((tenant) => tenant.slug === slug);
  }
  public async findTenantById(id: TenantId): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }
  public async addMembership(membership: TenantMembership): Promise<void> {
    this.memberships.set(membership.id, membership);
  }
  public async findMembershipById(id: IdentityId): Promise<TenantMembership | undefined> {
    return this.memberships.get(id);
  }
  public async updateMembership(
    membershipId: IdentityId,
    update: Pick<TenantMembership, "roles" | "scopes" | "status">,
  ): Promise<void> {
    const membership = this.memberships.get(membershipId);
    if (membership) this.memberships.set(membershipId, { ...membership, ...update });
  }
  public async findMembership(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<TenantMembership | undefined> {
    return [...this.memberships.values()].find(
      (item) => item.userId === userId && item.tenantId === tenantId,
    );
  }
  public async countUsers(): Promise<number> {
    return this.users.size;
  }
  public async listMemberships(userId: UserId): Promise<TenantMembership[]> {
    return [...this.memberships.values()].filter((item) => item.userId === userId);
  }
  public async createSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }
  public async findSession(tokenHash: string): Promise<Session | undefined> {
    return [...this.sessions.values()].find((session) => session.tokenHash === tokenHash);
  }
  public async revokeSession(sessionId: IdentityId, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) this.sessions.set(sessionId, { ...session, revokedAt });
  }
  public async disableUser(userId: UserId, updatedAt: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, status: "disabled", updatedAt });
  }
}

interface MongoIdentityDocument {
  _id: string;
  [key: string]: unknown;
}

export class MongoIdentityStore implements IdentityStore {
  public constructor(private readonly database: Db) {}
  private collection<T extends MongoIdentityDocument>(name: string): Collection<T> {
    return this.database.collection<T>(name);
  }
  public async createUser(user: User): Promise<void> {
    await this.collection("users").insertOne({ ...user, _id: user.id });
  }
  public async findUserByEmail(email: string): Promise<User | undefined> {
    const doc = await this.collection<User & MongoIdentityDocument>("users").findOne({
      email: normalizeEmail(email),
    });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async findUserById(id: UserId): Promise<User | undefined> {
    const doc = await this.collection<User & MongoIdentityDocument>("users").findOne({ _id: id });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async createCredential(credential: UserCredential): Promise<void> {
    await this.collection<UserCredential & MongoIdentityDocument>("credentials").insertOne({
      ...credential,
      _id: credential.userId,
    });
  }
  public async findCredential(userId: UserId): Promise<UserCredential | undefined> {
    const doc = await this.collection<UserCredential & MongoIdentityDocument>(
      "credentials",
    ).findOne({ _id: userId });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async createTenant(tenant: Tenant): Promise<void> {
    await this.collection<Tenant & MongoIdentityDocument>("tenants").insertOne({
      ...tenant,
      _id: tenant.id,
    });
  }
  public async findTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const doc = await this.collection<Tenant & MongoIdentityDocument>("tenants").findOne({ slug });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async findTenantById(id: TenantId): Promise<Tenant | undefined> {
    const doc = await this.collection<Tenant & MongoIdentityDocument>("tenants").findOne({
      _id: id,
    });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async addMembership(membership: TenantMembership): Promise<void> {
    await this.collection<TenantMembership & MongoIdentityDocument>("memberships").insertOne({
      ...membership,
      _id: membership.id,
    });
  }
  public async findMembershipById(id: IdentityId): Promise<TenantMembership | undefined> {
    const doc = await this.collection<TenantMembership & MongoIdentityDocument>(
      "memberships",
    ).findOne({ _id: id });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async updateMembership(
    membershipId: IdentityId,
    update: Pick<TenantMembership, "roles" | "scopes" | "status">,
  ): Promise<void> {
    await this.collection("memberships").updateOne({ _id: membershipId }, { $set: update });
  }
  public async findMembership(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<TenantMembership | undefined> {
    const doc = await this.collection<TenantMembership & MongoIdentityDocument>(
      "memberships",
    ).findOne({ userId, tenantId });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async countUsers(): Promise<number> {
    return this.collection<User & MongoIdentityDocument>("users").countDocuments();
  }
  public async listMemberships(userId: UserId): Promise<TenantMembership[]> {
    return (
      await this.collection<TenantMembership & MongoIdentityDocument>("memberships")
        .find({ userId })
        .toArray()
    ).map((doc) => this.withoutId(doc));
  }
  public async createSession(session: Session): Promise<void> {
    await this.collection<Session & MongoIdentityDocument>("sessions").insertOne({
      ...session,
      _id: session.id,
    });
  }
  public async findSession(tokenHash: string): Promise<Session | undefined> {
    const doc = await this.collection<Session & MongoIdentityDocument>("sessions").findOne({
      tokenHash,
    });
    return doc ? this.withoutId(doc) : undefined;
  }
  public async revokeSession(sessionId: IdentityId, revokedAt: Date): Promise<void> {
    await this.collection("sessions").updateOne({ _id: sessionId }, { $set: { revokedAt } });
  }
  public async disableUser(userId: UserId, updatedAt: Date): Promise<void> {
    await this.collection("users").updateOne(
      { _id: userId },
      { $set: { status: "disabled", updatedAt } },
    );
  }
  private withoutId<T extends object>(document: T & MongoIdentityDocument): T {
    const { _id: _ignored, ...value } = document;
    return value as T;
  }
}

export const requireTenant = (
  context: TenantContext | undefined,
  tenantId: TenantId,
): TenantContext => {
  if (!context || context.tenantId !== tenantId) throw new TenantAccessDeniedError();
  return context;
};

export const assertUser = (user: User | undefined): User => {
  if (!user) throw new NotFoundError("User");
  return user;
};

export class InMemoryAuditLogger implements AuditLogger {
  public readonly entries: AuditLog[] = [];

  public async record(log: AuditLog): Promise<void> {
    this.entries.push(log);
  }
}

export class MongoAuditLogger implements AuditLogger {
  public constructor(private readonly database: Db) {}

  public async record(log: AuditLog): Promise<void> {
    await this.database
      .collection<AuditLog & { _id: string }>("auditLogs")
      .insertOne({ ...log, _id: log.id });
  }
}
