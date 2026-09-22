# Target architecture

## Goals

Build a multi-tenant ERP that starts as a modular monolith and can later extract bounded modules without rewriting domain behavior. The initial system favors explicit boundaries, transactional correctness and vertical slices over broad incomplete CRUD.

## Runtime topology

```text
React Native / React Native Web
          |
    Typed API client
          |
      Express API
          |
  Application use cases
     /         \
 Domain       Event bus
   rules       /    \
Repositories  Worker  Integrations
      |
 MongoDB Atlas (source of truth)
      Redis (cache, rate limits, locks, queues only)
      S3-compatible object storage (file bytes)
```

## Module boundary

Each business module follows:

```text
modules/<module>/
  domain/          entities, value objects, events, rules, services, repository ports
  application/     commands, queries, use cases, DTOs
  infrastructure/  Mongo models, repository implementations, integrations
  presentation/    controllers, routes, validators
  index.ts         public module composition and contracts
```

Modules may communicate through application contracts, shared kernel types or domain events. A module must not import another module's Mongo model or collection.

## Dependency rules

- Domain depends on no framework, transport, database or UI package.
- Controllers call use cases; controllers do not query MongoDB.
- Repository interfaces are owned by application/domain; implementations are infrastructure.
- Express is composed at the API boundary.
- React Native and React Native Web consume API contracts and shared UI primitives, but do not own business rules.
- Worker handlers consume events/jobs and call application use cases; heavy work does not run in HTTP requests.
- Cross-cutting packages remain small and cannot become a shared dumping ground.

## Tenancy and authorization

Every business document includes `tenantId`; organization, company, branch, warehouse and other scope fields are added when applicable. Tenant context is resolved from authenticated identity and request context, then passed explicitly to use cases and repository methods. Repositories require scope in their method signatures and apply tenant predicates server-side. Authorization evaluates granular permission plus scope; an absent scope is not a wildcard.

The first security vertical slice must prove:

- Tenant A cannot read, update or infer Tenant B records.
- Authentication and session handling do not expose secrets.
- RBAC permissions can be restricted by tenant, organization, branch, warehouse or department.
- Important mutations write audit records with request correlation.

## Persistence

MongoDB Atlas is the source of truth. Collections are separated by aggregate/domain concerns, for example `users`, `roles`, `tenants`, `organizations`, `products`, `stockMovements`, `salesOrders`, `invoices`, `payments`, `journalEntries`, `auditLogs` and workflow collections. Indexes are added from measured access patterns, especially compound tenant-scoped indexes such as `{ tenantId: 1, status: 1, createdAt: -1 }` where query shape requires them.

Financial transactions are append-only in behavior: corrections use reversals, adjustments and audit trails. Inventory availability is protected by atomic conditional updates or transactions and remains traceable through stock movements; a current balance is a projection, not the only history.

## Events and jobs

The internal event bus is transport-independent. Events carry a stable name, event ID, occurred time, tenant context, aggregate identity and versioned payload. Handlers are idempotent. Outbox persistence is the preferred reliability boundary once transactional modules are introduced. Redis queues are operational infrastructure, never business truth.

## API contract

REST endpoints are versioned under `/api/v1`. Responses use a consistent success/error envelope and request IDs. Critical commands support idempotency keys. List endpoints define pagination, filtering, sorting and bounded payloads. Input is validated before use cases execute; internal errors are mapped to safe public codes.

## Client architecture

Web and mobile share TypeScript contracts, API client behavior and design-system primitives, but have different compositions. Web prioritizes dense tables, dashboards, keyboard shortcuts and bulk operations. Mobile prioritizes touch, scanning, camera, notifications and quick actions. Offline support is a future capability boundary, initially limited to workflows that can define conflict and reconciliation rules.

## Proposed repository structure

This is the target structure, not an assertion that every directory is implemented today:

```text
erp-platform/
      apps/
            api/             Express composition and HTTP entrypoint
            worker/          asynchronous jobs and event handlers
            web/             React Native Web desktop experience
            mobile/          React Native touch/mobile experience
      packages/
            ui/              shared design-system primitives
            api-client/      typed transport client
            auth/            client authentication state boundary
            config/          validated runtime configuration
            database/        MongoDB adapters, indexes and transactions
            domain/          framework-independent shared domain primitives
            types/           API/application contracts
            validation/      DTO and boundary validation
            utilities/       small cross-cutting utilities
      modules/
            identity/ organization/ finance/ sales/ purchasing/ inventory/
            crm/ manufacturing/ projects/ service/ assets/ hr/
            workflow/ reporting/ integrations/
      infrastructure/
            docker/ nginx/ monitoring/
      deployment/        environment promotion and runtime manifests
      scripts/            repeatable local and CI commands
      tests/
            unit/ integration/ component/ e2e/ performance/ security/
      docs/
            architecture/ api/ database/ modules/ security/ qa/ business/
```

`apps` owns runtime composition, `packages` owns reusable technical or contract boundaries, `modules` owns business capabilities, `infrastructure` owns runtime support, `tests` owns cross-boundary quality checks and `docs` owns the auditable system contract. The structure must grow by vertical slices rather than by filling every directory at once.

## Delivery phases

1. Foundation: repository diagnosis, monorepo, TypeScript, lint, tests, environment config, API and worker boundaries.
2. Identity and Organization: tenant context, authentication, RBAC, audit and security tests.
3. Core ERP: products, customers, suppliers, inventory, sales, purchasing and finance foundation.
4. Workflow, reporting, notifications, documents and integration hub.
5. CRM, manufacturing, projects, service, assets and HR.
6. Advanced analytics, AI proposals with authorization gates, marketplace and IoT.

Each vertical slice must ship domain behavior, API, client behavior where relevant, validation, permissions, audit, tests and documentation together.
