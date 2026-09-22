# Identity data model

## Collections

- `users`: profile and lifecycle status; never password material.
- `credentials`: one bcrypt password hash per user.
- `sessions`: SHA-256 token hash, expiry, revocation and creation metadata.
- `tenants`: tenant identity, slug and status.
- `memberships`: user-to-tenant relationship and role names.
- `auditLogs`: security and business mutation audit records.

## Indexes

| Collection  | Index                        | Reason                                                       |
| ----------- | ---------------------------- | ------------------------------------------------------------ |
| users       | unique `email`               | Prevent duplicate login identities and support login lookup. |
| credentials | unique `userId`              | Enforce one credential record per user.                      |
| sessions    | unique `tokenHash`           | Prevent duplicate session token records.                     |
| sessions    | TTL `expiresAt`              | Allow expired sessions to be removed automatically.          |
| memberships | unique `(tenantId, userId)`  | Prevent duplicate tenant membership.                         |
| tenants     | unique `slug`                | Stable tenant lookup and URL-safe identity.                  |
| auditLogs   | `(tenantId, timestamp desc)` | Tenant-scoped audit timeline.                                |
| auditLogs   | `requestId`                  | Correlate security events with a request.                    |

Production schema validation, membership role mutation and password reset flows remain future work.
