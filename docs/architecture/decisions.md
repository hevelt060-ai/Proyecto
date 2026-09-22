# Architecture decisions

## ADR-001: Modular monolith first

**Status:** Accepted

The first deployment is one Node.js/Express application plus a worker process. Module boundaries are explicit so a future service extraction has a stable contract. Microservices, Kafka and Kubernetes are deferred because they would add operational cost before transactional boundaries and product workflows are proven.

## ADR-002: Clean Architecture with light DDD

**Status:** Accepted

Modules use domain entities, value objects, domain events, repository ports and use cases where they clarify ownership. The domain remains independent of Express, MongoDB and client frameworks. We avoid ceremony that does not protect a business invariant.

## ADR-003: MongoDB Atlas as system of record

**Status:** Accepted

MongoDB matches the required stack and supports tenant-scoped documents, transactions where needed and separately indexed domain collections. Redis may accelerate access or coordinate ephemeral work, but cannot be the source of truth.

## ADR-004: Internal event bus before external broker

**Status:** Accepted

Events are transport-independent and can later be backed by an outbox and external broker. Kafka is deferred until measured throughput, replay and cross-service delivery requirements justify it.

## ADR-005: React Native plus React Native Web

**Status:** Accepted

The clients share TypeScript contracts and design-system primitives while allowing web and mobile-specific workflows. Kotlin is limited to native modules for capabilities React Native cannot provide; no ERP rules are placed in Kotlin.

## ADR-006: Explicit tenant context

**Status:** Accepted

Tenant scope is a required input to business repositories and use cases. It is never inferred from an arbitrary request body field and never treated as optional for business data. This supports defense in depth against cross-tenant access.

## ADR-007: Append-only financial behavior

**Status:** Accepted

Invoices, payments and journal entries are not physically deleted. Corrections use reversals, adjustments and audit records. This protects traceability and supports reconciliation.

## ADR-008: Files outside MongoDB

**Status:** Accepted

MongoDB stores document metadata, storage key, MIME type, size and hash. Binary content belongs in S3-compatible object storage, with authorization checked through the application boundary.

## ADR-009: Async heavy work

**Status:** Accepted

PDF generation, imports, exports, notifications, integrations and heavy reports run through the worker boundary. HTTP requests return a job reference when work cannot complete within normal request latency.

## ADR-010: Fiscal Engine as a separate boundary

**Status:** Accepted

Tax and fiscal-provider rules do not leak into generic Finance. The first boundary prepares Mexico CFDI integration and future country adapters without claiming full fiscal compliance.
