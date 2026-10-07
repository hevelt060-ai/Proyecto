import { useState, type FormEvent } from "react";

import type { NewBikeServiceData } from "./types";

interface NewServiceModalProps {
  onClose: () => void;
  onCreate: (service: NewBikeServiceData) => Promise<void>;
}

const SERVICE_TYPES = [
  "Mantenimiento de suspensión",
  "Purgado de frenos",
  "Ajuste de cambios",
  "Servicio completo",
  "Diagnóstico general",
];

export function NewServiceModal({ onClose, onCreate }: NewServiceModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [bikeBrand, setBikeBrand] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0] ?? "");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      await onCreate({
        customerName,
        contact,
        bikeBrand,
        bikeModel,
        serviceType,
        deliveryDate,
        notes,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear el servicio");
    } finally {
      setIsSubmitting(false);
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
        aria-labelledby="new-service-heading"
      >
        <div className="modal-heading">
          <div>
            <p className="panel-kicker">NUEVA ORDEN</p>
            <h2 id="new-service-heading">Agregar servicio</h2>
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
              autoComplete="name"
              required
            />
          </label>
          <label>
            Teléfono o correo
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              autoComplete="off"
              required
            />
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
                min={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
          </div>
          <label>
            Notas técnicas
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Hallazgos, piezas o indicaciones para el taller"
            />
          </label>
          {submitError && (
            <p className="dashboard-error" role="alert">
              {submitError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button-secondary"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button className="button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Crear servicio"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
