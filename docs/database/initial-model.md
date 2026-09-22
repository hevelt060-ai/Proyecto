# Initial data model policy

This is a boundary document, not a completed schema. Models are introduced with vertical slices and must document purpose, fields, indexes, relationships, audit behavior and tenant scope before implementation.

## Required metadata for business documents

- `tenantId`
- applicable `organizationId`, `companyId`, `branchId`, `warehouseId` or `departmentId`
- `createdAt`, `updatedAt`
- `createdBy`, `updatedBy`
- status/version fields where concurrency or lifecycle requires them

## Initial collection families

Identity and organization: `users`, `roles`, `permissions`, `sessions`, `tenants`, `organizations`, `companies`, `branches`, `warehouses`, `departments`.

Core ERP: `customers`, `suppliers`, `products`, `productVariants`, `stock`, `stockMovements`, `salesOrders`, `salesOrderLines`, `quotations`, `purchaseOrders`, `purchaseOrderLines`, `invoices`, `payments`, `accounts`, `journalEntries`.

Cross-cutting: `auditLogs`, `workflows`, `workflowExecutions`, `notifications`, `documents`, `integrations`, `webhooks`.

## Index policy

Indexes must correspond to repository query shapes and include tenant scope first for business data. Typical candidates are compound indexes on tenant plus lifecycle/status and recency, unique indexes scoped by tenant for business codes, and lookup indexes for referenced IDs. Every index requires a documented query it protects; indiscriminate indexing is prohibited.

## Safety rules

- Never store passwords, bearer tokens, API secrets or private keys in business documents or audit snapshots.
- Never use an unscoped repository method for tenant data.
- Never use a mutable stock total as the only inventory history.
- Never physically delete financial transactions.
- Use projection and pagination for list queries; avoid unbounded documents and N+1 access patterns.
