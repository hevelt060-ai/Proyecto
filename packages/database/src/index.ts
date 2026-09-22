import { Db, MongoClient } from "mongodb";

export interface DatabaseConnection {
  connect(): Promise<Db>;
  disconnect(): Promise<void>;
}

export class MongoDatabaseConnection implements DatabaseConnection {
  private readonly client: MongoClient;
  private database: Db | undefined;

  public constructor(
    private readonly uri: string,
    private readonly databaseName: string,
  ) {
    this.client = new MongoClient(uri);
  }

  public async connect(): Promise<Db> {
    if (!this.database) {
      await this.client.connect();
      this.database = this.client.db(this.databaseName);
      await ensureIndexes(this.database);
    }

    return this.database;
  }

  public async disconnect(): Promise<void> {
    await this.client.close();
    this.database = undefined;
  }
}

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
