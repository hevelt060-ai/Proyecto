import { useEffect, useState, type FormEvent } from "react";
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
  const [email, setEmail] = useState("admin@taller.local");
  const [password, setPassword] = useState("");
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

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.login(email, password);
      api.setToken(result.token);
      setToken(result.token);
    } catch (err: any) {
      setError(err.message || "Credenciales inválidas");
    } finally {
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
      <main style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 400, margin: "60px auto" }}>
        <h2>Taller ERP - Autenticación</h2>
        {error && <p style={{ color: "#d32f2f" }}>{error}</p>}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <button type="submit" disabled={loading} style={{ padding: 10, cursor: "pointer" }}>
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>
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
