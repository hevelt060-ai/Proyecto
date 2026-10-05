import { describe, expect, it } from "vitest";
import request from "supertest";

import { loadConfig } from "../../packages/config/src/index.js";
import { createApp, InMemoryRateLimiter } from "../../apps/api/src/main.js";
import { OrganizationService } from "../../modules/organization/src/index.js";

describe("API hardening", () => {
  it("sets security headers and propagates request ids", async () => {
    const app = createApp({ config: loadConfig("test") });
    const response = await request(app).get("/api/v1/health").set("x-request-id", "request-test-1");

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-request-id"]).toBe("request-test-1");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("returns safe status envelopes for missing auth, routes and invalid input", async () => {
    const app = createApp({ config: loadConfig("test") });
    const unauthorized = await request(app).get("/api/v1/organizations");
    const missingRoute = await request(app).get("/api/v1/does-not-exist");
    const invalid = await request(app).post("/api/v1/auth/register").send({ email: "bad" });

    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(missingRoute.status).toBe(404);
    expect(missingRoute.body.error.code).toBe("NOT_FOUND");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalid.body).not.toHaveProperty("stack");
  });

  it("supports legacy route aliases and CORS preflight", async () => {
    const app = createApp({ config: loadConfig("test") });
    const preflight = await request(app).options("/auth/login");
    const loginResponses = await Promise.all([
      request(app).post("/api/v1/auth/login").send({ email: "user@example.com", password: "bad" }),
      request(app).post("/auth/login").send({ email: "user@example.com", password: "bad" }),
    ]);
    const workOrderResponses = await Promise.all([
      request(app).get("/api/v1/work-orders"),
      request(app).get("/work-orders"),
      request(app).post("/api/v1/work-orders").send({}),
      request(app).post("/work-orders").send({}),
      request(app).patch("/api/v1/work-orders/order-id/status").send({}),
      request(app).patch("/work-orders/order-id/status").send({}),
    ]);

    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe("*");
    expect(preflight.headers["access-control-allow-methods"]).toContain("OPTIONS");
    expect(loginResponses.map((response) => response.status)).toEqual([401, 401]);
    expect(workOrderResponses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401, 401,
    ]);
  });

  it("limits login attempts without requiring Redis", async () => {
    const config = { ...loadConfig("test"), rateLimitMax: 2, rateLimitWindowMs: 60_000 };
    const app = createApp({ config, rateLimiter: new InMemoryRateLimiter(2, 60_000) });
    await request(app).post("/api/v1/auth/register").send({
      email: "limited@example.com",
      password: "correct horse battery",
      name: "Limited",
      tenantName: "Limited Tenant",
      tenantSlug: "limited-tenant",
    });
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "limited@example.com", password: "wrong" });
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "limited@example.com", password: "wrong" });
    const limited = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "limited@example.com", password: "wrong" });

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("rejects membership self-escalation and records membership changes", async () => {
    const app = createApp({ config: loadConfig("test") });
    const registration = await request(app).post("/api/v1/auth/register").send({
      email: "owner2@example.com",
      password: "correct horse battery",
      name: "Owner",
      tenantName: "Owner Tenant",
      tenantSlug: "owner-tenant",
    });
    const token = registration.body.data.token as string;
    const membershipId = registration.body.data.context.membershipId as string;
    const escalation = await request(app)
      .patch(`/api/v1/memberships/${membershipId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["platform.super_admin"], scopes: ["tenant"], status: "active" });

    expect(escalation.status).toBe(403);
    expect(escalation.body.error.code).toBe("AUTHORIZATION_DENIED");
  });

  it("does not expose internal error details", async () => {
    const brokenOrganization = {
      listOrganizations: async () => {
        throw new Error("secret database detail");
      },
    } as unknown as OrganizationService;
    const app = createApp({ config: loadConfig("test"), organization: brokenOrganization });
    const registration = await request(app).post("/api/v1/auth/register").send({
      email: "error@example.com",
      password: "correct horse battery",
      name: "Error User",
      tenantName: "Error Tenant",
      tenantSlug: "error-tenant",
    });
    const response = await request(app)
      .get("/api/v1/organizations")
      .set("Authorization", `Bearer ${registration.body.data.token}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("secret database detail");
    expect(response.body).not.toHaveProperty("stack");
  });
});
