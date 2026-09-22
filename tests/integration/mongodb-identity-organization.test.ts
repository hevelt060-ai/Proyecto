import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MongoDatabaseConnection } from "../../packages/database/src/index.js";
import {
  InMemoryAuditLogger,
  IdentityService,
  MongoAuditLogger,
  MongoIdentityStore,
  type TenantContext,
} from "../../modules/identity/src/index.js";
import {
  MongoOrganizationStore,
  OrganizationService,
} from "../../modules/organization/src/index.js";

const databaseName = `erp_phase_1_1_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const connection = new MongoDatabaseConnection(
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/?directConnection=true",
  databaseName,
);
let identity: IdentityService;
let organizationStore: MongoOrganizationStore;
let organization: OrganizationService;
let audit: MongoAuditLogger;
let userA: Awaited<ReturnType<IdentityService["register"]>>;
let userB: Awaited<ReturnType<IdentityService["register"]>>;

beforeAll(async () => {
  const database = await connection.connect();
  const identityStore = new MongoIdentityStore(database);
  organizationStore = new MongoOrganizationStore(database);
  identity = new IdentityService(identityStore);
  organization = new OrganizationService(organizationStore);
  audit = new MongoAuditLogger(database);
  userA = await identity.register({
    email: "mongo-a@example.com",
    password: "correct horse battery",
    name: "Mongo A",
    tenantName: "Mongo Tenant A",
    tenantSlug: `mongo-a-${process.pid}`,
  });
  userB = await identity.register({
    email: "mongo-b@example.com",
    password: "correct horse battery",
    name: "Mongo B",
    tenantName: "Mongo Tenant B",
    tenantSlug: `mongo-b-${process.pid}`,
  });
});

afterAll(async () => {
  const database = await connection.connect();
  await database.dropDatabase();
  await connection.disconnect();
});

describe("MongoDB identity and organization integration", () => {
  it("persists users, credentials, sessions, tenants and memberships", async () => {
    await expect(identity.authenticate(userA.token)).resolves.toMatchObject({
      tenantId: userA.tenant.id,
    });
    await expect(identity.authenticate(userA.token, userB.tenant.id)).rejects.toThrow(
      "Access denied",
    );
    await expect(identity.login("mongo-a@example.com", "wrong password")).rejects.toThrow(
      "Invalid credentials",
    );

    const user = await identity.getUser(userA.user.id);
    const tenant = await identity.getTenant(userA.tenant.id);
    expect(user.email).toBe("mongo-a@example.com");
    expect(tenant.slug).toContain("mongo-a");
  });

  it("creates the full tenant hierarchy and prevents cross-tenant parent access", async () => {
    const organizationA = await organization.createOrganization(userA.context, "Organization A");
    const organizationB = await organization.createOrganization(userB.context, "Organization B");
    const companyA = await organization.createCompany(userA.context, organizationA.id, "Company A");
    const companyB = await organization.createCompany(userB.context, organizationB.id, "Company B");
    const branchA = await organization.createBranch(userA.context, companyA.id, "Branch A");
    const branchB = await organization.createBranch(userB.context, companyB.id, "Branch B");
    const warehouseA = await organization.createWarehouse(userA.context, branchA.id, "Warehouse A");
    const warehouseB = await organization.createWarehouse(userB.context, branchB.id, "Warehouse B");

    expect(await organization.listOrganizations(userA.context)).toHaveLength(1);
    expect(await organization.listOrganizations(userB.context)).toHaveLength(1);
    expect(await organization.listCompanies(userA.context, companyB.id as never)).toHaveLength(0);
    await expect(
      organizationStore.createBranch(userA.context, {
        ...branchA,
        id: randomUUID() as never,
        companyId: companyB.id,
        tenantId: userA.tenant.id,
      }),
    ).rejects.toThrow("Access denied");
    await expect(
      organizationStore.createWarehouse(userA.context, {
        ...warehouseA,
        id: randomUUID() as never,
        branchId: branchB.id,
        tenantId: userA.tenant.id,
      }),
    ).rejects.toThrow("Access denied");

    await organizationStore.updateOrganization(
      userA.context,
      organizationA.id,
      "Organization A Updated",
    );
    expect((await organization.listOrganizations(userA.context))[0]?.name).toBe(
      "Organization A Updated",
    );
    await expect(
      organizationStore.updateOrganization(userA.context, organizationB.id, "Hijacked"),
    ).rejects.toThrow("Access denied");
    await expect(
      organizationStore.disableOrganization(userA.context, organizationB.id),
    ).rejects.toThrow("Access denied");
    expect(warehouseA.tenantId).toBe(userA.tenant.id);
    expect(warehouseB.tenantId).toBe(userB.tenant.id);
  });

  it("updates memberships through authorization and persists audit logs", async () => {
    const member = await identity.register({
      email: "mongo-member@example.com",
      password: "correct horse battery",
      name: "Mongo Member",
      tenantName: "Mongo Tenant C",
      tenantSlug: `mongo-c-${process.pid}`,
    });
    const membership = await identity.createMembership(
      userA.context,
      member.user.id,
      userA.tenant.id,
      ["viewer"],
      ["tenant"],
    );
    const updated = await identity.updateMembership(
      userA.context,
      membership.id,
      ["employee"],
      ["organization"],
      "active",
    );
    expect(updated.roles).toEqual(["employee"]);
    expect(updated.scopes).toEqual(["organization"]);
    await expect(
      identity.updateMembership(
        userA.context,
        userA.context.membershipId,
        ["platform.super_admin"],
        ["tenant"],
        "active",
      ),
    ).rejects.toThrow("Access denied");

    await audit.record({
      id: randomUUID(),
      tenantId: userA.tenant.id,
      userId: userA.user.id,
      action: "membership.updated",
      resource: "membership",
      resourceId: membership.id,
      timestamp: new Date(),
      requestId: "mongo-request",
      metadata: { test: true },
    });
    const database = await connection.connect();
    const log = await database.collection("auditLogs").findOne({ requestId: "mongo-request" });
    expect(log?.tenantId).toBe(userA.tenant.id);
    expect(log?.metadata).toEqual({ test: true });
  });

  it("disables users, revokes sessions and leaves no raw credential or token", async () => {
    await identity.disableUser(userB.user.id);
    await expect(identity.login("mongo-b@example.com", "correct horse battery")).rejects.toThrow(
      "Invalid credentials",
    );
    await identity.logout(userA.token);
    await expect(identity.authenticate(userA.token)).rejects.toThrow("Authentication required");
    const database = await connection.connect();
    const credential = await database.collection("credentials").findOne({ _id: userA.user.id });
    const session = await database.collection("sessions").findOne({ userId: userA.user.id });
    expect(credential?.passwordHash).toBeDefined();
    expect(credential?.password).toBeUndefined();
    expect(session?.token).toBeUndefined();
  });

  it("keeps concurrent sessions and membership updates atomic", async () => {
    const sessions = await Promise.all([
      identity.login("mongo-a@example.com", "correct horse battery", userA.tenant.id),
      identity.login("mongo-a@example.com", "correct horse battery", userA.tenant.id),
    ]);
    expect(sessions[0]?.token).not.toBe(sessions[1]?.token);
    await expect(identity.authenticate(sessions[0]?.token ?? "")).resolves.toMatchObject({
      tenantId: userA.tenant.id,
    });
    await expect(identity.authenticate(sessions[1]?.token ?? "")).resolves.toMatchObject({
      tenantId: userA.tenant.id,
    });

    const member = await identity.register({
      email: "mongo-concurrent@example.com",
      password: "correct horse battery",
      name: "Concurrent",
      tenantName: "Mongo Tenant D",
      tenantSlug: `mongo-d-${process.pid}`,
    });
    const membership = await identity.createMembership(
      userA.context,
      member.user.id,
      userA.tenant.id,
      ["viewer"],
      ["tenant"],
    );
    await Promise.all([
      identity.updateMembership(
        userA.context,
        membership.id,
        ["employee"],
        ["organization"],
        "active",
      ),
      identity.updateMembership(userA.context, membership.id, ["manager"], ["branch"], "active"),
    ]);
    const database = await connection.connect();
    const stored = await database.collection("memberships").findOne({ _id: membership.id });
    expect([
      ["employee", "organization"],
      ["manager", "branch"],
    ]).toContainEqual([stored?.roles?.[0], stored?.scopes?.[0]]);
  });

  it("creates and verifies the documented indexes", async () => {
    const database = await connection.connect();
    const indexNames = new Set(
      (await database.collection("sessions").listIndexes().toArray()).map((index) => index.name),
    );
    expect([...indexNames]).toEqual(
      expect.arrayContaining(["sessions_token_hash_unique", "sessions_expiry"]),
    );
    const membershipIndexes = await database.collection("memberships").listIndexes().toArray();
    expect(
      membershipIndexes.some(
        (index) => index.name === "memberships_tenant_user_unique" && index.unique,
      ),
    ).toBe(true);
  });
});
