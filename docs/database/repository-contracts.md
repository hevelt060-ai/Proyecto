# Tenant-scoped repository contracts

Any repository that owns tenant data must require `TenantContext` on every operation that can read or mutate that data.

Allowed shape:

```ts
repository.findMany(context, filter);
repository.findById(context, id);
repository.update(context, id, patch);
repository.delete(context, id);
repository.count(context, filter);
repository.exists(context, filter);
```

Forbidden shape:

```ts
repository.findById(id);
repository.findMany(filter);
repository.update(id, patch);
repository.delete(id);
```

The current Organization repository follows this rule for creation, update, disable/delete and reads. MongoDB implementations include `tenantId` in resource filters and include tenant scope in parent lookups. In-memory adapters apply the same predicates so security tests do not exercise a weaker contract than production.

Global Identity lookups such as normalized email lookup are intentionally not tenant-scoped because email is currently a globally unique authentication identity. Membership resolution remains the authority for tenant access.

Every new repository method must be reviewed against this rule and covered by an isolation test using Tenant A and Tenant B.
