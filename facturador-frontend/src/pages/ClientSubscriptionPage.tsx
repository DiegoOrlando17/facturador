import { useState } from "react";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { formatDateTime, formatMoney } from "@/lib/formatters";

type Billing = {
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | string;
  billingStatus: string | null;
  billingProvider: string | null;
  amount: number | string | null;
  currency: string | null;
  exchangeRate: number | string | null;
  exchangeRateAt: string | null;
  plan: { name: string; price: number | string; currency: string };
};

type SubscriptionAction = "pause" | "resume" | "cancel";

const statusPresentation: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Al día", tone: "success" },
  PAST_DUE: { label: "Pago pendiente", tone: "warning" },
  CANCELED: { label: "Cancelada", tone: "danger" },
};

const billingStatusLabels: Record<string, string> = {
  authorized: "Débito automático activo",
  paused: "Débito automático pausado",
  pending: "Esperando la adhesión de la tarjeta",
  cancelled: "Débito automático cancelado",
};

const actionCopy: Record<SubscriptionAction, { question: string; consequence: string; confirm: string; success: string }> = {
  pause: {
    question: "¿Pausás el débito automático?",
    consequence: "No se van a hacer nuevos cobros hasta que lo reactives.",
    confirm: "Sí, pausar",
    success: "Listo, pausamos el débito automático.",
  },
  resume: {
    question: "¿Reactivás el débito automático?",
    consequence: "Mercado Pago va a volver a cobrar el plan todos los meses.",
    confirm: "Sí, reactivar",
    success: "Listo, reactivamos el débito automático.",
  },
  cancel: {
    question: "¿Cancelás la suscripción?",
    consequence: "La cancelación es definitiva: para volver a usar el servicio vas a tener que adherir la tarjeta de nuevo.",
    confirm: "Sí, cancelar suscripción",
    success: "Cancelamos la suscripción.",
  },
};

export function ClientSubscriptionPage() {
  const { user } = useTenantAuth();
  const api = usePortalApi();
  const { data: billing, isLoading, isRefreshing, errorMessage: loadError, reload } = usePortalResource<Billing | null>(
    "/portal/subscription/billing",
    { fallbackErrorMessage: "No pudimos cargar tu suscripción. Reintentá." },
  );
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<SubscriptionAction | null>(null);
  const canManage = user?.role === "owner" || user?.role === "admin";

  async function checkout() {
    setBusy(true);
    setActionError("");
    setSuccessMessage("");
    try {
      const result = await api.request<{ checkoutUrl: string }>("/portal/subscription/checkout", { method: "POST" });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos iniciar el pago con Mercado Pago. Reintentá."));
      setBusy(false);
    }
  }

  async function confirmChange(action: SubscriptionAction) {
    setBusy(true);
    setActionError("");
    setSuccessMessage("");
    try {
      await api.request(`/portal/subscription/${action}`, { method: "POST" });
      setPendingAction(null);
      setSuccessMessage(actionCopy[action].success);
      await reload();
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos actualizar la suscripción. Reintentá."));
    } finally {
      setBusy(false);
    }
  }

  const status = billing ? statusPresentation[billing.status] ?? { label: "En revisión", tone: "muted" } : null;
  const billingStatusLabel = billing?.billingStatus ? billingStatusLabels[billing.billingStatus] ?? "Débito automático en revisión" : null;

  return (
    <main className="client-main">
      <header className="app-topbar">
        <div>
          <strong>Plan y suscripción</strong>
          <span>Administrá el débito mensual con Mercado Pago.</span>
        </div>
        <button type="button" className="secondary-button" onClick={() => void reload()} disabled={isLoading || isRefreshing}>
          {isRefreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
      {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}

      {isLoading ? (
        <section className="panel"><div className="panel-state"><strong>Cargando tu suscripción…</strong></div></section>
      ) : loadError ? (
        <section className="panel">
          <div className="panel-state panel-state--danger" role="alert">
            <strong>No pudimos cargar tu suscripción</strong>
            <span>{loadError}</span>
            <button type="button" className="secondary-button" onClick={() => void reload()}>Reintentar</button>
          </div>
        </section>
      ) : !billing ? (
        <section className="panel">
          <div className="panel-state">
            <strong>Todavía no tenés un plan asignado</strong>
            <span>Cuando el equipo de Facturador active tu plan, lo vas a ver acá junto con el débito mensual.</span>
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="section-subheading">
            <span className="eyebrow">Plan vigente</span>
            <h2>{billing.plan.name}</h2>
          </div>
          <div className="subscription-summary">
            <strong>{formatMoney(billing.plan.price, billing.plan.currency)} por mes</strong>
            <p>El cobro se hace en pesos, al tipo de cambio vendedor billete del Banco Nación.</p>
            {status ? <span className={`status-pill status-pill--${status.tone}`}>{status.label}</span> : null}
            {billingStatusLabel ? <p>{billingStatusLabel}</p> : null}
            {billing.amount ? (
              <p>
                Próximo importe configurado: {formatMoney(billing.amount, billing.currency ?? "ARS")}
                {billing.exchangeRate ? ` · cotización ${formatMoney(billing.exchangeRate, "ARS")}` : ""}
                {billing.exchangeRateAt ? ` (${formatDateTime(billing.exchangeRateAt)})` : ""}
              </p>
            ) : null}

            {pendingAction ? (
              <div className="panel-state panel-state--danger" role="alertdialog" aria-label={actionCopy[pendingAction].question}>
                <strong>{actionCopy[pendingAction].question}</strong>
                <span>{actionCopy[pendingAction].consequence}</span>
                <div className="marketing-actions">
                  <button
                    type="button"
                    className={pendingAction === "cancel" ? "secondary-button secondary-button--danger" : "primary-button"}
                    disabled={busy}
                    onClick={() => void confirmChange(pendingAction)}
                  >
                    {busy ? "Procesando…" : actionCopy[pendingAction].confirm}
                  </button>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => setPendingAction(null)}>Volver</button>
                </div>
              </div>
            ) : canManage ? (
              <div className="marketing-actions">
                {!billing.billingStatus ? (
                  <button type="button" className="primary-button" disabled={busy} onClick={() => void checkout()}>
                    {busy ? "Abriendo Mercado Pago…" : "Adherir tarjeta con Mercado Pago"}
                  </button>
                ) : null}
                {billing.billingStatus === "paused" ? (
                  <button type="button" className="primary-button" disabled={busy} onClick={() => setPendingAction("resume")}>Reactivar</button>
                ) : null}
                {billing.billingStatus === "authorized" ? (
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => setPendingAction("pause")}>Pausar</button>
                ) : null}
                {billing.status !== "CANCELED" && billing.billingStatus ? (
                  <button type="button" className="secondary-button secondary-button--danger" disabled={busy} onClick={() => setPendingAction("cancel")}>
                    Cancelar suscripción
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="client-empty-state">Solo el dueño o un administrador de tu empresa puede cambiar la suscripción.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
