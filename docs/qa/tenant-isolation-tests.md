# Tenant isolation tests

The implemented security suite creates Tenant A/User A and Tenant B/User B and verifies:

- User A can create and read organization data in Tenant A.
- User A cannot select Tenant B with `x-tenant-id`.
- User B can access Tenant B and cannot see Tenant A data.
- A body `tenantId` does not alter server-side scope.
- In-memory organization repository filters reads by `TenantContext`.
- A mismatched tenant raises `TENANT_ACCESS_DENIED`.
- Missing permissions raise an authorization error.

The same matrix must be repeated against MongoDB repositories before release. The test must include known foreign organization, company, branch and warehouse IDs and must verify no data is returned or mutated.
