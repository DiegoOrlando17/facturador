import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Ticket, TicketDivider } from "@/components/ui/Ticket";
import { useToast } from "@/components/ui/Toast";
import { BRAND } from "@/config/brand";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { apiRequest } from "@/lib/api";
import { formatArgentinaDateTime, formatNumber } from "@/lib/formatters";
import { enabledPlanFeatures, PLAN_BILLING_NOTE, planFeatureLabel, type PublicPlan } from "@/lib/publicPlans";
import { getStatus } from "@/lib/statusLabels";
import { useTenantCan } from "@/lib/tenantPermissions";

type Billing = {
  status: "ACTIVE" | "PAST_DUE" | "CANCELED" | string;
  billingStatus: string | null;
  billingProvider: string | null;
  amount: number | null;
  currency: string | null;
  exchangeRate: number | null;
  exchangeRateAt: string | null;
  plan: { code: string; name: string; price: number | null; currency: string };
};

type SubscriptionAction = "pause" | "resume" | "cancel";

const ACTIONS: Record<SubscriptionAction, { title: string; description: string; confirmLabel: string; success: string; danger?: boolean }> = {
  pause: {
    title: "¿Pausás el débito automático?",
    description: "No se hacen nuevos cobros hasta que lo reactives. Mientras tanto no emitimos comprobantes.",
    confirmLabel: "Pausar",
    success: "Pausamos el débito automático.",
  },
  resume: {
    title: "¿Reactivás el débito automático?",
    description: "Mercado Pago vuelve a cobrar el plan todos los meses.",
    confirmLabel: "Reactivar",
    success: "Reactivamos el débito automático.",
  },
  cancel: {
    title: "¿Cancelás la suscripción?",
    description: "Es definitivo: dejamos de emitir comprobantes y, para volver, tenés que adherir la tarjeta de nuevo.",
    confirmLabel: "Cancelar suscripción",
    success: "Cancelamos la suscripción.",
    danger: true,
  },
};

function usePublicPlans() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  useEffect(() => {
    apiRequest<{ items: PublicPlan[] }>("/public/plans")
      .then((value) => setPlans(value.items))
      .catch(() => setPlans([]));
  }, []);
  return plans;
}

function PlanPrice({ price, currency }: { price: number | null; currency: string }) {
  if (price == null) return <>Precio a confirmar</>;
  return (
    <>
      {currency} {formatNumber(price)} <small>/mes</small>
    </>
  );
}

export function ClientSubscriptionPage() {
  const api = usePortalApi();
  const toast = useToast();
  const confirm = useConfirm();
  const can = useTenantCan();
  const billingQuery = usePortalResource<Billing | null>("/portal/subscription/billing", { fallbackErrorMessage: "No pudimos cargar tu suscripción." });
  const plans = usePublicPlans();
  const [busy, setBusy] = useState<SubscriptionAction | "checkout" | null>(null);
  const canManage = can("tenant.manageProfile");
  const billing = billingQuery.data;

  async function checkout() {
    setBusy("checkout");
    try {
      const result = await api.request<{ checkoutUrl: string }>("/portal/subscription/checkout", { method: "POST" });
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      toast.error("No pudimos abrir Mercado Pago", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
      setBusy(null);
    }
  }

  async function change(action: SubscriptionAction) {
    const copy = ACTIONS[action];
    const ok = await confirm({ title: copy.title, description: copy.description, confirmLabel: copy.confirmLabel, tone: copy.danger ? "danger" : "default" });
    if (!ok) return;
    setBusy(action);
    try {
      await api.request(`/portal/subscription/${action}`, { method: "POST" });
      toast.success(copy.success);
      await billingQuery.reload();
    } catch (cause) {
      toast.error("No pudimos actualizar la suscripción", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setBusy(null);
    }
  }

  const header = <PageHeader title="Plan y suscripción" description="Tu plan, el débito mensual y qué incluye." />;

  if (billingQuery.errorMessage) {
    return (
      <div className="portal-page">
        {header}
        <ErrorState message={billingQuery.errorMessage} onRetry={() => void billingQuery.reload()} retrying={billingQuery.isRefreshing} />
      </div>
    );
  }

  if (billingQuery.isLoading) {
    return (
      <div className="portal-page" aria-busy="true">
        {header}
        <Skeleton variant="block" height="18rem" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="portal-page">
        {header}
        <EmptyState
          title="Todavía no tenés un plan asignado"
          description={<>Escribinos a <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> y lo activamos.</>}
        />
      </div>
    );
  }

  const status = getStatus("subscription", billing.status);
  const debit = billing.billingStatus ? getStatus("billing", billing.billingStatus) : null;
  const currentPlan = plans?.find((plan) => plan.code === billing.plan.code);
  const otherPlans = (plans ?? []).filter((plan) => plan.code !== billing.plan.code);
  const needsCard = !billing.billingStatus || billing.billingStatus === "provider_pending";

  return (
    <div className="portal-page portal-subscription">
      {header}

      {billing.status === "PAST_DUE" ? (
        <Callout tone="warning" title="Tu plan tiene un pago pendiente">
          Mientras no esté al día no emitimos comprobantes. {needsCard ? "Adherí una tarjeta para activar el débito mensual." : "Revisá el medio de pago en Mercado Pago."}
        </Callout>
      ) : null}
      {billing.status === "CANCELED" ? <Callout tone="danger" title="La suscripción está cancelada">Para volver a facturar, adherí una tarjeta de nuevo.</Callout> : null}

      <div className="portal-subscription__grid">
        <Ticket as="section" padding="lg" eyebrow="Tu plan" title={billing.plan.name} aria-label={`Plan ${billing.plan.name}`}>
          <p className="portal-plan__price">
            <PlanPrice price={billing.plan.price} currency={billing.plan.currency} />
          </p>
          <p className="portal-muted portal-plan__note">{PLAN_BILLING_NOTE}</p>
          <div className="portal-plan__badges">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {debit ? <StatusBadge tone={debit.tone}>{debit.label}</StatusBadge> : null}
          </div>
          {billing.amount ? (
            <p className="portal-plan__charge">
              Último importe en pesos: <Money value={billing.amount} currency={billing.currency ?? "ARS"} />
              {billing.exchangeRate ? (
                <span className="portal-muted">
                  {" "}
                  · dólar BNA <Money value={billing.exchangeRate} />
                  {billing.exchangeRateAt ? ` del ${formatArgentinaDateTime(billing.exchangeRateAt)}` : ""}
                </span>
              ) : null}
            </p>
          ) : null}
          <TicketDivider />
          {currentPlan ? (
            <ul className="auth-plan__features">
              {enabledPlanFeatures(currentPlan).map((key) => (
                <li key={key}>{planFeatureLabel(key)}</li>
              ))}
            </ul>
          ) : plans === null ? (
            <Skeleton lines={4} />
          ) : null}
        </Ticket>

        <section className="portal-subscription__actions" aria-label="Débito automático">
          <h2>Débito automático</h2>
          {!canManage ? (
            <p className="portal-muted">Solo el dueño o un administrador de tu empresa puede cambiar la suscripción.</p>
          ) : (
            <>
              <p className="portal-muted">
                {needsCard
                  ? "Adherí una tarjeta en Mercado Pago y el plan se cobra solo todos los meses."
                  : billing.billingStatus === "paused"
                    ? "El débito está pausado: no se hacen cobros hasta que lo reactives."
                    : "Mercado Pago cobra el plan todos los meses con la tarjeta adherida."}
              </p>
              {needsCard && billing.status !== "CANCELED" ? (
                <Button variant="primary" size="lg" fullWidth onClick={() => void checkout()} loading={busy === "checkout"} loadingLabel="Abriendo Mercado Pago…">
                  Adherir tarjeta
                </Button>
              ) : null}
              {billing.billingStatus === "paused" ? (
                <Button variant="primary" fullWidth onClick={() => void change("resume")} loading={busy === "resume"}>
                  Reactivar débito
                </Button>
              ) : null}
              {billing.billingStatus === "authorized" ? (
                <Button variant="secondary" fullWidth onClick={() => void change("pause")} loading={busy === "pause"}>
                  Pausar débito
                </Button>
              ) : null}
              {billing.status !== "CANCELED" && !needsCard ? (
                <Button variant="danger-soft" fullWidth onClick={() => void change("cancel")} loading={busy === "cancel"}>
                  Cancelar suscripción
                </Button>
              ) : null}
            </>
          )}
        </section>
      </div>

      {otherPlans.length ? (
        <section className="portal-section" aria-labelledby="other-plans-title">
          <div className="portal-section__header">
            <h2 id="other-plans-title">Otros planes</h2>
            <span className="portal-muted">
              Para cambiar de plan escribinos a <a href={`mailto:${BRAND.supportEmail}?subject=Cambio%20de%20plan`}>{BRAND.supportEmail}</a>.
            </span>
          </div>
          <ul className="portal-plans">
            {otherPlans.map((plan) => {
              const current = new Set(enabledPlanFeatures(currentPlan));
              const extra = enabledPlanFeatures(plan).filter((key) => !current.has(key));
              return (
                <li key={plan.code} className="portal-plans__item">
                  <strong>{plan.name}</strong>
                  <span className="portal-mono">
                    <PlanPrice price={plan.price} currency={plan.currency} />
                  </span>
                  <span className="portal-muted">{extra.length ? `Suma: ${extra.map(planFeatureLabel).join(", ")}.` : "Incluye menos funciones que tu plan."}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
