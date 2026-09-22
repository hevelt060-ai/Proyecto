# MongoDB integration testing

## Decision

Phase 1.1 uses a local MongoDB replica set, not production Atlas and not an in-memory substitute. The running test instance was verified with the MongoDB `hello` command as `setName: rs0` and `isWritablePrimary: true`.

The suite creates a unique database per process using `erp_phase_1_1_<pid>_<uuid>`, runs real driver operations, and drops that database in `afterAll`. It does not use production credentials or production database names.

## Why local replica set

- It is available in the development environment.
- It supports the MongoDB session/transaction topology required by future transactional slices.
- It makes tenant query behavior and indexes observable in CI/local integration runs.
- It avoids external Atlas credentials and network dependence in tests.

CI must provide an equivalent ephemeral replica set before enabling the integration suite as a required pipeline gate.

## Covered collections

`users`, `credentials`, `sessions`, `tenants`, `memberships`, `organizations`, `companies`, `branches`, `warehouses` and `auditLogs`.

## Isolation rules

Tests use Tenant A and Tenant B with separate users and hierarchy. Every repository method that touches organization data requires `TenantContext`; Mongo filters include `tenantId`, and parent lookups include both parent ID and tenant ID. A foreign parent ID produces `TENANT_ACCESS_DENIED`.

## Running

```bash
npx vitest run tests/integration/mongodb-identity-organization.test.ts
```

The test must fail when MongoDB is unavailable. It must not silently fall back to the in-memory adapter.
