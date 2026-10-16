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
  | "afip"
  | "drive"
  | "sheets";

type KpiTone = "green" | "orange" | "blue" | "red";

const EMPTY_VALUE = "—";

function DashboardIcon({ name }: { name: IconName }) {
  if (isIntegrationLogoName(name)) {
    return <IntegrationLogo name={name} />;
  }

  return <AppIcon name={name as AppIconName} />;
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
  if (status === "attention") return "Con problemas";
  if (status === "setup_pending") return "Sin configurar";
  return "Sin datos";
}

function serviceClass(status: HealthStatus) {
  if (status === "healthy") return "success";
  if (status === "attention") return "danger";
  if (status === "setup_pending") return "warning";
  return "muted";
}

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm;
}

function getAttentionClientText(count: number) {
  if (count === 0) return "Sistema operativo";

  return `${count} ${plural(count, "cliente necesita", "clientes necesitan")} atención`;
}

function getOperationalHeadline(attentionCount: number, failedPayments: number, downServices: number) {
  const totalIssues = attentionCount + failedPayments + downServices;

  if (totalIssues === 0) return "Sistema operativo";
  if (downServices > 0) return "Atención requerida";
  if (failedPayments > 0) return "La facturación requiere revisión";
  return getAttentionClientText(attentionCount);
}

function getOperationalDetail(attentionCount: number, failedPayments: number, downServices: number, criticalAttention?: AttentionItem) {
  if (downServices > 0) {
    return `${downServices} ${plural(downServices, "servicio crítico tiene", "servicios críticos tienen")} problemas. Revisalo antes de dar por sano el sistema.`;
  }

  if (failedPayments > 0) {
    return `${failedPayments} ${plural(failedPayments, "pago requiere", "pagos requieren")} revisión (con error o con una etapa trabada) y ${plural(failedPayments, "puede", "pueden")} frenar la facturación.`;
  }

  if (criticalAttention) {
    return `${criticalAttention.tenant.name} es el caso más crítico para revisar.`;
  }

  if (attentionCount > 0) {
    return "Hay clientes con aprobaciones, datos o integraciones pendientes.";
  }

  return "No hay bloqueos operativos, errores de facturación ni servicios críticos con problemas.";
}

function getCriticalActionPath(failedPayments: number, downServices: number) {
  if (failedPayments > 0) return "/admin/billing?status=failed";
  if (downServices > 0) return "/admin/integrations";
  return "/admin/alerts";
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
  if (item.type === "integration_attention") return "Puede bloquear facturación";
  if (item.type === "profile_incomplete" || item.type === "profile_pending") return "Bloquea activación";
  return "Bloquea alta";
}

function getAttentionOwner(item: AttentionItem) {
  if (item.type === "integration_attention") return "Admin técnico";
  if (item.type === "profile_incomplete") return "Cliente";
  return "Admin";
}

function formatActivityTime(value: string) {
  const formatted = formatDateTime(value);
  return formatted === "Fecha no disponible" ? formatted : formatted.split(", ").pop() ?? formatted;
}

function KpiCard({
  tone,
  icon,
  label,
  value,
  note,
  noteIsDanger = false,
}: {
  tone: KpiTone;
  icon: IconName;
  label: string;
  value: number | null;
  note: string;
  noteIsDanger?: boolean;
}) {
  return (
    <article className={`admin-kpi-card admin-kpi-card--${tone}`} aria-busy={value === null}>
      <div className="admin-kpi-card__title">
        <span><DashboardIcon name={icon} /></span>
        <p>{label}</p>
      </div>
      <strong className={value === null ? "phase1-kpi-placeholder" : undefined}>{value === null ? EMPTY_VALUE : value}</strong>
      <small className={noteIsDanger ? "admin-kpi-card__danger-note" : undefined}>{note}</small>
    </article>
  );
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

  const summary = dashboard?.summary ?? null;
  const hasSummary = summary !== null;
  const pendingApproval = summary ? summary.tenants.pendingApproval ?? 0 : null;
  const failedPayments = summary ? summary.payments.failed : null;
  const invoicesToday = summary ? summary.payments.complete : null;
  const activeClients = summary ? summary.tenants.active : null;
  const attentionItems = summary?.attentionItems ?? [];
  const attentionClientCount = summary
    ? new Set(attentionItems.map((item) => item.tenant.id || item.tenant.slug)).size
    : null;
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
  const criticalServiceCount = summary
    ? serviceRows.filter((service) => service.status === "attention").length
    : null;
  const recentActivity = summary?.recentActivity ?? [];

  const issueCounts = hasSummary
    ? {
      attention: attentionClientCount ?? 0,
      failed: failedPayments ?? 0,
      services: criticalServiceCount ?? 0,
    }
    : null;
  const hasIssues = issueCounts
    ? issueCounts.attention > 0 || issueCounts.failed > 0 || issueCounts.services > 0
    : false;

  let operationalHeadline: string;
  let operationalDetail: string;

  if (issueCounts) {
    operationalHeadline = getOperationalHeadline(issueCounts.attention, issueCounts.failed, issueCounts.services);
    operationalDetail = getOperationalDetail(issueCounts.attention, issueCounts.failed, issueCounts.services, criticalAttention);
  } else if (isLoading) {
    operationalHeadline = "Consultando el estado del sistema…";
    operationalDetail = "Estamos trayendo los datos de hoy.";
  } else {
    operationalHeadline = "No pudimos cargar el estado del sistema";
    operationalDetail = "Los indicadores no están disponibles. Reintentá en unos segundos.";
  }

  const alertCardClass = issueCounts && !hasIssues ? " admin-alert-card--success" : "";
  const alertCardIcon: IconName = issueCounts ? (hasIssues ? "alert" : "check-circle") : isLoading ? "clock" : "alert";

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

  const attentionTone: KpiTone = attentionClientCount === null || attentionClientCount === 0 ? "green" : "orange";
  const pendingTone: KpiTone = pendingApproval === null || pendingApproval === 0 ? "green" : "orange";
  const servicesTone: KpiTone = criticalServiceCount === null || criticalServiceCount === 0 ? "green" : "red";
  const loadingNote = isLoading ? "Cargando…" : "Sin datos";

  return (
    <div className="admin-dashboard">
      <section className={`admin-alert-card${alertCardClass}`}>
        <div className="admin-alert-card__main">
          <span className="admin-alert-card__icon">
            <DashboardIcon name={alertCardIcon} />
          </span>
          <div>
            <span className="eyebrow">Centro operativo</span>
            <h1>{operationalHeadline}</h1>
            <p>{operationalDetail}</p>
            {issueCounts && hasIssues ? (
              <>
                <p>Trabajá los bloqueos por impacto para dejar el sistema facturando.</p>
                <div className="admin-alert-card__actions">
                  <Link to={getCriticalActionPath(issueCounts.failed, issueCounts.services)} className="primary-button">
                    Ver problemas críticos
                  </Link>
                </div>
              </>
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
              <small className={`status-pill status-pill--${serviceClass(status)}`}>{hasSummary ? healthLabel(status) : loadingNote}</small>
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
        <KpiCard
          tone={attentionTone}
          icon="clients"
          label="Clientes que requieren atención"
          value={attentionClientCount}
          note={activeClients === null ? loadingNote : `${activeClients} ${plural(activeClients, "cliente activo", "clientes activos")} en total`}
        />
        <KpiCard
          tone={pendingTone}
          icon="onboarding"
          label="Altas pendientes"
          value={pendingApproval}
          note={pendingApproval === null
            ? loadingNote
            : pendingApproval === 0
              ? "Sin altas para aprobar"
              : `${pendingApproval} ${plural(pendingApproval, "alta espera", "altas esperan")} aprobación`}
        />
        <KpiCard
          tone="blue"
          icon="invoice"
          label="Facturas emitidas hoy"
          value={invoicesToday}
          note={failedPayments === null
            ? loadingNote
            : failedPayments > 0
              ? `${failedPayments} ${plural(failedPayments, "pago", "pagos")} para revisar`
              : "Sin pagos para revisar"}
          noteIsDanger={(failedPayments ?? 0) > 0}
        />
        <KpiCard
          tone={servicesTone}
          icon="alert"
          label="Servicios con problemas"
          value={criticalServiceCount}
          note={criticalServiceCount === null
            ? loadingNote
            : criticalServiceCount === 0
              ? "Todos los servicios operativos"
              : `${criticalServiceCount} de ${serviceRows.length} ${plural(serviceRows.length, "servicio", "servicios")}`}
          noteIsDanger={(criticalServiceCount ?? 0) > 0}
        />
      </section>

      <section className="admin-table-card">
        <div className="admin-section-heading">
          <h2>Requiere atención</h2>
          <Link to="/admin/alerts">Ver todas</Link>
        </div>
        <div className="admin-attention-table">
          <div className="admin-attention-table__head">
            <span>Prioridad</span>
            <span>Cliente</span>
            <span>Problema</span>
            <span>Impacto</span>
            <span>Responsable</span>
            <span>Acción</span>
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
                <span>
                  {hasSummary
                    ? "No hay nada que requiera atención en este momento."
                    : isLoading
                      ? "Cargando casos que requieren atención…"
                      : "No pudimos cargar los casos que requieren atención."}
                </span>
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
                <strong>{hasSummary || !isLoading ? "Sin actividad reciente" : "Cargando actividad…"}</strong>
                <span>Cuando entren pagos o comprobantes, van a aparecer acá.</span>
              </div>
            )}
          </div>
          <Link to="/admin/billing">Ver toda la actividad</Link>
        </article>
      </section>
    </div>
  );
}
