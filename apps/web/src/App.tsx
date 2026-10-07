import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type AuthenticatedUser } from "./services/api";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import "./components/dashboard/dashboard.css";

export function App() {
  const [token, setToken] = useState<string | null>(api.getToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const authSubmitting = useRef(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearAuthForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setError("");
    setShowPassword(false);
  };

  const logout = () => {
    api.setToken(null);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login");
  };

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const profile = await api.getCurrentUser();
      setCurrentUser(profile.user);
    } catch (err: any) {
      setError(err.message || "Error al sincronizar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();

      window.addEventListener("focus", loadData);
      return () => {
        window.removeEventListener("focus", loadData);
      };
    }
  }, [token]);

  const handleAuthentication = async (e: FormEvent) => {
    e.preventDefault();
    if (authSubmitting.current) return;
    authSubmitting.current = true;
    setError("");
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
      clearAuthForm();
      api.setToken(result.token);
      setToken(result.token);
    } catch (err: any) {
      setError(err.message || "No fue posible completar la solicitud");
    } finally {
      authSubmitting.current = false;
      setLoading(false);
    }
  };

  const handleServiceStatusChange = async (serviceId: string, nextStatus: string) => {
    setError("");
    try {
      await api.updateServiceStatus(serviceId, nextStatus);
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el estado del servicio");
      throw err;
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

          <form
            key={authMode === "register" ? "register" : "login"}
            className="auth-form"
            onSubmit={handleAuthentication}
            autoComplete="off"
          >
            {authMode === "register" && (
              <>
                <label htmlFor="auth-name">Nombre completo</label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="off"
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
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
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
                autoComplete="new-password"
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
                clearAuthForm();
                setAuthMode((mode) => (mode === "login" ? "register" : "login"));
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
    <DashboardPage
      userName={currentUser?.name ?? "Equipo del taller"}
      loading={loading}
      error={error}
      onLogout={logout}
      onUpdateServiceStatus={handleServiceStatusChange}
      onDeleteService={async (id) => {
        await api.deleteService(id);
      }}
      onEditService={async (id, payload) => {
        await api.updateService(id, payload);
        await loadData();
      }}
    />
  );
}

export default App;
