# Multi-tenancy

## Scope model

```text
Tenant -> Organization -> Company -> Branch -> Warehouse
```

A user can have memberships in multiple tenants. Each membership owns its role set. The current implementation registers one owner membership per new tenant and verifies membership during authentication.

## Enforcement

- Tenant context is created from the authenticated session and membership.
- Repository methods for organization resources receive `TenantContext`.
- MongoDB reads include `tenantId` in every organization filter.
- In-memory repositories apply the same tenant predicate for tests.
- A missing or mismatched tenant context raises `TENANT_ACCESS_DENIED`.
- Client-provided body IDs cannot change the authenticated tenant.

## Required future controls

Add tenant-scoped update/delete repositories, branch/warehouse scope authorization, membership administration and integration tests against a MongoDB replica set before production data is accepted.
