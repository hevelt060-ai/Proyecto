import type { WorkOrderStatus } from "../../services/api";

export type BikeServiceStatus =
  "PENDING" | "IN_PROGRESS" | "WAITING_PARTS" | "READY_FOR_DELIVERY" | "COMPLETED" | "CANCELLED";

export type BikeServiceSource = "api" | "local";

export interface BikeService {
  id: string;
  folio?: string;
  customerName: string;
  contact: string;
  bikeBrand: string;
  bikeModel: string;
  serviceType: string;
  workItems: string[];
  deliveryDate: string;
  notes: string;
  status: BikeServiceStatus;
  source: BikeServiceSource;
  workOrderStatus?: WorkOrderStatus | undefined;
  createdAt: string;
  completedAt?: string | undefined;
  laborCost?: number;
  totalCost?: number;
}

export interface NewBikeServiceData {
  customerName: string;
  contact: string;
  bikeBrand: string;
  bikeModel: string;
  serviceType: string;
  deliveryDate: string;
  notes: string;
}

export const SERVICE_STATUS_LABELS: Record<BikeServiceStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  WAITING_PARTS: "En espera de repuestos",
  READY_FOR_DELIVERY: "Listo para entrega",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatServiceDate = (value: string): string => {
  if (!value) return "Sin programar";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "Sin programar";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(
    new Date(year, month - 1, day),
  );
};
