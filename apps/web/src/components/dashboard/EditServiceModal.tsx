import { useState, type FormEvent } from "react";
import type { BikeService } from "./types";

interface EditServiceModalProps {
  service: BikeService;
  onClose: () => void;
  onSave: (serviceId: string, payload: any) => Promise<void>;
}

const SERVICE_TYPES = [
  "Mantenimiento de suspensión",
  "Purgado de frenos",
  "Ajuste de cambios",
  "Servicio completo",
  "Diagnóstico general",
];

export function EditServiceModal({ service, onClose, onSave }: EditServiceModalProps) {
  const [customerName, setCustomerName] = useState(service.customerName);
  const [contact, setContact] = useState(service.contact);
  const [bikeBrand, setBikeBrand] = useState(service.bikeBrand);
  const [bikeModel, setBikeModel] = useState(service.bikeModel);
  const [serviceType, setServiceType] = useState(service.serviceType || SERVICE_TYPES[0]);
  const [deliveryDate, setDeliveryDate] = useState(service.deliveryDate.slice(0, 10));
  const [notes, setNotes] = useState(service.notes || "");
  const [laborCost, setLaborCost] = useState(service.laborCost?.toString() || "0");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave(service.id, {
        clientName: customerName,
        clientPhone: contact,
        bikeModel,
        serviceType,
        deliveryDate,
        notes,
        laborCost: Number(laborCost),
        totalCost: Number(laborCost),
      });
      onClose();
    } catch (err) {
      alert("Error al actualizar el servicio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="dashboard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-service-heading"
      >
        <div className="modal-heading">
          <div>
            <p className="panel-kicker">EDICIÓN</p>
            <h2 id="edit-service-heading">Editar Servicio: {service.folio}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form className="service-form" onSubmit={submit}>
          <label>
            Nombre del cliente
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
            />
          </label>
          <label>
            Teléfono o correo
            <input value={contact} onChange={(event) => setContact(event.target.value)} required />
          </label>
          <div className="form-field-row">
            <label>
              Marca
              <input
                value={bikeBrand}
                onChange={(event) => setBikeBrand(event.target.value)}
                required
              />
            </label>
            <label>
              Modelo
              <input
                value={bikeModel}
                onChange={(event) => setBikeModel(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-field-row">
            <label>
              Tipo de mantenimiento
              <select
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
                required
              >
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha de entrega
              <input
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Costo ($)
            <input
              type="number"
              value={laborCost}
              onChange={(event) => setLaborCost(event.target.value)}
              min="0"
              step="0.01"
              required
            />
          </label>
          <label>
            Notas técnicas
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="modal-actions">
            <button className="button-secondary" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
