import { randomUUID } from "node:crypto";

import type { Collection, Db } from "mongodb";

import { NotFoundError, TenantAccessDeniedError, type TenantId } from "@erp/domain";
import type { TenantContext } from "../../identity/src/index.js";

export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type CompanyId = string & { readonly __brand: "CompanyId" };
export type BranchId = string & { readonly __brand: "BranchId" };
export type WarehouseId = string & { readonly __brand: "WarehouseId" };

export interface Organization {
  id: OrganizationId;
  tenantId: TenantId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: CompanyId;
  tenantId: TenantId;
  organizationId: OrganizationId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Branch {
  id: BranchId;
  tenantId: TenantId;
  companyId: CompanyId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Warehouse {
  id: WarehouseId;
  tenantId: TenantId;
  branchId: BranchId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationStore {
  createOrganization(context: TenantContext, organization: Organization): Promise<void>;
  updateOrganization(
    context: TenantContext,
    organizationId: OrganizationId,
    name: string,
  ): Promise<void>;
  disableOrganization(context: TenantContext, organizationId: OrganizationId): Promise<void>;
  findOrganizations(context: TenantContext): Promise<Organization[]>;
  createCompany(context: TenantContext, company: Company): Promise<void>;
  findCompanies(context: TenantContext, organizationId: OrganizationId): Promise<Company[]>;
  createBranch(context: TenantContext, branch: Branch): Promise<void>;
  findBranches(context: TenantContext, companyId: CompanyId): Promise<Branch[]>;
  createWarehouse(context: TenantContext, warehouse: Warehouse): Promise<void>;
  findWarehouses(context: TenantContext, branchId: BranchId): Promise<Warehouse[]>;
}

const assertTenant = (context: TenantContext, tenantId: TenantId): void => {
  if (context.tenantId !== tenantId) throw new TenantAccessDeniedError();
};

export class OrganizationService {
  public constructor(private readonly store: OrganizationStore) {}

  public async createOrganization(context: TenantContext, name: string): Promise<Organization> {
    const organization: Organization = {
      id: randomUUID() as OrganizationId,
      tenantId: context.tenantId,
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.store.createOrganization(context, organization);
    return organization;
  }

  public async listOrganizations(context: TenantContext): Promise<Organization[]> {
    return this.store.findOrganizations(context);
  }

  public async createCompany(
    context: TenantContext,
    organizationId: OrganizationId,
    name: string,
  ): Promise<Company> {
    const company: Company = {
      id: randomUUID() as CompanyId,
      tenantId: context.tenantId,
      organizationId,
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.store.createCompany(context, company);
    return company;
  }

  public async listCompanies(
    context: TenantContext,
    organizationId: OrganizationId,
  ): Promise<Company[]> {
    return this.store.findCompanies(context, organizationId);
  }

  public async createBranch(
    context: TenantContext,
    companyId: CompanyId,
    name: string,
  ): Promise<Branch> {
    const branch: Branch = {
      id: randomUUID() as BranchId,
      tenantId: context.tenantId,
      companyId,
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.store.createBranch(context, branch);
    return branch;
  }

  public async listBranches(context: TenantContext, companyId: CompanyId): Promise<Branch[]> {
    return this.store.findBranches(context, companyId);
  }

  public async createWarehouse(
    context: TenantContext,
    branchId: BranchId,
    name: string,
  ): Promise<Warehouse> {
    const warehouse: Warehouse = {
      id: randomUUID() as WarehouseId,
      tenantId: context.tenantId,
      branchId,
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.store.createWarehouse(context, warehouse);
    return warehouse;
  }

  public async listWarehouses(context: TenantContext, branchId: BranchId): Promise<Warehouse[]> {
    return this.store.findWarehouses(context, branchId);
  }
}

export class InMemoryOrganizationStore implements OrganizationStore {
  private readonly organizations = new Map<OrganizationId, Organization>();
  private readonly companies = new Map<CompanyId, Company>();
  private readonly branches = new Map<BranchId, Branch>();
  private readonly warehouses = new Map<WarehouseId, Warehouse>();

  public async createOrganization(
    context: TenantContext,
    organization: Organization,
  ): Promise<void> {
    if (organization.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    this.organizations.set(organization.id, organization);
  }
  public async updateOrganization(
    context: TenantContext,
    organizationId: OrganizationId,
    name: string,
  ): Promise<void> {
    const organization = this.organizations.get(organizationId);
    if (!organization) throw new NotFoundError("Organization");
    if (organization.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    this.organizations.set(organizationId, {
      ...organization,
      name: name.trim(),
      updatedAt: new Date(),
    });
  }
  public async disableOrganization(
    context: TenantContext,
    organizationId: OrganizationId,
  ): Promise<void> {
    const organization = this.organizations.get(organizationId);
    if (!organization) throw new NotFoundError("Organization");
    if (organization.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    this.organizations.delete(organizationId);
  }
  public async findOrganizations(context: TenantContext): Promise<Organization[]> {
    return [...this.organizations.values()].filter((item) => item.tenantId === context.tenantId);
  }
  public async createCompany(context: TenantContext, company: Company): Promise<void> {
    if (company.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    const organization = this.organizations.get(company.organizationId);
    if (!organization) throw new NotFoundError("Organization");
    if (organization.tenantId !== company.tenantId) throw new TenantAccessDeniedError();
    this.companies.set(company.id, company);
  }
  public async findCompanies(
    context: TenantContext,
    organizationId: OrganizationId,
  ): Promise<Company[]> {
    return [...this.companies.values()].filter(
      (item) => item.tenantId === context.tenantId && item.organizationId === organizationId,
    );
  }
  public async createBranch(context: TenantContext, branch: Branch): Promise<void> {
    if (branch.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    const company = this.companies.get(branch.companyId);
    if (!company) throw new NotFoundError("Company");
    if (company.tenantId !== branch.tenantId) throw new TenantAccessDeniedError();
    this.branches.set(branch.id, branch);
  }
  public async findBranches(context: TenantContext, companyId: CompanyId): Promise<Branch[]> {
    return [...this.branches.values()].filter(
      (item) => item.tenantId === context.tenantId && item.companyId === companyId,
    );
  }
  public async createWarehouse(context: TenantContext, warehouse: Warehouse): Promise<void> {
    if (warehouse.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    const branch = this.branches.get(warehouse.branchId);
    if (!branch) throw new NotFoundError("Branch");
    if (branch.tenantId !== warehouse.tenantId) throw new TenantAccessDeniedError();
    this.warehouses.set(warehouse.id, warehouse);
  }
  public async findWarehouses(context: TenantContext, branchId: BranchId): Promise<Warehouse[]> {
    return [...this.warehouses.values()].filter(
      (item) => item.tenantId === context.tenantId && item.branchId === branchId,
    );
  }
}

interface MongoOrganizationDocument {
  _id: string;
  [key: string]: unknown;
}

export class MongoOrganizationStore implements OrganizationStore {
  public constructor(private readonly database: Db) {}
  private collection<T extends MongoOrganizationDocument>(name: string): Collection<T> {
    return this.database.collection<T>(name);
  }
  public async createOrganization(context: TenantContext, value: Organization): Promise<void> {
    if (value.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    await this.collection("organizations").insertOne({ ...value, _id: value.id });
  }
  public async updateOrganization(
    context: TenantContext,
    organizationId: OrganizationId,
    name: string,
  ): Promise<void> {
    const result = await this.collection("organizations").updateOne(
      { _id: organizationId, tenantId: context.tenantId },
      { $set: { name: name.trim(), updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw new TenantAccessDeniedError();
  }
  public async disableOrganization(
    context: TenantContext,
    organizationId: OrganizationId,
  ): Promise<void> {
    const result = await this.collection("organizations").deleteOne({
      _id: organizationId,
      tenantId: context.tenantId,
    });
    if (result.deletedCount === 0) throw new TenantAccessDeniedError();
  }
  public async findOrganizations(context: TenantContext): Promise<Organization[]> {
    return this.findScoped<Organization>("organizations", { tenantId: context.tenantId });
  }
  public async createCompany(context: TenantContext, value: Company): Promise<void> {
    if (value.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    const parent = await this.collection<Organization & MongoOrganizationDocument>(
      "organizations",
    ).findOne({ _id: value.organizationId, tenantId: value.tenantId });
    if (!parent) throw new TenantAccessDeniedError();
    await this.collection("companies").insertOne({ ...value, _id: value.id });
  }
  public async findCompanies(
    context: TenantContext,
    organizationId: OrganizationId,
  ): Promise<Company[]> {
    return this.findScoped<Company>("companies", { tenantId: context.tenantId, organizationId });
  }
  public async createBranch(context: TenantContext, value: Branch): Promise<void> {
    if (value.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    const parent = await this.collection<Company & MongoOrganizationDocument>("companies").findOne({
      _id: value.companyId,
      tenantId: value.tenantId,
    });
    if (!parent) throw new TenantAccessDeniedError();
    await this.collection("branches").insertOne({ ...value, _id: value.id });
  }
  public async findBranches(context: TenantContext, companyId: CompanyId): Promise<Branch[]> {
    return this.findScoped<Branch>("branches", { tenantId: context.tenantId, companyId });
  }
  public async createWarehouse(context: TenantContext, value: Warehouse): Promise<void> {
    if (value.tenantId !== context.tenantId) throw new TenantAccessDeniedError();
    const parent = await this.collection<Branch & MongoOrganizationDocument>("branches").findOne({
      _id: value.branchId,
      tenantId: value.tenantId,
    });
    if (!parent) throw new TenantAccessDeniedError();
    await this.collection("warehouses").insertOne({ ...value, _id: value.id });
  }
  public async findWarehouses(context: TenantContext, branchId: BranchId): Promise<Warehouse[]> {
    return this.findScoped<Warehouse>("warehouses", { tenantId: context.tenantId, branchId });
  }
  private async findScoped<T extends object>(
    name: string,
    filter: Record<string, unknown>,
  ): Promise<T[]> {
    const documents = await this.collection<T & MongoOrganizationDocument>(name)
      .find(filter as never)
      .toArray();
    return documents.map(({ _id: _ignored, ...value }) => value as unknown as T);
  }
}
