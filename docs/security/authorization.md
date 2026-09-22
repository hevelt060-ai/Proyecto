# Authorization

Authorization is evaluated after authentication and tenant membership resolution:

```text
Authentication -> Tenant membership -> Permission -> Use case
```

Initial configurable roles are:

- `platform.super_admin`
- `tenant.owner`
- `tenant.admin`
- `manager`
- `employee`
- `viewer`

Permissions are granular, for example `organization.read`, `organization.create`, `organization.branch.read` and `organization.warehouse.create`. A permission is denied by default unless the membership role grants it. `platform.super_admin` is represented as a wildcard permission and must be constrained by a future platform scope policy before production use.

The API does not accept a body or query `tenantId` as authority. An optional `x-tenant-id` selects a tenant only when the authenticated user has a matching active membership.
