import { useState } from "react";

import type { BikeService, BikeServiceStatus } from "./types";
import { formatServiceDate, SERVICE_STATUS_LABELS } from "./types";

type ServiceFilter = "ALL" | BikeServiceStatus;

interface PendingServicesCardProps {
  services: BikeService[];
  onSelectService: (service: BikeService) => void;
}

const FILTERS: { value: ServiceFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "IN_PROGRESS", label: "En proceso" },
  { value: "WAITING_PARTS", label: "Repuestos" },
  { value: "READY_FOR_DELIVERY", label: "Listos" },
];

const isActive = (service: BikeService): boolean =>
  service.status !== "COMPLETED" && service.status !== "CANCELLED";

export function PendingServicesCard({ services, onSelectService }: PendingServicesCardProps) {
  const [filter, setFilter] = useState<ServiceFilter>("ALL");
  const activeServices = services
    .filter(isActive)
    .filter((service) => filter === "ALL" || service.status === filter)
    .sort((first, second) => {
      if (!first.deliveryDate) return 1;
      if (!second.deliveryDate) return -1;
      return first.deliveryDate.localeCompare(second.deliveryDate);
    });

  return (
    <section className="dashboard-panel pending-panel" aria-labelledby="pending-heading">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">TALLER</p>
          <h2 id="pending-heading">Servicios activos</h2>
        </div>
        <span className="panel-count">{activeServices.length}</span>
      </div>

      <div className="service-filters" role="group" aria-label="Filtrar servicios por estado">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "filter-chip is-selected" : "filter-chip"}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="service-table-wrap">
        <table className="service-table">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente</th>
              <th>Bicicleta</th>
              <th>Servicio</th>
              <th>Entrega</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {activeServices.map((service) => (
              <tr key={service.id}>
                <td>
                  <button
                    className="service-folio-button"
                    type="button"
                    onClick={() => onSelectService(service)}
                  >
                    {service.folio}
                  </button>
                </td>
                <td>
                  <span className="table-primary-text">{service.customerName}</span>
                  {service.contact && (
                    <small className="table-secondary-text">{service.contact}</small>
                  )}
                </td>
                <td>
                  <span className="table-primary-text">
                    {service.bikeBrand} {service.bikeModel}
                  </span>
                </td>
                <td>{service.serviceType}</td>
                <td>{formatServiceDate(service.deliveryDate)}</td>
                <td>
                  <span className={`status-badge status-${service.status.toLowerCase()}`}>
                    <span className="status-dot" aria-hidden="true" />
                    {SERVICE_STATUS_LABELS[service.status]}
                  </span>
                </td>
              </tr>
            ))}
            {activeServices.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={6}>
                  No hay servicios para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
