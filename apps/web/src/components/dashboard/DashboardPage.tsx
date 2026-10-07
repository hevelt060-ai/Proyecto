import { useState, useEffect } from "react";

import type { SavedReport, ServiceRecord } from "../../services/api";
import type { BikeService, BikeServiceStatus, NewBikeServiceData } from "./types";
import { toLocalDateKey } from "./types";
import { DashboardHeader } from "./DashboardHeader";
import { NewServiceModal } from "./NewServiceModal";
import { EditServiceModal } from "./EditServiceModal";
import { PendingServicesCard } from "./PendingServicesCard";
import { ServiceDetailModal } from "./ServiceDetailModal";
import { WorkshopCalendar } from "./WorkshopCalendar";
import { api } from "../../services/api";

interface DashboardPageProps {
  userName: string;
  loading: boolean;
  error: string;
  onLogout: () => void;
  onUpdateServiceStatus: (id: string, status: BikeServiceStatus) => Promise<void>;
  onDeleteService?: (id: string) => Promise<void>;
  onEditService?: (id: string, payload: any) => Promise<void>;
}

const fromServiceRecord = (record: ServiceRecord): BikeService => {
  const status = record.status.toLowerCase();
  const serviceStatus: BikeServiceStatus =
    status === "in_progress" ||
    status === "waiting_parts" ||
    status === "ready_for_delivery" ||
    status === "completed" ||
    status === "cancelled"
      ? (status.toUpperCase() as BikeServiceStatus)
      : "PENDING";

  return {
    id: record.id,
    folio: record.folio ?? record.id.slice(0, 8).toUpperCase(),
    customerName: record.clientName,
    contact: record.clientPhone,
    bikeBrand: "Bicicleta",
    bikeModel: record.bikeModel,
    serviceType: record.serviceType,
    workItems: [record.serviceType, ...(record.notes.trim() ? [record.notes.trim()] : [])],
    deliveryDate: record.deliveryDate,
    notes: record.notes,
    status: serviceStatus,
    source: "api",
    createdAt: record.createdAt,
    laborCost: record.laborCost,
    totalCost: record.totalCost,
    paymentStatus: record.paymentStatus,
    ...(serviceStatus === "COMPLETED" && record.updatedAt ? { completedAt: record.updatedAt } : {}),
  };
};

export function exportServicesToCSV(services: BikeService[]) {
  const headers = [
    "Folio",
    "Cliente",
    "Teléfono",
    "Bicicleta",
    "Servicio",
    "Costo",
    "Estado",
    "Estado Pago",
    "Fecha Entrega",
    "Fecha Registro",
  ];
  const escapeCsvValue = (value: string | number | undefined | null) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = services.map((service) =>
    [
      service.folio || service.id,
      service.customerName,
      service.contact,
      [service.bikeBrand, service.bikeModel].filter(Boolean).join(" "),
      service.serviceType,
      service.totalCost ?? service.laborCost ?? 0,
      service.status,
      service.paymentStatus || "pendiente",
      service.deliveryDate,
      service.createdAt,
    ]
      .map(escapeCsvValue)
      .join(","),
  );
  const csvContent = [headers.map(escapeCsvValue).join(","), ...rows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `reporte_taller_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function DashboardPage({
  userName,
  loading,
  error,
  onLogout,
  onUpdateServiceStatus,
  onDeleteService,
  onEditService,
}: DashboardPageProps) {
  const [reportsSummary, setReportsSummary] = useState<any>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isReportSnapshotReady, setIsReportSnapshotReady] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    const loadReportData = async () => {
      const [summaryResult, reportsResult, expensesResult] = await Promise.allSettled([
        api.getReportsSummary(),
        api.getSavedReports(),
        api.getExpenses(),
      ]);

      if (summaryResult.status === "fulfilled") {
        setReportsSummary(summaryResult.value.data);
      } else {
        setReportError("No se pudieron cargar los ingresos del reporte");
      }
      if (reportsResult.status === "fulfilled") {
        setSavedReports(reportsResult.value);
      } else {
        setReportError("No se pudo cargar el historial de reportes");
      }
      if (expensesResult.status === "fulfilled") {
        setExpenses(Array.isArray(expensesResult.value) ? expensesResult.value : []);
      } else {
        setReportError("No se pudieron cargar los gastos del reporte");
      }
      setIsReportSnapshotReady(
        summaryResult.status === "fulfilled" && expensesResult.status === "fulfilled",
      );
    };

    void loadReportData();
  }, []);

  const [services, setServices] = useState<BikeService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [isNewServiceOpen, setIsNewServiceOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<BikeService | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[] | null>(null);

  const loadServices = async () => {
    setServicesLoading(true);
    setServicesError("");
    try {
      const records = await api.getServices();
      setServices(records.map(fromServiceRecord));
    } catch (loadError) {
      setServicesError(
        loadError instanceof Error ? loadError.message : "No se pudieron cargar los servicios",
      );
    } finally {
      setServicesLoading(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  const selectedServices = selectedServiceIds
    ? services.filter((service) => selectedServiceIds.includes(service.id))
    : [];
  const activeServices = services.filter(
    (service) => service.status !== "COMPLETED" && service.status !== "CANCELLED",
  );
  const todayKey = toLocalDateKey(new Date());
  const thisMonth = new Date();
  const completedThisMonth = services.filter((service) => {
    if (service.status !== "COMPLETED") return false;
    const completedDate = new Date(service.completedAt ?? service.createdAt);
    return (
      completedDate.getFullYear() === thisMonth.getFullYear() &&
      completedDate.getMonth() === thisMonth.getMonth()
    );
  }).length;
  const totalExpenses = expenses.reduce(
    (total, expense) => total + (Number(expense.amount) || 0),
    0,
  );

  const saveCurrentReport = async () => {
    if (isSavingReport || !isReportSnapshotReady || servicesLoading) return;
    const today = toLocalDateKey(new Date());
    const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
      new Date(),
    );
    const title = prompt("Nombre del reporte:", `Cierre de mes - ${monthName}`)?.trim();
    if (!title) return;

    setIsSavingReport(true);
    setReportMessage("");
    setReportError("");
    try {
      const reportDates = [
        ...services.map((service) => service.createdAt.slice(0, 10)),
        ...expenses.map((expense) => String(expense.date ?? expense.createdAt ?? "").slice(0, 10)),
      ].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      const periodStart = reportDates.sort()[0] ?? today;
      const byStatus: Record<string, number> = {};
      const byType: Record<string, number> = {};
      for (const service of services) {
        byStatus[service.status] = (byStatus[service.status] ?? 0) + 1;
        byType[service.serviceType] = (byType[service.serviceType] ?? 0) + 1;
      }
      const totalRevenue = Number(reportsSummary?.totalRevenue) || 0;

      await api.saveReport({
        title,
        periodStart,
        periodEnd: today,
        totalRevenue,
        totalExpenses,
        netBalance: totalRevenue - totalExpenses,
        totalServicesCount: services.length,
        breakdown: { byStatus, byType },
      });
      setReportMessage("Reporte archivado correctamente");
      try {
        setSavedReports(await api.getSavedReports());
      } catch {
        setReportError("Reporte archivado, pero no se pudo actualizar el historial");
      }
    } catch (saveError) {
      setReportError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar el reporte",
      );
    } finally {
      setIsSavingReport(false);
    }
  };

  const createService = async (data: NewBikeServiceData) => {
    const created = await api.createService({
      clientName: data.customerName,
      clientPhone: data.contact,
      bikeModel: [data.bikeBrand, data.bikeModel].filter(Boolean).join(" "),
      serviceType: data.serviceType,
      deliveryDate: data.deliveryDate,
      notes: data.notes || "",
      status: "pending",
    });
    setServices((current) => [fromServiceRecord(created), ...current]);
    setIsNewServiceOpen(false);
  };

  const updateServiceStatus = async (service: BikeService, status: BikeServiceStatus) => {
    if (service.status === status) return;
    await onUpdateServiceStatus(service.id, status);
    setServices((current) =>
      current.map((item) => (item.id === service.id ? { ...item, status } : item)),
    );
  };

  return (
    <main className="dashboard-page">
      <DashboardHeader
        userName={userName}
        onAddService={() => setIsNewServiceOpen(true)}
        onLogout={onLogout}
      />

      <div className="dashboard-subhead">
        <div>
          <p className="dashboard-section-label">RESUMEN DEL TALLER</p>
          <h1>Operación diaria</h1>
        </div>
        <button
          className="refresh-button"
          type="button"
          onClick={() => void loadServices()}
          disabled={loading || servicesLoading}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M5.6 9a7 7 0 0 1 11.9-2L20 12M4 12l2.5 5a7 7 0 0 0 11.9-2" />
          </svg>
          Actualizar
        </button>
      </div>

      {error && (
        <p className="dashboard-error" role="alert">
          {error}
        </p>
      )}
      {servicesError && (
        <p className="dashboard-error" role="alert">
          {servicesError}
        </p>
      )}
      {servicesLoading && <p role="status">Cargando servicios...</p>}

      <section className="kpi-strip" aria-label="Indicadores del taller">
        <article className="kpi-item">
          <span className="kpi-icon kpi-icon-lime" aria-hidden="true">
            ↻
          </span>
          <div>
            <p>Servicios pendientes</p>
            <strong>{services.filter((item) => item.status === "PENDING").length}</strong>
          </div>
        </article>
        <article className="kpi-item">
          <span className="kpi-icon kpi-icon-red" aria-hidden="true">
            ◷
          </span>
          <div>
            <p>Entregas para hoy</p>
            <strong>
              {activeServices.filter((item) => item.deliveryDate.slice(0, 10) === todayKey).length}
            </strong>
          </div>
        </article>
        <article className="kpi-item">
          <span className="kpi-icon kpi-icon-amber" aria-hidden="true">
            ⌑
          </span>
          <div>
            <p>En espera de repuestos</p>
            <strong>{services.filter((item) => item.status === "WAITING_PARTS").length}</strong>
          </div>
        </article>
        <article className="kpi-item">
          <span className="kpi-icon kpi-icon-green" aria-hidden="true">
            ✓
          </span>
          <div>
            <p>Finalizados este mes</p>
            <strong>{completedThisMonth}</strong>
          </div>
        </article>
      </section>

      <div className="dashboard-content-grid">
        <PendingServicesCard
          services={services}
          onSelectService={(service) => setSelectedServiceIds([service.id])}
        />
        <WorkshopCalendar
          services={services}
          onSelectDeliveries={(_date, dayServices) =>
            setSelectedServiceIds(dayServices.map((service) => service.id))
          }
        />
      </div>

      {isNewServiceOpen && (
        <NewServiceModal onClose={() => setIsNewServiceOpen(false)} onCreate={createService} />
      )}
      {serviceToEdit && onEditService && (
        <EditServiceModal
          service={serviceToEdit}
          onClose={() => setServiceToEdit(null)}
          onSave={async (id, payload) => {
            await onEditService(id, payload);
            await loadServices();
          }}
        />
      )}
      {selectedServiceIds && selectedServices.length > 0 && (
        <ServiceDetailModal
          services={selectedServices}
          onClose={() => setSelectedServiceIds(null)}
          onStatusChange={(service, status) => {
            void updateServiceStatus(service, status).catch((statusError) => {
              setServicesError(
                statusError instanceof Error
                  ? statusError.message
                  : "No se pudo actualizar el estado",
              );
            });
          }}
          onDelete={(service) => {
            if (window.confirm("¿Seguro que deseas eliminar este servicio?")) {
              if (onDeleteService) {
                onDeleteService(service.id)
                  .then(() => {
                    setServices((current) => current.filter((item) => item.id !== service.id));
                    setSelectedServiceIds(null);
                  })
                  .catch((deleteError) => {
                    setServicesError(
                      deleteError instanceof Error
                        ? deleteError.message
                        : "No se pudo eliminar el servicio",
                    );
                  });
              }
            }
          }}
          onEdit={(service) => {
            setServiceToEdit(service);
            setSelectedServiceIds(null);
          }}
        />
      )}

      <section className="dashboard-subhead" style={{ marginTop: "2rem" }}>
        <div>
          <p className="dashboard-section-label">REPORTES</p>
          <h1>Resumen Financiero y Estadísticas</h1>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={() => exportServicesToCSV(services)}
        >
          Exportar a CSV
        </button>
        <button
          className="button-primary"
          style={{ marginLeft: "1rem" }}
          type="button"
          onClick={() => void saveCurrentReport()}
          disabled={isSavingReport || !isReportSnapshotReady || servicesLoading}
        >
          {isSavingReport ? "Guardando..." : "Guardar reporte"}
        </button>
      </section>
      {reportMessage && <p role="status">{reportMessage}</p>}
      {reportError && (
        <p className="dashboard-error" role="alert">
          {reportError}
        </p>
      )}

      {reportsSummary && (
        <section className="kpi-strip">
          <article className="kpi-item">
            <div>
              <p>Ingresos Mensuales</p>
              <strong>${reportsSummary.totalRevenue}</strong>
            </div>
          </article>
          <article className="kpi-item">
            <div>
              <p>Gastos Totales</p>
              <strong style={{ color: "#DC2626" }}>${totalExpenses}</strong>
            </div>
          </article>
          <article className="kpi-item">
            <div>
              <p>Balance Neto</p>
              <strong style={{ color: "#16A34A" }}>
                ${reportsSummary.totalRevenue - totalExpenses}
              </strong>
            </div>
          </article>
          <article className="kpi-item">
            <div>
              <p>Servicios Concluidos</p>
              <strong>{reportsSummary.totalServices.delivered}</strong>
            </div>
          </article>
        </section>
      )}

      {savedReports.length > 0 && (
        <section className="dashboard-subhead" style={{ marginTop: "2rem" }}>
          <div>
            <p className="dashboard-section-label">HISTORIAL</p>
            <h1>Reportes Guardados</h1>
          </div>
          <div style={{ width: "100%", marginTop: "1rem" }}>
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <th style={{ padding: "0.5rem" }}>Título</th>
                  <th style={{ padding: "0.5rem" }}>Fecha</th>
                  <th style={{ padding: "0.5rem" }}>Ingresos</th>
                  <th style={{ padding: "0.5rem" }}>Concluidos</th>
                </tr>
              </thead>
              <tbody>
                {savedReports.map((report) => (
                  <tr key={report.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "0.5rem" }}>{report.title}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      ${report.totalRevenue ?? report.data?.totalRevenue ?? 0}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {report.breakdown?.byStatus?.COMPLETED ??
                        report.data?.totalServices?.delivered ??
                        0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
