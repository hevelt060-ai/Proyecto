# Migration plan

Review date: 2026-09-22. This is a proposal based on the audited repository. It does not execute migration, install dependencies or alter data.

## 1. What can be preserved

- Node.js, TypeScript, Express and npm workspace foundation.
- Strict TypeScript project-reference setup.
- API version prefix convention `/api/v1`.
- Separate worker process boundary.
- Existing domain tenant/event type direction, after strengthening it with runtime contracts.
- Prettier, ESLint, Vitest and CI validation as a baseline.
- Module names and layer directory intent, treated as boundaries rather than completed code.
- Existing environment variable naming as a starting contract, after adding schema validation and secret-management policy.

## 2. What must be modified

- Move API composition out of the inline `main.ts` route as presentation/application layers arrive.
- Replace unchecked configuration defaults with typed environment validation and production fail-fast rules.
- Add structured error handling, request IDs, security headers, rate limiting and input validation.
- Strengthen module packages and dependency boundaries so modules can be tested and built independently.
- Expand ESLint rules deliberately and add test coverage gates for critical paths.
- Extend CI with dependency/security scanning, build verification and integration services once persistence exists.

## 3. What should be removed or consolidated

- No business code should be removed in this audit because none exists.
- Generated `dist/` and `*.tsbuildinfo` artifacts should remain ignored and should not be packaged as source.
- Consolidate the older `docs/architecture/decisions.md` with the requested `architecture-decisions.md` after confirming no external links depend on the old path.
- Do not remove `.mongodb-data/` until confirming whether it contains any needed local development data; it is currently ignored and was not inspected as application data.

## 4. What must be created

- Identity and Organization domain/application/infrastructure/presentation implementations.
- Configuration schema and secret handling.
- MongoDB connection, collection ownership, indexes, repository ports and adapters.
- Authentication, sessions, RBAC, permission scope and audit logging.
- Tenant context middleware/application contract.
- Typed API client, web/mobile foundations and shared UI components after API contracts stabilize.
- Event bus and idempotent worker/job contracts.
- Integration, security, concurrency and tenant-isolation test harnesses.

## 5. What must be migrated

There is currently no verified business schema, source database connection or legacy application data in the inspected source tree. Therefore no data migration should be designed or run yet. Once a real source is identified:

1. Inventory source collections/tables and ownership.
2. Create immutable backups and verify restore procedures.
3. Define mapping and reconciliation reports before writing destination data.
4. Migrate into tenant-scoped collections using idempotent batches.
5. Validate counts, checksums, references and financial totals.
6. Cut over with a reversible plan and read-only source window.

## 6. What must happen first

1. Establish Git repository, branch protection and review ownership outside this audit.
2. Approve the target dependency plan without installing unapproved technology during Phase 0.
3. Implement configuration validation and security baseline.
4. Design Identity/Organization data model, indexes and tenant context.
5. Implement authentication, RBAC, audit and tenant isolation tests.
6. Add MongoDB adapter and repository integration tests.
7. Expose the first protected API vertical slice.

## 7. What can happen later

- Web and mobile workflows beyond the first protected slice.
- Redis cache/locks/queues when measured requirements exist.
- S3-compatible documents when authorization and tenant scope exist.
- Sales, purchasing, inventory and finance after core identity/organization contracts.
- Workflow, reporting, integrations, CRM, manufacturing, projects, service, assets and HR in the defined phases.
- Advanced AI, predictive analytics, marketplace and IoT only after stable ERP core data and explicit authorization gates.

## 8. Risk controls

| Risk                               | Control                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cross-tenant data access           | Tenant context comes from authenticated identity; every repository query is scoped and tested with at least two tenants. |
| Data loss                          | Backups, restore drills, idempotent migration batches and reconciliation before cutover.                                 |
| Duplicate payments/invoices/orders | Idempotency keys, unique scoped indexes and transaction/concurrency tests.                                               |
| Financial corruption               | Append-only records, reversals/adjustments, audit log and period controls.                                               |
| Dependency regression              | Lockfile review, `npm audit`, CI tests and controlled major upgrades.                                                    |
| Architecture drift                 | Module dependency rules, code review checklist and documentation per vertical slice.                                     |
| Runtime outage                     | Health/readiness checks, structured logs, metrics and worker retry/dead-letter policy before production.                 |

## 9. What could break

- Moving inline routes into module composition can change route registration and startup behavior.
- Adding MongoDB transactions requires a replica set/Atlas configuration; standalone local MongoDB settings may not support every transaction test.
- Authentication changes can invalidate future client assumptions about session/token shape.
- Introducing tenant predicates into repositories can reveal previously unscoped data access.
- Major Vitest upgrade may change test APIs or configuration; it must be isolated and validated.
- Adding React Native/Web tooling may introduce Metro, bundler and platform-specific dependency constraints.

## 10. Information-preservation strategy

No source data is migrated in this phase. Before any future migration, freeze the source contract, snapshot it, verify backup restoration, record checksums/counts, write idempotent migration jobs, preserve source identifiers in mapping metadata, and produce reconciliation evidence. Never run a destructive cleanup as part of the first migration attempt.
