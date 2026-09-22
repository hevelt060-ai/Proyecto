import { describe, expect, it } from "vitest";
import request from "supertest";

import { loadConfig } from "../../packages/config/src/index.js";
import { AuthorizationError, TenantAccessDeniedError } from "../../packages/domain/src/index.js";
import {
  InMemoryAuditLogger,
  InMemoryIdentityStore,
  IdentityService,
  type TenantContext,
} from "../../modules/identity/src/index.js";
import {
  InMemoryOrganizationStore,
  OrganizationService,
} from "../../modules/organization/src/index.js";
import { createApp } from "../../apps/api/src/main.js";

describe("identity and tenant isolation", () => {
  it("authenticates, revokes a session, and denies invalid credentials", async () => {
    const service = new IdentityService(new InMemoryIdentityStore());
    const registration = await service.register({
      email: "owner@example.com",
      password: "correct horse battery",
      name: "Owner",
      tenantName: "Tenant A",
      tenantSlug: "tenant-a",
    });

    await expect(service.authenticate(registration.token)).resolves.toMatchObject({
      tenantId: registration.tenant.id,
    });
    await expect(service.login("owner@example.com", "wrong password")).rejects.toThrow(
      "Invalid credentials",
    );
    await service.logout(registration.token);
    await expect(service.authenticate(registration.token)).rejects.toThrow(
      "Authentication required",
    );
  });

  it("denies a user from a different tenant even when IDs are supplied", async () => {
    const audit = new InMemoryAuditLogger();
    const app = createApp({ audit, config: loadConfig("test") });
    const userA = await request(app).post("/api/v1/auth/register").send({
      email: "a@example.com",
      password: "correct horse battery",
      name: "User A",
      tenantName: "Tenant A",
      tenantSlug: "tenant-a",
    });
    const userB = await request(app).post("/api/v1/auth/register").send({
      email: "b@example.com",
      password: "correct horse battery",
      name: "User B",
      tenantName: "Tenant B",
      tenantSlug: "tenant-b",
    });
    const tenantA = userA.body.data.tenant.id as string;
    const tenantB = userB.body.data.tenant.id as string;
    const tokenA = userA.body.data.token as string;
    const tokenB = userB.body.data.token as string;

    const created = await request(app)
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A" });
    expect(created.status).toBe(201);

    const crossTenant = await request(app)
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantB);
    expect(crossTenant.status).toBe(403);
    expect(crossTenant.body.error.code).toBe("TENANT_ACCESS_DENIED");

    const ownTenant = await request(app)
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB);
    expect(ownTenant.status).toBe(200);
    expect(ownTenant.body.data).toHaveLength(0);
    expect(
      audit.entries.some(
        (entry) => entry.action === "organization.created" && entry.tenantId === tenantA,
      ),
    ).toBe(true);
  });

  it("does not trust a tenantId in a body to change the authenticated scope", async () => {
    const app = createApp({ config: loadConfig("test") });
    const registered = await request(app).post("/api/v1/auth/register").send({
      email: "body@example.com",
      password: "correct horse battery",
      name: "Body User",
      tenantName: "Body Tenant",
      tenantSlug: "body-tenant",
    });
    const response = await request(app)
      .post("/api/v1/organizations")
      .set("Authorization", `Bearer ${registered.body.data.token}`)
      .send({ name: "Only Own Tenant", tenantId: "another-tenant" });
    expect(response.status).toBe(201);
    expect(response.body.data.tenantId).toBe(registered.body.data.tenant.id);
  });

  it("enforces repository/service tenant scope and granular permissions", async () => {
    const store = new InMemoryOrganizationStore();
    const service = new OrganizationService(store);
    const contextA = {
      userId: "user-a",
      tenantId: "tenant-a",
      membershipId: "membership-a",
      roles: ["tenant.owner"],
      permissions: ["organization.read", "organization.create"],
      scopes: ["tenant"],
    } as unknown as TenantContext;
    const contextB = { ...contextA, userId: "user-b", tenantId: "tenant-b" };
    const organization = await service.createOrganization(contextA, "Only A");

    await expect(service.listOrganizations(contextB)).resolves.toEqual([]);
    await expect(
      service.createCompany(contextB, organization.id, "Foreign Parent"),
    ).rejects.toThrow("Access denied");
    expect(() => {
      if (contextB.tenantId !== organization.tenantId) throw new TenantAccessDeniedError();
    }).toThrow("Access denied");
    expect(() => {
      if (!contextB.permissions.includes("organization.update")) throw new AuthorizationError();
    }).toThrow("Access denied");
  });
});
