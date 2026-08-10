import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/app/AuthContext";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { IntegrationLogo, type IntegrationLogoName, isIntegrationLogoName } from "@/components/ui/IntegrationLogo";
import { useApiResource } from "@/hooks/useApiResource";
import { formatDateTime } from "@/lib/formatters";

type HealthStatus = "healthy" | "attention" | "setup_pending" | "unknown";

type ProviderHealth = {
  provider: "MERCADOPAGO" | "AFIP";
  status: HealthStatus;
  enabledCount: number;
  configuredCount: number;
  needsAttentionCount: number;
  missingCount: number;
};

type AttentionItem = {
  id: string;
  type: "onboarding_pending" | "profile_incomplete" | "profile_pending" | "integration_attention" | "payment_failed";
  title: string;
  detail: string;
  priority: "warning" | "danger";
  actionLabel: string;
  actionPath: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
};

type DashboardSummary = {
  tenants: {
    total: number;
    active: number;
    withErrors: number;
    withAlerts?: number;
    pendingApproval?: number;
  };
  payments: {
    total: number;
    pending: number;
    failed: number;
    complete: number;
    totalAmount: number;
  };
  systemHealth?: {
    internal: {
      provider: "FACTURADOR";
      status: HealthStatus;
    };
    mercadopago: ProviderHealth;
    afip: ProviderHealth;
  };
  operationalServices?: Array<{
    name: string;
    status: HealthStatus;
    detail?: string;
  }>;
  attentionItems?: AttentionItem[];
  recentActivity?: Array<{
    id: string;
    type: string;
    icon: IconName;
    title: string;
    tenant?: {
      id: string;
      slug: string;
      name: string;
    };
    paymentId?: string;
    createdAt: string;
  }>;
};

type DashboardResponse = {
  summary: DashboardSummary;
};

type IconName =
  | "alert"
  | "check-circle"
  | "clients"
  | "onboarding"
  | "invoice"
  | "clock"
  | "mp"
  | "payway"
  | "afip"
  | "drive"
  | "sheets";

function DashboardIcon({ name }: { name: IconName }) {
  if (isIntegrationLogoName(name)) {
    return <IntegrationLogo name={name} />;
  }

  const iconName = name === "payway" ? "credit-card" : name;

  return <AppIcon name={iconName as AppIconName} />;
}

function getServiceLogoName(name: string): IntegrationLogoName | null {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("mercado")) return "mp";
  if (normalizedName.includes("arca")) return "arca";
  if (normalizedName.includes("redis")) return "redis";
  if (normalizedName.includes("database") || normalizedName.includes("base")) return "postgresql";
  if (normalizedName.includes("backend") || normalizedName.includes("api") || normalizedName.includes("worker")) return "railway";

  return null;
}

function healthLabel(status: HealthStatus) {
  if (status === "healthy") return "Operativo";
  if (status === "attention") return "Caido";
  if (status === "setup_pending") return "Sin configurar";
  return "Sin datos";
}

function serviceClass(status: HealthStatus) {
  if (status === "healthy") return "success";
  if (status === "attention") return "danger";
  if (status === "setup_pending") return "warning";
  return "muted";
}

function getAttentionClientText(count: number) {
  if (count === 0) return "Sistema operativo";

  return `${count} cliente${count === 1 ? "" : "s"} necesita${count === 1 ? "" : "n"} atencion`;
}

function getOperationalHeadline(attentionCount: number, failedPayments: number, downServices: number) {
  const totalIssues = attentionCount + failedPayments + downServices;

  if (totalIssues === 0) return "Sistema operativo";
  if (downServices > 0) return "Atencion requerida";
  if (failedPayments > 0) return "Facturacion requiere revision";
  return getAttentionClientText(attentionCount);
}

function getOperationalDetail(attentionCount: number, failedPayments: number, downServices: number, criticalAttention?: AttentionItem) {
  if (downServices > 0) {
    return `${downServices} servicio${downServices === 1 ? "" : "s"} critico${downServices === 1 ? "" : "s"} caido${downServices === 1 ? "" : "s"}. Revisalo antes de dar por sano el sistema.`;
  }

  if (failedPayments > 0) {
    return `${failedPayments} pago${failedPayments === 1 ? "" : "s"} quedo${failedPayments === 1 ? "" : "n"} en error y puede${failedPayments === 1 ? "" : "n"} frenar facturacion.`;
  }

  if (criticalAttention) {
    return `${criticalAttention.tenant.name} es el caso mas critico para revisar.`;
  }

  if (attentionCount > 0) {
    return "Hay clientes con aprobaciones, datos o integraciones pendientes.";
  }

  return "No hay bloqueos operativos, errores de facturacion ni servicios criticos caidos.";
}

function getTodayDashboardPath() {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return `/admin/dashboard?dateFrom=${date}&dateTo=${date}`;
}

function getPriorityLabel(priority: AttentionItem["priority"]) {
  return priority === "danger" ? "Alta" : "Media";
}

function getAttentionTone(priority: AttentionItem["priority"]) {
  return priority === "danger" ? "danger" : "warning";
}

function getAttentionImpact(item: AttentionItem) {
  if (item.type === "payment_failed") return "Bloquea comprobante";
  if (item.type === "integration_attention") return "Puede bloquear facturacion";
  if (item.type === "profile_incomplete" || item.type === "profile_pending") return "Bloquea activacion";
  return "Bloquea alta";
}

function getAttentionOwner(item: AttentionItem) {
  if (item.type === "integration_attention") return "Admin tecnico";
  if (item.type === "profile_incomplete") return "Cliente";
  return "Admin";
}

function formatActivityTime(value: string) {
  const formatted = formatDateTime(value);
  return formatted === "Fecha no disponible" ? formatted : formatted.split(", ").pop() ?? formatted;
}

export function DashboardPage() {
  const { token } = useAuth();
  const {
    data: dashboard,
    errorMessage,
    isLoading,
    reload,
  } = useApiResource<DashboardResponse>(getTodayDashboardPath(), {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudo cargar el dashboard.",
  });

  const summary = dashboard?.summary;
  const pendingApproval = summary?.tenants.pendingApproval ?? 6;
  const failedPayments = summary?.payments.failed ?? 1;
  const invoicesToday = summary?.payments.complete ?? 124;
  const activeClients = summary?.tenants.active ?? 42;
  const attentionItems = summary?.attentionItems ?? [];
  const attentionClientCount = new Set(attentionItems.map((item) => item.tenant.id || item.tenant.slug)).size;
  const criticalAttention = attentionItems.find((item) => item.priority === "danger") ?? attentionItems[0];
  const serviceRows = summary?.operationalServices ?? [
    { name: "Workers", status: "unknown" as const },
    { name: "Redis", status: "unknown" as const },
    { name: "Database", status: "unknown" as const },
    { name: "Backend", status: summary?.systemHealth?.internal.status ?? "unknown" as const },
    { name: "Mercado Pago", status: summary?.systemHealth?.mercadopago.status ?? "unknown" as const },
    { name: "ARCA", status: summary?.systemHealth?.afip.status ?? "unknown" as const },
  ];
  const sortedServiceRows = [...serviceRows].sort((left, right) => left.name.localeCompare(right.name, "es"));
  const criticalServiceCount = serviceRows.filter((service) => service.status === "attention").length;
  const recentActivity = summary?.recentActivity ?? [];
  const operationalHeadline = getOperationalHeadline(attentionClientCount, failedPayments, criticalServiceCount);
  const operationalDetail = getOperationalDetail(attentionClientCount, failedPayments, criticalServiceCount, criticalAttention);

  useEffect(() => {
    function handleDashboardRefresh() {
      void reload().then(() => {
        window.dispatchEvent(new CustomEvent("dashboard:updated", {
          detail: { updatedAt: new Date().toISOString() },
        }));
      });
    }

    window.addEventListener("dashboard:refresh", handleDashboardRefresh);

    return () => window.removeEventListener("dashboard:refresh", handleDashboardRefresh);
  }, [reload]);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    window.dispatchEvent(new CustomEvent("dashboard:updated", {
      detail: { updatedAt: new Date().toISOString() },
    }));
  }, [dashboard]);

  return (
    <main className="admin-dashboard">
      <section className={`admin-alert-card${attentionClientCount === 0 && failedPayments === 0 && criticalServiceCount === 0 ? " admin-alert-card--success" : ""}`}>
        <div className="admin-alert-card__main">
          <span className="admin-alert-card__icon">
            <DashboardIcon name={attentionClientCount === 0 && failedPayments === 0 && criticalServiceCount === 0 ? "check-circle" : "alert"} />
          </span>
          <div>
            <span className="eyebrow">Centro operativo</span>
            <h1>{operationalHeadline}</h1>
            <p>{operationalDetail}</p>
            {criticalAttention || failedPayments > 0 || criticalServiceCount > 0 ? <p>Trabaja los bloqueos por impacto para dejar el sistema facturando.</p> : null}
            {attentionClientCount > 0 || failedPayments > 0 || criticalServiceCount > 0 ? (
              <div className="admin-alert-card__actions">
                <Link to={failedPayments > 0 ? "/billing?status=failed" : criticalServiceCount > 0 ? "/integrations" : "/tenants?attention=1"} className="primary-button">
                  Ver problemas criticos
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div className="admin-services-card">
          <strong>Estado de servicios</strong>
          {sortedServiceRows.map(({ name, status }) => (
            <div key={name} className="admin-services-card__row">
              <span className="admin-services-card__name">
                {getServiceLogoName(name) ? (
                  <span className="integration-logo-frame">
                    <IntegrationLogo name={getServiceLogoName(name)!} />
                  </span>
                ) : null}
                {name}
              </span>
              <small className={`status-pill status-pill--${serviceClass(status)}`}>{healthLabel(status)}</small>
            </div>
          ))}
        </div>
      </section>

      {errorMessage ? (
        <section className="admin-inline-error">
          <strong>No pudimos cargar datos reales.</strong>
          <button type="button" className="secondary-button" onClick={() => void reload()}>
            Reintentar
          </button>
        </section>
      ) : null}

      <section className="admin-kpi-grid" aria-label="Resumen general">
        <article className="admin-kpi-card admin-kpi-card--green">
          <div className="admin-kpi-card__title">
            <span><DashboardIcon name="clients" /></span>
            <p>Clientes bloqueados</p>
          </div>
          <strong>{isLoading ? "..." : attentionClientCount}</strong>
          <small>{summary ? `${activeClients} activos en total` : "Consultando clientes"}</small>
        </article>
        <article className="admin-kpi-card admin-kpi-card--orange">
          <div className="admin-kpi-card__title">
            <span><DashboardIcon name="onboarding" /></span>
            <p>Altas pendientes</p>
          </div>
          <strong>{isLoading ? "..." : pendingApproval}</strong>
          <small>{pendingApproval === 1 ? "1 alta pendiente" : `${pendingApproval} altas pendientes`}</small>
        </article>
        <article className="admin-kpi-card admin-kpi-card--blue">
          <div className="admin-kpi-card__title">
            <span><DashboardIcon name="invoice" /></span>
            <p>Facturacion lista</p>
          </div>
          <strong>{isLoading ? "..." : invoicesToday}</strong>
          <small>Completadas hoy</small>
        </article>
        <article className="admin-kpi-card admin-kpi-card--red">
          <div className="admin-kpi-card__title">
            <span><DashboardIcon name="clock" /></span>
            <p>Servicios caidos</p>
          </div>
          <strong>{isLoading ? "..." : criticalServiceCount}</strong>
          <small className="admin-kpi-card__danger-note">
            {failedPayments > 0 ? `${failedPayments} pagos con error` : "Sin errores de pagos"}
          </small>
        </article>
      </section>

      <section className="admin-table-card">
        <div className="admin-section-heading">
          <h2>Requiere atencion</h2>
          <Link to="/alerts">Ver todas</Link>
        </div>
        <div className="admin-attention-table">
          <div className="admin-attention-table__head">
            <span>Prioridad</span>
            <span>Cliente</span>
            <span>Problema</span>
            <span>Impacto</span>
            <span>Responsable</span>
            <span>Accion</span>
          </div>
          {attentionItems.length > 0 ? attentionItems.map((item) => {
            const tone = getAttentionTone(item.priority);

            return (
            <div key={item.id} className="admin-attention-table__row">
              <span><i className={`priority-dot priority-dot--${tone}`} />{getPriorityLabel(item.priority)}</span>
              <strong>{item.tenant.name}</strong>
              <span>{item.title}</span>
              <span><small className={`status-chip status-chip--${tone}`}>{getAttentionImpact(item)}</small></span>
              <span>{getAttentionOwner(item)}</span>
              <span className="admin-attention-table__action">
                <Link to={item.actionPath} className="mini-action-button">{item.actionLabel}</Link>
              </span>
            </div>
            );
          }) : (
            <div className="admin-attention-table__row admin-attention-table__row--empty">
              <div className="admin-attention-table__empty">
                <span>No hay nada que requiera atencion en este momento.</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="admin-bottom-grid admin-bottom-grid--single">
        <article className="admin-list-card">
          <h2>Actividad reciente</h2>
          <div className="admin-activity-list">
            {recentActivity.length > 0 ? recentActivity.map((item) => (
              <div key={item.id} className="admin-activity-list__row">
                <time>{formatActivityTime(item.createdAt)}</time>
                <span className={isIntegrationLogoName(item.icon) ? "integration-logo-frame" : `integration-icon integration-icon--${item.icon}`}>
                  <DashboardIcon name={item.icon} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  {item.tenant?.name ? <small>{item.tenant.name}</small> : null}
                </div>
              </div>
            )) : (
              <div className="panel-state">
                <strong>Sin actividad reciente</strong>
                <span>Cuando entren pagos o comprobantes, van a aparecer aca.</span>
              </div>
            )}
          </div>
          <Link to="/billing">Ver toda la actividad</Link>
        </article>
      </section>
    </main>
  );
}
