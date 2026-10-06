import type { BikeService, BikeServiceStatus } from "./types";
import { SERVICE_STATUS_LABELS } from "./types";

interface ServiceDetailModalProps {
  services: BikeService[];
  onClose: () => void;
  onStatusChange: (service: BikeService, status: BikeServiceStatus) => void;
  onEdit?: (service: BikeService) => void;
  onDelete?: (service: BikeService) => void;
}

const STATUS_OPTIONS: BikeServiceStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "READY_FOR_DELIVERY",
];

export function ServiceDetailModal({ services, onClose, onStatusChange }: ServiceDetailModalProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="dashboard-modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-detail-heading"
      >
        <div className="modal-heading">
          <div>
            <p className="panel-kicker">DETALLE DE ENTREGA</p>
            <h2 id="service-detail-heading">
              {services.length === 1
                ? services[0]?.folio
                : `${services.length} servicios programados`}
            </h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="detail-service-list">
          {services.map((service) => (
            <article className="detail-service" key={service.id}>
              <div className="detail-service-topline">
                <div>
                  <h3>{service.customerName}</h3>
                  <p>
                    {service.bikeBrand} {service.bikeModel}
                  </p>
                </div>
                <span className={`status-badge status-${service.status.toLowerCase()}`}>
                  <span className="status-dot" aria-hidden="true" />
                  {SERVICE_STATUS_LABELS[service.status]}
                </span>
              </div>
              {service.contact && <p className="detail-contact">{service.contact}</p>}
              <div className="work-list-block">
                <h4>Trabajos a ejecutar</h4>
                <ul>
                  {service.workItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {service.notes && <p className="detail-notes">{service.notes}</p>}
              <label className="status-select-label">
                Actualizar estado
                <select
                  value={service.status}
                  onChange={(event) =>
                    onStatusChange(service, event.target.value as BikeServiceStatus)
                  }
                >
                  {[...new Set([...STATUS_OPTIONS, service.status])].map((status) => (
                    <option key={status} value={status}>
                      {SERVICE_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
