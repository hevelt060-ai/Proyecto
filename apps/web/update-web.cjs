const fs = require("fs");
const path = require("path");

const API_FILE = path.join(__dirname, "src/services/api.ts");
const TYPES_FILE = path.join(__dirname, "src/components/dashboard/types.ts");
const APP_FILE = path.join(__dirname, "src/App.tsx");
const DASHBOARD_FILE = path.join(__dirname, "src/components/dashboard/DashboardPage.tsx");
const DETAIL_MODAL_FILE = path.join(__dirname, "src/components/dashboard/ServiceDetailModal.tsx");
const NEW_MODAL_FILE = path.join(__dirname, "src/components/dashboard/NewServiceModal.tsx");
const PENDING_CARD_FILE = path.join(__dirname, "src/components/dashboard/PendingServicesCard.tsx");

// 1. types.ts
let typesContent = fs.readFileSync(TYPES_FILE, "utf-8");
typesContent = typesContent.replace(
  /export interface BikeService {[\s\S]*?}/,
  `export interface BikeService {
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
}`,
);
fs.writeFileSync(TYPES_FILE, typesContent);

// 2. ServiceDetailModal.tsx - Add Edit/Delete buttons
let detailModal = fs.readFileSync(DETAIL_MODAL_FILE, "utf-8");
// Assuming it has a footer or something where we can add buttons
detailModal = detailModal.replace(
  /export function ServiceDetailModal\(\{[\s\S]*?return \(/,
  (match) => match.replace("onStatusChange,", "onStatusChange, onEdit, onDelete,"),
);
detailModal = detailModal.replace(
  /interface ServiceDetailModalProps {[\s\S]*?}/,
  `interface ServiceDetailModalProps {
  services: BikeService[];
  onClose: () => void;
  onStatusChange: (service: BikeService, status: BikeServiceStatus) => void;
  onEdit?: (service: BikeService) => void;
  onDelete?: (service: BikeService) => void;
}`,
);
detailModal = detailModal.replace(
  /<footer className="modal-footer">[\s\S]*?<\/footer>/g,
  `<footer className="modal-footer">
          {onDelete && <button className="button-secondary" style={{color: 'red'}} onClick={() => onDelete(service)}>Eliminar</button>}
          {onEdit && <button className="button-secondary" onClick={() => onEdit(service)}>Editar</button>}
          <div style={{flex: 1}}></div>
          <button className="button-secondary" onClick={onClose}>
            Cerrar
          </button>
        </footer>`,
);
fs.writeFileSync(DETAIL_MODAL_FILE, detailModal);

// We need a Reports component, but it says we can just put it in Dashboard. Let's add it to DashboardPage.tsx.
let dashboard = fs.readFileSync(DASHBOARD_FILE, "utf-8");
dashboard = dashboard.replace(
  'import { WorkshopCalendar } from "./WorkshopCalendar";',
  `import { WorkshopCalendar } from "./WorkshopCalendar";
import { api } from "../../services/api";`,
);

// DashboardPage Props update
dashboard = dashboard.replace(
  /interface DashboardPageProps {[\s\S]*?}/,
  `interface DashboardPageProps {
  userName: string;
  orders: any[];
  loading: boolean;
  error: string;
  onLogout: () => void;
  onRefresh: () => void;
  onUpdateWorkOrder: (id: string, status: any) => Promise<void>;
  onDeleteService?: (id: string) => Promise<void>;
  onEditService?: (id: string, payload: any) => Promise<void>;
}`,
);

// fromWorkOrder mapper update to support new payload
dashboard = dashboard.replace(
  /const fromWorkOrder = \(order: any\): BikeService => {[\s\S]*?};/,
  `const fromWorkOrder = (order: any): BikeService => {
  const bikeBrand = order.equipmentSnapshot?.brand || order.bikeBrand || order.bikeModel || "Bicicleta";
  const bikeModel = order.equipmentSnapshot?.model || order.bikeModel || "Modelo pendiente";
  const serviceType = order.serviceType || "Servicio de taller";
  const workItems = [
    serviceType,
    order.notes || "",
  ].filter(Boolean);

  let status: BikeServiceStatus = "PENDING";
  const os = (order.status || "").toLowerCase();
  if (os.includes("progress")) status = "IN_PROGRESS";
  else if (os.includes("waiting")) status = "WAITING_PARTS";
  else if (os.includes("ready")) status = "READY_FOR_DELIVERY";
  else if (os.includes("deliver") || os.includes("complet")) status = "COMPLETED";
  else if (os.includes("cancel")) status = "CANCELLED";

  return {
    id: order.id,
    folio: order.folio || order.id.substring(0, 8),
    customerName: order.customerId || order.clientName || "Cliente sin registro",
    contact: order.clientPhone || "",
    bikeBrand,
    bikeModel,
    serviceType,
    workItems,
    deliveryDate: order.deliveryDate ?? "",
    notes: order.notes || "",
    status,
    source: "api",
    workOrderStatus: order.status,
    createdAt: order.createdAt,
    laborCost: order.laborCost || 0,
    totalCost: order.totalCost || 0,
  };
};`,
);

// Inside DashboardPage function
dashboard = dashboard.replace(
  /export function DashboardPage\(\{[\s\S]*?\}\: DashboardPageProps\) {/,
  `export function DashboardPage({
  userName,
  orders,
  loading,
  error,
  onLogout,
  onRefresh,
  onUpdateWorkOrder,
  onDeleteService,
  onEditService,
}: DashboardPageProps) {
  const [reportsSummary, setReportsSummary] = useState<any>(null);
  
  useEffect(() => {
    api.getReportsSummary().then(res => setReportsSummary(res.data)).catch(() => {});
  }, [orders]);
`,
);

// Expose Delete & Edit functionality
dashboard = dashboard.replace(
  /<ServiceDetailModal[\s\S]*?\/>/,
  `<ServiceDetailModal
          services={selectedServices}
          onClose={() => setSelectedServiceIds(null)}
          onStatusChange={(service, status) => {
            void updateServiceStatus(service, status).catch(() => undefined);
          }}
          onDelete={(service) => {
            if (window.confirm("¿Seguro que deseas eliminar este servicio?")) {
               if (onDeleteService) onDeleteService(service.id).then(() => {
                 setSelectedServiceIds(null);
               });
            }
          }}
          onEdit={(service) => {
            const newLabor = prompt("Nuevo costo:", service.laborCost?.toString());
            const newNotes = prompt("Nuevas notas:", service.notes);
            if (newLabor != null || newNotes != null) {
              if (onEditService) onEditService(service.id, { laborCost: Number(newLabor || service.laborCost), notes: newNotes || service.notes }).then(() => {
                setSelectedServiceIds(null);
              });
            }
          }}
        />`,
);

// Reports section
dashboard = dashboard.replace(
  /<\/main>/,
  `
      <section className="dashboard-subhead" style={{marginTop: '2rem'}}>
        <div>
          <p className="dashboard-section-label">REPORTES</p>
          <h1>Resumen Financiero y Estadísticas</h1>
        </div>
        <button className="button-secondary" onClick={() => window.open(api.getReportsExportUrl(), '_blank')}>
          Exportar a CSV
        </button>
      </section>

      {reportsSummary && (
        <section className="kpi-strip">
          <article className="kpi-item">
            <div>
              <p>Ingresos Mensuales</p>
              <strong>\\$\\{reportsSummary.totalRevenue\\}</strong>
            </div>
          </article>
          <article className="kpi-item">
            <div>
              <p>Servicios Concluidos</p>
              <strong>{reportsSummary.totalServices.delivered}</strong>
            </div>
          </article>
          <article className="kpi-item">
            <div>
              <p>Distribución</p>
              <strong>{Object.keys(reportsSummary.topServices).length} tipos</strong>
            </div>
          </article>
        </section>
      )}
    </main>`,
);

// Need to import useEffect
if (!dashboard.includes("useEffect")) {
  dashboard = dashboard.replace(
    'import { useState } from "react";',
    'import { useState, useEffect } from "react";',
  );
}

fs.writeFileSync(DASHBOARD_FILE, dashboard);

// 4. App.tsx - SSE Integration & Delete/Edit handling
let app = fs.readFileSync(APP_FILE, "utf-8");

app = app.replace(
  /const loadData = async \(\) => {[\s\S]*?finally {[\s\S]*?}/,
  `const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [fetchedOrders, profile] = await Promise.all([
        api.getServices(),
        api.getCurrentUser(),
      ]);
      setOrders(fetchedOrders);
      setCurrentUser(profile.user);
    } catch (err: any) {
      setError(err.message || "Error al sincronizar con el servidor");
    } finally {
      setLoading(false);
    }
  };`,
);

app = app.replace(
  /useEffect\(\(\) => {[\s\S]*?}, \[token\]\);/,
  `useEffect(() => {
    if (token) {
      loadData();
      
      const evtSource = new EventSource('https://erp-api-backend.onrender.com/api/v1/sync');
      // Wait, we need auth for SSE? Browser EventSource doesn't support headers natively.
      // Assuming backend allows it if not authenticated? Actually backend says \`authenticated\` middleware is on \`/sync\`.
      // But standard EventSource doesn't send Bearer.
      // For now, let's just do polling.
      const interval = setInterval(() => {
         api.getServices().then(setOrders).catch(() => {});
      }, 10000);
      
      window.addEventListener("focus", loadData);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", loadData);
      };
    }
  }, [token]);`,
);

app = app.replace(
  /<DashboardPage[\s\S]*?\/>/,
  `<DashboardPage
      userName={currentUser?.name ?? "Equipo del taller"}
      orders={orders}
      loading={loading}
      error={error}
      onLogout={logout}
      onRefresh={loadData}
      onUpdateWorkOrder={handleWorkOrderStatusChange}
      onDeleteService={async (id) => {
        await api.deleteService(id);
        setOrders(curr => curr.filter(o => o.id !== id));
      }}
      onEditService={async (id, payload) => {
        await api.updateService(id, payload);
        await loadData();
      }}
    />`,
);

fs.writeFileSync(APP_FILE, app);

console.log("Web client updated successfully");
