# Initial architecture decisions

Review date: 2026-09-22. These decisions describe the current foundation and the constraints for future implementation. They do not imply that the target capabilities are already implemented.

## ADR-001: Preserve the current Node/TypeScript/Express foundation

**Status:** Accepted

The existing runtime choices are aligned with the requested stack and compile successfully. They should be preserved. No technology replacement is justified by the current audit.

## ADR-002: Use a modular monolith before service extraction

**Status:** Accepted

The repository uses one API process plus a separate worker boundary. Business modules will remain in one deployable application initially. Extraction into services is deferred until module contracts, operational load and ownership boundaries are proven.

## ADR-003: Keep domain independent of frameworks and persistence

**Status:** Accepted

Domain code must not import Express, MongoDB, React or React Native. Controllers call application use cases, and repository interfaces are implemented in infrastructure. This is a constraint for new code; the current repository has only generic domain types and no business implementation.

## ADR-004: Treat MongoDB Atlas as the future source of truth

**Status:** Accepted as target

MongoDB is required by the project direction but is not currently installed or connected. When introduced, it must use explicit collection ownership, tenant-first query predicates, documented indexes, bounded projections and transactions only where invariants require them.

## ADR-005: Make tenant context explicit and mandatory

**Status:** Accepted as target, not implemented

A request body must never select the tenant scope. Authenticated identity and server-side context must determine scope, and repository methods must require it. The first implementation gate is cross-tenant read/write denial tests.

## ADR-006: Do not add dependencies during this audit

**Status:** Accepted

The audit is documentation-only. React, MongoDB, Redis, storage, validation and security dependencies remain absent until the corresponding vertical slice is designed and approved. This avoids hiding architectural decisions inside setup work.

## ADR-007: Keep generated artifacts out of source control

**Status:** Accepted

`dist/`, `*.tsbuildinfo`, local MongoDB data, logs and environment files are ignored. The workspace currently has no Git metadata, so repository initialization and branch policy remain an operational prerequisite, not an action in Phase 0.

## ADR-008: Defer business modules and database models

**Status:** Accepted

Module directories are placeholders only. No broad CRUD scaffolding, financial models, manufacturing logic, HR, CRM or integrations will be added until Identity and Organization establish tenant, identity, audit and authorization contracts.

## ADR-009: Keep the worker separate from HTTP

**Status:** Accepted

The worker process is currently a placeholder. Heavy work must not be placed in API requests. Queue technology and retry semantics will be selected when the first asynchronous use case provides a concrete requirement.

## ADR-010: Record the Vitest audit finding without auto-upgrading

**Status:** Accepted for Phase 0

`npm audit` reports two moderate vulnerabilities in the Vitest dependency tree and proposes a breaking upgrade. No automatic upgrade is performed in an audit-only phase. The dependency owner must evaluate the Vitest major upgrade before CI is treated as production-ready.

## ADR-011: Use the official MongoDB driver, not an ODM

**Status:** Accepted

The official driver is sufficient for the current repository boundary and avoids introducing model decorators or persistence behavior into the domain. Repository implementations own collection access, indexes and tenant predicates. An ODM may be reconsidered only if repeated mapping complexity justifies it.

## ADR-012: Use opaque sessions for the first identity slice

**Status:** Accepted

The API returns a random opaque token while stores retain only a SHA-256 token hash. This supports revocation and expiration without storing bearer tokens. No password or token is logged.

## ADR-013: Keep Redis out of Phase 1

**Status:** Accepted

The identity and organization slice does not require distributed cache, locks or queues to prove its invariants. Redis is not installed or used. It will be introduced only when a concrete rate-limit, concurrency or asynchronous workload requires it.
