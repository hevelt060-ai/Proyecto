import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type WorkOrder, type WorkOrderStatus, type InventoryItem } from "./services/api";

const STATUS_COLUMNS: WorkOrderStatus[] = [
  "RECEIVED",
  "IN_DIAGNOSIS",
  "WAITING_PARTS",
  "IN_PROGRESS",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "DELIVERED",
];

export function App() {
  const [token, setToken] = useState<string | null>(api.getToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const authSubmitting = useRef(false);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "inventory">("orders");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serialNumber, setSerialNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [laborCost, setLaborCost] = useState(350);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [fetchedOrders, fetchedInventory] = await Promise.all([
        api.getWorkOrders(),
        api.getInventory(),
      ]);
      setOrders(fetchedOrders);
      setInventory(fetchedInventory);
    } catch (err: any) {
      setError(err.message || "Error al sincronizar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleAuthentication = async (e: FormEvent) => {
    e.preventDefault();
    if (authSubmitting.current) return;
    authSubmitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const result =
        authMode === "login"
          ? await api.login(email, password)
          : await api.register({
              name,
              email,
              password,
            });
      api.setToken(result.token);
      setToken(result.token);
    } catch (err: any) {
      setError(err.message || "No fue posible completar la solicitud");
    } finally {
      authSubmitting.current = false;
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!serialNumber || !brand || !model) return;
    try {
      await api.createWorkOrder({
        equipment: {
          serialNumber,
          brand,
          model,
          category: "MTB",
          customerId: "cust_general",
        },
        intakeChecklist: {
          damagesReported: [],
          suspensionLockWorking: true,
          initialCleanliness: "DIRTY",
        },
        laborCost: Number(laborCost),
      });
      setSerialNumber("");
      setBrand("");
      setModel("");
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: WorkOrderStatus) => {
    try {
      await api.transitionStatus(orderId, nextStatus, "Actualizado desde panel web");
      await loadData();
    } catch (err: any) {
      alert(`Error en transición: ${err.message}`);
    }
  };

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="presentation">
              <path
                d="M16 3.5 18.8 12l8.7-3.5-3.5 8.7 8.5 2.8-8.5 2.8 3.5 8.7-8.7-3.5L16 36.5l-2.8-8.5-8.7 3.5L8 22.8l-8.5-2.8L8 17.2 4.5 8.5l8.7 3.5L16 3.5Z"
                transform="translate(0 -4)"
              />
            </svg>
          </div>
          <p className="auth-eyebrow">TALLER ERP</p>
          <h1 id="auth-title">
            {authMode === "login" ? "Login to Workshop ERP" : "Create your account"}
          </h1>
          <p className="auth-subtitle">
            {authMode === "login"
              ? "Accede a tu espacio de trabajo y sigue con la operación."
              : "Registra tu taller y empieza a organizar el trabajo."}
          </p>

          <form className="auth-form" onSubmit={handleAuthentication}>
            {authMode === "register" && (
              <>
                <label htmlFor="auth-name">Nombre completo</label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                  disabled={loading}
                />
              </>
            )}
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
            <label htmlFor="auth-password">Contraseña</label>
            <div className="password-field">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={authMode === "register" ? 12 : 1}
                required
                disabled={loading}
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {showPassword ? (
                    <>
                      <path d="M3 3 21 21M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 4.7 9.5 6.2a1.5 1.5 0 0 1 0 1.6 15 15 0 0 1-3 3.4M6.2 6.2a15.6 15.6 0 0 0-3.7 5 1.5 1.5 0 0 0 0 1.6C3.4 14.3 6.8 19 12 19c1.1 0 2.1-.2 3-.6" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading && <span className="loading-spinner" aria-hidden="true" />}
              {loading
                ? authMode === "login"
                  ? "Iniciando sesión..."
                  : "Creando cuenta..."
                : authMode === "login"
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes una cuenta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setAuthMode((mode) => (mode === "login" ? "register" : "login"));
                setError(null);
              }}
            >
              {authMode === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #ccc",
          paddingBottom: 12,
        }}
      >
        <h1>Panel de Taller Técnico y Refacciones</h1>
        <div>
          <button
            onClick={() => setActiveTab("orders")}
            style={{ marginRight: 8, fontWeight: activeTab === "orders" ? "bold" : "normal" }}
          >
            Órdenes de Trabajo ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            style={{ marginRight: 16, fontWeight: activeTab === "inventory" ? "bold" : "normal" }}
          >
            Inventario ({inventory.length})
          </button>
          <button
            onClick={() => {
              api.setToken(null);
              setToken(null);
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: 12, margin: "12px 0" }}>
          {error}
        </div>
      )}

      {activeTab === "orders" ? (
        <section style={{ marginTop: 24 }}>
          <form
            onSubmit={handleCreateOrder}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 24,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div>
              <small>N° Serie</small>
              <input
                type="text"
                placeholder="SN102938"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <small>Marca</small>
              <input
                type="text"
                placeholder="Specialized"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
              />
            </div>
            <div>
              <small>Modelo</small>
              <input
                type="text"
                placeholder="Epic 8"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
              />
            </div>
            <div>
              <small>Mano de obra ($)</small>
              <input
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value))}
                required
              />
            </div>
            <button type="submit" style={{ padding: "6px 12px" }}>
              + Nueva Orden
            </button>
            <button type="button" onClick={loadData} disabled={loading}>
              Actualizar
            </button>
          </form>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${STATUS_COLUMNS.length}, 1fr)`,
              gap: 12,
              overflowX: "auto",
            }}
          >
            {STATUS_COLUMNS.map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div
                  key={status}
                  style={{ background: "#f5f5f5", padding: 8, borderRadius: 4, minWidth: 160 }}
                >
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: 13,
                      borderBottom: "1px solid #ddd",
                      paddingBottom: 4,
                    }}
                  >
                    {status} ({columnOrders.length})
                  </h4>
                  {columnOrders.map((order) => (
                    <article
                      key={order.id}
                      style={{
                        background: "#fff",
                        padding: 8,
                        marginBottom: 8,
                        borderRadius: 3,
                        border: "1px solid #e0e0e0",
                      }}
                    >
                      <strong>{order.folio}</strong>
                      <div style={{ fontSize: 12, color: "#555" }}>
                        {order.equipmentSnapshot?.brand} {order.equipmentSnapshot?.model}
                      </div>
                      <div style={{ fontSize: 12, margin: "4px 0" }}>Total: ${order.totalCost}</div>
                      <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {STATUS_COLUMNS.filter((s) => s !== order.status).map((targetStatus) => (
                          <button
                            key={targetStatus}
                            onClick={() => handleStatusChange(order.id, targetStatus)}
                            style={{ fontSize: 10, padding: "2px 4px", cursor: "pointer" }}
                          >
                            → {targetStatus}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ccc" }}>
                <th style={{ padding: 8 }}>SKU</th>
                <th style={{ padding: 8 }}>Descripción</th>
                <th style={{ padding: 8 }}>Marca</th>
                <th style={{ padding: 8 }}>Stock Actual</th>
                <th style={{ padding: 8 }}>Reservado</th>
                <th style={{ padding: 8 }}>Stock Disponible</th>
                <th style={{ padding: 8 }}>Precio Venta</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const available = item.currentStock - item.reservedStock;
                const isLow = available <= item.minStock;
                return (
                  <tr
                    key={item.sku}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: isLow ? "#fff3e0" : "transparent",
                    }}
                  >
                    <td style={{ padding: 8 }}>
                      <code>{item.sku}</code>
                    </td>
                    <td style={{ padding: 8 }}>{item.name}</td>
                    <td style={{ padding: 8 }}>{item.brand}</td>
                    <td style={{ padding: 8 }}>{item.currentStock}</td>
                    <td style={{ padding: 8 }}>{item.reservedStock}</td>
                    <td
                      style={{
                        padding: 8,
                        fontWeight: isLow ? "bold" : "normal",
                        color: isLow ? "#d84315" : "inherit",
                      }}
                    >
                      {available} {isLow && "(Bajo stock)"}
                    </td>
                    <td style={{ padding: 8 }}>${item.salePrice}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default App;
