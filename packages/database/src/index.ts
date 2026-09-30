import { MongoClient, type ClientSession, type Db, type TransactionOptions } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDatabase(uri: string, dbName: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error("Database not initialized. Call connectDatabase first.");
  }
  return db;
}

export async function withTransaction<T>(
  callback: (session: ClientSession, db: Db) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  if (!client || !db) {
    throw new Error("Database client not initialized.");
  }

  const session = client.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await callback(session, db!);
    }, options);
    return result!;
  } finally {
    await session.endSession();
  }
}

export async function disconnectDatabase(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

export { WorkshopDomainService } from "./workshopService.js";

export const ensureIndexes = async (database: Db): Promise<void> => {
  await Promise.all([
    database
      .collection("users")
      .createIndex({ email: 1 }, { unique: true, name: "users_email_unique" }),
    database
      .collection("credentials")
      .createIndex({ userId: 1 }, { unique: true, name: "credentials_user_unique" }),
    database
      .collection("sessions")
      .createIndex({ tokenHash: 1 }, { unique: true, name: "sessions_token_hash_unique" }),
    database
      .collection("sessions")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_expiry" }),
    database
      .collection("memberships")
      .createIndex(
        { tenantId: 1, userId: 1 },
        { unique: true, name: "memberships_tenant_user_unique" },
      ),
    database
      .collection("tenants")
      .createIndex({ slug: 1 }, { unique: true, name: "tenants_slug_unique" }),
    database
      .collection("organizations")
      .createIndex(
        { tenantId: 1, name: 1 },
        { unique: true, name: "organizations_tenant_name_unique" },
      ),
    database
      .collection("companies")
      .createIndex(
        { tenantId: 1, organizationId: 1, name: 1 },
        { unique: true, name: "companies_scope_name_unique" },
      ),
    database
      .collection("branches")
      .createIndex(
        { tenantId: 1, companyId: 1, name: 1 },
        { unique: true, name: "branches_scope_name_unique" },
      ),
    database
      .collection("warehouses")
      .createIndex(
        { tenantId: 1, branchId: 1, name: 1 },
        { unique: true, name: "warehouses_scope_name_unique" },
      ),
    database
      .collection("auditLogs")
      .createIndex({ tenantId: 1, timestamp: -1 }, { name: "audit_tenant_timestamp" }),
    database.collection("auditLogs").createIndex({ requestId: 1 }, { name: "audit_request_id" }),
  ]);
};
