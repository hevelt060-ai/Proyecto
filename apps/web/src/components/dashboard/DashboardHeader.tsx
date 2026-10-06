interface DashboardHeaderProps {
  userName: string;
  onAddService: () => void;
  onLogout: () => void;
}

export function DashboardHeader({ userName, onAddService, onLogout }: DashboardHeaderProps) {
  const firstName = userName.trim().split(/\s+/)[0] || "equipo";
  const today = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="dashboard-header">
      <div className="dashboard-brand">
        <span className="dashboard-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 2.5 14 9l6.5-2.5L18 13l6 2-6 2 2.5 6.5L14 21l-2 6-2-6-6.5 2.5L6 17l-6-2 6-2-2.5-6.5L10 9l2-6.5Z"
              transform="translate(0 -2.5) scale(.92)"
            />
          </svg>
        </span>
        <span>Workshop ERP</span>
      </div>
      <div className="dashboard-header-main">
        <div>
          <p className="dashboard-greeting">Hola, {firstName}</p>
          <p className="dashboard-current-date">{today}</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="button-primary" type="button" onClick={onAddService}>
            <span aria-hidden="true">+</span>
            Agregar servicio
          </button>
          <button className="button-quiet" type="button" onClick={onLogout}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3m9-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
            </svg>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
