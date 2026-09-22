# Phase 1.1 security test matrix

| Case                               | Expected                   | Current test              |
| ---------------------------------- | -------------------------- | ------------------------- |
| Valid login                        | 200                        | PASS                      |
| Invalid login                      | 401                        | PASS                      |
| Revoked session                    | 401                        | PASS                      |
| Disabled user                      | 401                        | PASS in Mongo integration |
| Missing permission                 | 403                        | PASS                      |
| Wrong tenant                       | 403                        | PASS                      |
| Organization from another tenant   | 403/empty                  | PASS                      |
| Branch from another tenant         | 403                        | PASS                      |
| Warehouse from another tenant      | 403                        | PASS                      |
| Tenant in body/header manipulation | Ignored or 403             | PASS                      |
| Role escalation                    | 403                        | PASS                      |
| Membership self-escalation         | 403                        | PASS                      |
| Request ID                         | Response/audit correlation | PASS                      |
| Audit log                          | Persisted without secrets  | PASS in Mongo integration |
| MongoDB isolation                  | Tenant predicates enforced | PASS                      |
| Login abuse                        | 429                        | PASS                      |
| Security headers                   | Present                    | PASS                      |
| 400 validation                     | Safe JSON                  | PASS                      |
| 404 route                          | Safe JSON                  | PASS                      |
| 500 internal error                 | Safe JSON without stack    | PASS                      |
| Concurrent sessions                | Independent sessions       | PASS                      |
| Concurrent membership updates      | Complete atomic document   | PASS                      |

Remaining coverage: explicit 500 injection, 422 policy if introduced, CI replica-set provisioning, and full update/delete/count/exists repository matrix for future resources.
