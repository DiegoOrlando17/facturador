import { Link } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { usePortalResource } from "@/hooks/usePortalResource";
import { formatCurrency } from "@/lib/formatters";
import { getPaymentStatusLabel } from "@/lib/portalStatusLabels";

type PaymentSummary = {
  total: number;
  pending: number;
  failed: number;
  complete: number;
  totalAmount: number;
  statuses: Record<string, { count: number; amount: number }>;
};

type DashboardResponse = { payments: PaymentSummary };

export function ClientPortalPage() {
  const { user } = useTenantAuth();
  const {
    data: dashboard,
    isLoading: isFirstLoad,
    isRefreshing,
    errorMessage,
    lastLoadedAt: lastUpdatedAt,
    reload: loadDashboard,
  } = usePortalResource<DashboardResponse>("/portal/dashboard", {
    fallbackErrorMessage: "No pudimos cargar el resumen. Reintentá.",
  });
  const isLoading = isFirstLoad || isRefreshing;

  const payments = dashboard?.payments;
  const displayName = user?.email.split("@")[0] || "cliente";

  return (
    <main className="client-main">
      <header className="app-topbar">
        <div><strong>Hola, {displayName}</strong><span>Este es el resumen real de tu facturación.</span></div>
        <div className="app-topbar__actions">
          <span className="topbar-sync">{lastUpdatedAt ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "Sin actualizar"}</span>
          <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadDashboard()} disabled={isLoading}>
            <AppIcon name="refresh" /><span>{isLoading ? "Actualizando…" : "Actualizar"}</span>
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
          ["alert", "Con alertas", String(payments?.failed ?? 0), "Requieren revisión", "violet"],
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
          <div><strong>{payments?.failed ? "Hay operaciones para revisar" : "No hay alertas de facturación"}</strong><p>{payments?.total ? `${payments.total} pagos registrados para tu empresa.` : "Todavía no hay ventas para mostrar."}</p></div>
          <Link className="secondary-button" to="/portal-cliente/pagos">Ver pagos</Link>
        </section>
      ) : null}

      <section className="client-table-card">
        <div className="admin-section-heading"><h2>Resumen por estado</h2><Link to="/portal-cliente/pagos">Ver todos</Link></div>
        {payments && Object.keys(payments.statuses).length > 0 ? (
          <div className="client-status-grid">
            {Object.entries(payments.statuses).map(([status, item]) => (
              <article key={status}><span>{getPaymentStatusLabel(status)}</span><strong>{item.count}</strong><small>{formatCurrency(item.amount)}</small></article>
            ))}
          </div>
        ) : <p className="client-empty-state">{isLoading ? "Cargando actividad…" : "No hay actividad para mostrar."}</p>}
      </section>
    </main>
  );
}
