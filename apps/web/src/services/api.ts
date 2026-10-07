const API_BASE_URL = "https://erp-api-backend.onrender.com/api/v1";

export type WorkOrderStatus =
  | "RECEIVED"
  | "IN_DIAGNOSIS"
  | "WAITING_PARTS"
  | "IN_PROGRESS"
  | "QUALITY_CHECK"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export interface WorkOrder {
  id: string;
  folio: string;
  equipmentSnapshot?: {
    serialNumber: string;
    brand: string;
    model: string;
    category: string;
  };
  customerId: string;
  status: WorkOrderStatus;
  laborCost: number;
  totalCost: number;
  createdAt: string;
  updatedAt?: string;
  deliveryDate?: string;
  parts?: { name: string; sku: string; quantity: number }[];
  intakeChecklist?: { damagesReported: string[] };
}

export interface ServiceRecord {
  id: string;
  folio?: string;
  clientName: string;
  clientPhone: string;
  bikeModel: string;
  serviceType: string;
  deliveryDate: string;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  laborCost?: number;
  totalCost?: number;
  paymentStatus?: string;
}

export interface CreateReportPayload {
  title: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  totalServicesCount: number;
  breakdown: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface SavedReport extends CreateReportPayload {
  id: string;
  tenantId: string;
  createdAt: string;
  data?: {
    totalRevenue?: number;
    totalServices?: { delivered?: number };
  };
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  currentStock: number;
  reservedStock: number;
  salePrice: number;
  minStock: number;
}

class ApiClient {
  private token: string | null = localStorage.getItem("erp_token");

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("erp_token", token);
    } else {
      localStorage.removeItem("erp_token");
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || `HTTP Error ${response.status}`);
    }

    return data.data;
  }

  public getWorkOrders(): Promise<WorkOrder[]> {
    return this.request<WorkOrder[]>("/work-orders");
  }

  public getCurrentUser(): Promise<{ user: AuthenticatedUser }> {
    return this.request<{ user: AuthenticatedUser }>("/users/me");
  }

  public createWorkOrder(payload: {
    equipment: {
      serialNumber: string;
      brand: string;
      model: string;
      category: string;
      customerId: string;
    };
    intakeChecklist: {
      damagesReported: string[];
      suspensionLockWorking: boolean;
      initialCleanliness: "CLEAN" | "DIRTY" | "MUDDY";
    };
    laborCost: number;
  }): Promise<WorkOrder> {
    return this.request<WorkOrder>("/work-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  public transitionStatus(
    id: string,
    status: WorkOrderStatus,
    notes?: string,
  ): Promise<{ id: string; status: WorkOrderStatus }> {
    return this.request<{ id: string; status: WorkOrderStatus }>(`/work-orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    });
  }

  public getInventory(): Promise<InventoryItem[]> {
    return this.request<InventoryItem[]>("/inventory");
  }

  // --- NEW SERVICES AND REPORTS API ---

  public async getServices(): Promise<ServiceRecord[]> {
    const response = await fetch(`${API_BASE_URL}/services`, {
      headers: this.getServiceHeaders(),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw new Error(this.getServiceError(payload, response.status));
    }

    const services = Array.isArray(payload)
      ? payload
      : typeof payload === "object" && payload !== null && "data" in payload
        ? payload.data
        : null;
    if (!Array.isArray(services)) {
      throw new Error("La respuesta del servidor no contiene una lista de servicios");
    }
    return services as ServiceRecord[];
  }

  public async createService(payload: {
    clientName: string;
    clientPhone: string;
    bikeModel: string;
    serviceType: string;
    deliveryDate: string;
    notes: string;
    status: "pending";
  }): Promise<ServiceRecord> {
    const response = await fetch(`${API_BASE_URL}/services`, {
      method: "POST",
      headers: this.getServiceHeaders(),
      body: JSON.stringify(payload),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(this.getServiceError(result, response.status));
    }
    return result as ServiceRecord;
  }

  public async updateServiceStatus(id: string, status: string): Promise<ServiceRecord> {
    const response = await fetch(`${API_BASE_URL}/services/${id}/status`, {
      method: "PATCH",
      headers: this.getServiceHeaders(),
      body: JSON.stringify({ status }),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(this.getServiceError(result, response.status));
    }
    return result as ServiceRecord;
  }

  private getServiceHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private getServiceError(payload: unknown, status: number): string {
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      const error = payload.error;
      if (typeof error === "object" && error !== null && "message" in error) {
        return String(error.message);
      }
    }
    return `HTTP Error ${status}`;
  }

  public updateService(id: string, payload: any): Promise<any> {
    return fetch(`${API_BASE_URL}/services/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(payload),
    }).then((res) => res.json());
  }

  public deleteService(id: string): Promise<any> {
    return fetch(`${API_BASE_URL}/services/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
    }).then((res) => res.json());
  }

  public getReportsSummary(startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<any>(`/reports/summary${query}`);
  }

  public saveReport(report: CreateReportPayload): Promise<SavedReport> {
    return this.request<SavedReport>("/reports", {
      method: "POST",
      body: JSON.stringify(report),
    });
  }

  public getSavedReports(): Promise<SavedReport[]> {
    return this.request<SavedReport[]>("/reports");
  }

  public getExpenses(): Promise<any[]> {
    return fetch(`${API_BASE_URL}/expenses`, {
      headers: this.getServiceHeaders(),
    }).then((res) => res.json());
  }

  public createExpense(payload: {
    description: string;
    amount: number;
    date: string;
    category?: string;
    paymentMethod?: string;
  }): Promise<any> {
    return fetch(`${API_BASE_URL}/expenses`, {
      method: "POST",
      headers: this.getServiceHeaders(),
      body: JSON.stringify(payload),
    }).then((res) => res.json());
  }

  public deleteExpense(id: string): Promise<any> {
    return fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: "DELETE",
      headers: this.getServiceHeaders(),
    }).then((res) => res.json());
  }

  public getReportsExportUrl(startDate?: string, endDate?: string): string {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    const query = params.toString() ? `?${params.toString()}` : "";
    return `${API_BASE_URL}/reports/services/export${query}`;
  }

  public login(email: string, password: string): Promise<{ token: string }> {
    return this.request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  public register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ token: string }> {
    return this.request<{ token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}

export const api = new ApiClient();
