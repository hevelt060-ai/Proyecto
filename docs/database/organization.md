# Organization data model

## Collections

- `organizations`: tenant-scoped organizations.
- `companies`: tenant and organization-scoped companies.
- `branches`: tenant and company-scoped branches.
- `warehouses`: tenant and branch-scoped warehouses.

Every document contains its parent scope and timestamps. The Mongo adapter uses scoped filters and the database initializer creates unique indexes for names within the relevant parent scope.

| Collection    | Index                                     | Reason                                                  |
| ------------- | ----------------------------------------- | ------------------------------------------------------- |
| organizations | unique `(tenantId, name)`                 | Prevent duplicate organization names within one tenant. |
| companies     | unique `(tenantId, organizationId, name)` | Prevent duplicate company names inside an organization. |
| branches      | unique `(tenantId, companyId, name)`      | Prevent duplicate branch names inside a company.        |
| warehouses    | unique `(tenantId, branchId, name)`       | Prevent duplicate warehouse names inside a branch.      |

Department and cost center are prepared in the architecture but intentionally not implemented in this phase.
