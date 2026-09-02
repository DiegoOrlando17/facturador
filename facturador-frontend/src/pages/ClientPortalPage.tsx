import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { ApiError, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";

type PaymentSummary = {
  total: number;
  pending: number;
  failed: number;
  complete: number;
  totalAmount: number;
  statuses: Record<string, { count: number; amount: number }>;
};

type DashboardResponse = { payments: PaymentSummary };

const navigation: Array<{ label: string; icon: AppIconName; enabled: boolean }> = [
  { label: "Inicio", icon: "home", enabled: true },
  { label: "Pagos y facturas", icon: "payments", enabled: false },
  { label: "Reportes", icon: "reports", enabled: false },
  { label: "Datos fiscales", icon: "tax", enabled: false },
  { label: "Integraciones", icon: "integrations", enabled: false },
  { label: "Onboarding", icon: "onboarding", enabled: false },
];

export function ClientPortalPage() {
  const navigate = useNavigate();
  const { invalidateSession, logout, token, user } = useTenantAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await apiRequest<DashboardResponse>("/portal/dashboard", {
        token,
        skipAuthHandling: true,
      });
      setDashboard(response);
      setLastUpdatedAt(new Date());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        invalidateSession();
        navigate("/portal-cliente/login", { replace: true });
        return;
      }
      setErrorMessage(getApiErrorMessage(error, "No se pudo cargar el resumen."));
    } finally {
      setIsLoading(false);
    }
  }, [invalidateSession, navigate, token]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const payments = dashboard?.payments;
  const displayName = user?.email.split("@")[0] || "cliente";
  const initials = (user?.tenant?.name || user?.email || "FC").slice(0, 2).toUpperCase();

  return (
    <div className="client-portal-page">
      <aside className="client-sidebar">
        <div className="brand-lockup">
          <span className="app-logo"><AppIcon name="invoice" /></span>
          <div><strong>Facturador</strong><p>Portal del cliente</p></div>
        </div>
        <nav className="app-nav" aria-label="Portal cliente">
          {navigation.map((item) => (
            <button key={item.label} type="button" className={`app-nav__link${item.enabled ? " app-nav__link--active" : " client-nav-link--pending"}`} disabled={!item.enabled} title={item.enabled ? undefined : "Disponible en el proximo corte"}>
              <AppIcon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user-card">
          <span className="sidebar-user-card__avatar">{initials}</span>
          <div><strong>{user?.tenant?.name ?? "Empresa"}</strong><small>{user?.email}</small></div>
        </div>
        <button type="button" className="sidebar-logout-button" onClick={() => { logout(); navigate("/portal-cliente/login", { replace: true }); }}>
          <AppIcon name="logout" /><span>Cerrar sesion</span>
        </button>
      </aside>

      <main className="client-main">
        <header className="app-topbar">
          <div><strong>Hola, {displayName}</strong><span>Este es el resumen real de tu facturacion.</span></div>
          <div className="app-topbar__actions">
            <span className="topbar-sync">{lastUpdatedAt ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "Sin actualizar"}</span>
            <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadDashboard()} disabled={isLoading}>
              <AppIcon name="refresh" /><span>{isLoading ? "Actualizando..." : "Actualizar"}</span>
            </button>
          </div>
        </header>

        {errorMessage ? (
          <section className="client-success-card client-status-card--error" role="alert">
            <AppIcon name="alert" /><div><strong>No pudimos cargar el resumen</strong><p>{errorMessage}</p></div>
            <button type="button" className="secondary-button" onClick={() => void loadDashboard()}>Reintentar</button>
          </section>
        ) : null}

        <section className="client-kpi-grid" aria-busy={isLoading}>
          {[
            ["payments", "Importe procesado", formatCurrency(payments?.totalAmount), "Todos los pagos", "green"],
            ["invoice", "Procesados", String(payments?.complete ?? 0), "Flujo completado", "blue"],
            ["clock", "Pendientes", String(payments?.pending ?? 0), "Requieren procesamiento", "orange"],
            ["alert", "Con alertas", String(payments?.failed ?? 0), "Requieren revision", "violet"],
          ].map(([icon, label, value, detail, tone]) => (
            <article key={label} className={`client-kpi-card client-kpi-card--${tone}`}>
              <span><AppIcon name={icon as AppIconName} /></span><p>{label}</p>
              <strong>{isLoading && !dashboard ? "--" : value}</strong><small>{detail}</small>
            </article>
          ))}
        </section>

        {!errorMessage && !isLoading ? (
          <section className={`client-success-card${payments?.failed ? " client-status-card--warning" : ""}`}>
            <span><AppIcon name={payments?.failed ? "alert" : "check"} /></span>
            <div><strong>{payments?.failed ? "Hay operaciones para revisar" : "No hay alertas de facturacion"}</strong><p>{payments?.total ? `${payments.total} pagos registrados para tu empresa.` : "Todavia no hay pagos para mostrar."}</p></div>
          </section>
        ) : null}

        <section className="client-table-card">
          <div className="admin-section-heading"><h2>Resumen por estado</h2><span>{payments?.total ?? 0} pagos</span></div>
          {payments && Object.keys(payments.statuses).length > 0 ? (
            <div className="client-status-grid">
              {Object.entries(payments.statuses).map(([status, item]) => (
                <article key={status}><span>{status.replace(/_/g, " ")}</span><strong>{item.count}</strong><small>{formatCurrency(item.amount)}</small></article>
              ))}
            </div>
          ) : <p className="client-empty-state">{isLoading ? "Cargando actividad..." : "No hay actividad para mostrar."}</p>}
        </section>
      </main>
    </div>
  );
}
