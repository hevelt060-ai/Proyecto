export type EquipmentCategory = "MTB" | "ROAD" | "GRAVEL" | "E_BIKE" | "SUSPENSION";

export type WorkOrderStatus =
  | "RECEIVED"
  | "IN_DIAGNOSIS"
  | "WAITING_PARTS"
  | "IN_PROGRESS"
  | "QUALITY_CHECK"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export const ALLOWED_STATUS_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  RECEIVED: ["IN_DIAGNOSIS", "CANCELLED"],
  IN_DIAGNOSIS: ["WAITING_PARTS", "IN_PROGRESS", "CANCELLED"],
  WAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["QUALITY_CHECK", "WAITING_PARTS", "CANCELLED"],
  QUALITY_CHECK: ["READY_FOR_DELIVERY", "IN_PROGRESS"],
  READY_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export interface Equipment {
  id: string;
  serialNumber: string;
  brand: string;
  model: string;
  category: EquipmentCategory;
  customerId: string;
  createdAt: Date;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  partNumber: string;
  currentStock: number;
  reservedStock: number;
  costPrice: number;
  salePrice: number;
  minStock: number;
  updatedAt: Date;
}

export interface WorkOrderPartItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  status: "RESERVED" | "CONSUMED";
}

export interface StatusAuditEntry {
  fromStatus: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  timestamp: Date;
  changedByUserId: string;
  notes?: string;
}

export interface WorkOrder {
  id: string;
  folio: string;
  equipmentId: string;
  customerId: string;
  assignedTechnicianId?: string;
  status: WorkOrderStatus;
  intakeChecklist: {
    damagesReported: string[];
    odometerKm?: number;
    suspensionLockWorking: boolean;
    initialCleanliness: "CLEAN" | "DIRTY" | "MUDDY";
  };
  parts: WorkOrderPartItem[];
  laborCost: number;
  totalCost: number;
  statusHistory: StatusAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export function canTransitionWorkOrderStatus(
  fromStatus: WorkOrderStatus,
  toStatus: WorkOrderStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}
