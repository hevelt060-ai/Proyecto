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
