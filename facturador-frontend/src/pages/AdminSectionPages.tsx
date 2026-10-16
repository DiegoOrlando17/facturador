import { Link, useSearchParams } from "react-router-dom";
import { Fragment, type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useAuth } from "@/app/AuthContext";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { IntegrationLogo, isIntegrationLogoName } from "@/components/ui/IntegrationLogo";
import { useApiResource } from "@/hooks/useApiResource";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

type Tone = "success" | "warning" | "danger" | "info" | "muted";
type TenantStatus = "ACTIVE" | "DISABLED";
type TenantHealth = "healthy" | "attention" | "setup_pending";
type ClientFilter = "all" | "ready" | "warning" | "blocked" | "onboarding";
type ClientOperationalStatus =
  | "ready"
  | "missing_profile"
  | "profile_review"
  | "missing_plan"
  | "missing_arca"
  | "missing_mp"
  | "integration_error"
  | "suspended";

type SectionIconName =
  | "search"
  | "filter"
  | "client"
  | "invoice"
  | "mp"
  | "afip"
  | "arca"
  | "drive"
  | "postgresql"
  | "railway"
  | "redis"
  | "sheets"
  | "alert"
  | "guide"
  | "integrations";

type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  profile?: {
    exists: boolean;
    isComplete: boolean;
    cuit?: string | null;
    approvalStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | string;
    needsAttention: boolean;
  };
  currentSubscription: {
    id?: string;
    status: string;
    planCode: string | null;
    planName: string | null;
  };
  integrations: {
    overallHealth: TenantHealth;
    enabledCount: number;
    configuredCount: number;
    needsAttentionCount: number;
    items?: Array<{
      provider: string;
      enabled: boolean;
      health: "configured" | "missing_config" | "disabled";
    }>;
  };
};

type TenantsResponse = {
  items: TenantListItem[];
  total: number;
};

type PaymentStatus = string;

type AdminPayment = {
  id: string;
  tenantId: string;
  provider: string;
  provider_payment_id: string | null;
  status: PaymentStatus;
  payment_method_id: string | null;
  amount: number;
  currency: string | null;
  customer: string | null;
  customer_doc_type: string | null;
  customer_doc_number: string | null;
  date_approved: string | null;
  cae: string | null;
  cae_vto: string | null;
  cbte_nro: string | null;
  cbte_tipo: number | null;
  pto_vta: number | null;
  pdf_path: string | null;
  drive_file_link: string | null;
  sheets_row: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
};

type AdminPaymentsResponse = {
  items: AdminPayment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type DashboardPaymentsSummary = {
  total: number;
  pending: number;
  failed: number;
  complete: number;
  totalAmount: number;
  statuses?: Record<string, { count: number; amount: number }>;
};

function sumStatusCounts(statuses: NonNullable<DashboardPaymentsSummary["statuses"]>, keys: string[]) {
  return keys.reduce((total, key) => total + (statuses[key]?.count ?? 0), 0);
}

type DashboardResponse = {
  summary: {
    payments: DashboardPaymentsSummary;
  };
  attentionItems?: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    priority: "danger" | "warning" | "info";
    actionLabel: string;
    actionPath: string;
    createdAt?: string;
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    assignment?: {
      adminUser: { id: string; name: string | null; email: string; role: string } | null;
      assignedAt: string;
    } | null;
  }>;
};

type CreateTenantResponse = {
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  name?: string;
};

function SectionIcon({ name }: { name: SectionIconName }) {
  if (isIntegrationLogoName(name)) {
    return <IntegrationLogo name={name} />;
  }

  const names = {
    alert: "alert",
    client: "clients",
    integrations: "integrations",
    filter: "filter",
    guide: "check-circle",
    invoice: "invoice",
    search: "search",
  };

  return <AppIcon name={(names[name as keyof typeof names] ?? "integrations") as AppIconName} />;
}

function StatusBadge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`section-status section-status--${tone}`}>{children}</span>;
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSlugInput(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "");
}

function hasProfileAttention(tenant: TenantListItem) {
  return tenant.profile?.needsAttention ?? false;
}

function getOperationalStatus(tenant: TenantListItem): ClientOperationalStatus {
  if (tenant.status === "DISABLED") return "suspended";
  if (!tenant.profile?.isComplete) return "missing_profile";
  if (tenant.profile.approvalStatus !== "APPROVED") return "profile_review";
  if (!tenant.currentSubscription.planName) return "missing_plan";
  if (tenant.integrations.needsAttentionCount > 0 || tenant.integrations.overallHealth === "attention") return "integration_error";

  const hasProvider = (provider: string) =>
    tenant.integrations.items?.some((integration) =>
      integration.enabled
      && integration.provider.toUpperCase() === provider
      && integration.health === "configured",
    ) ?? false;

  if (!hasProvider("AFIP")) return "missing_arca";
  if (!hasProvider("MERCADOPAGO")) return "missing_mp";

  return "ready";
}

function getTenantAttentionCount(tenant: TenantListItem) {
  return tenant.integrations.needsAttentionCount + (hasProfileAttention(tenant) ? 1 : 0);
}

function getClientTableStatus(tenant: TenantListItem): {
  label: string;
  tone: Tone;
  group: Exclude<ClientFilter, "all">;
} {
  const status = getOperationalStatus(tenant);
  const attentionCount = getTenantAttentionCount(tenant);

  if (status === "ready" && attentionCount === 0) {
    return {
      label: "Listo para facturar",
      tone: "success",
      group: "ready",
    };
  }

  if (status === "ready" && attentionCount > 0) {
    return {
      label: "Con advertencias",
      tone: "warning",
      group: "warning",
    };
  }

  if (
    status === "missing_profile"
    || status === "profile_review"
    || status === "missing_plan"
    || status === "missing_arca"
    || status === "missing_mp"
  ) {
    return {
      label: "En onboarding",
      tone: "muted",
      group: "onboarding",
    };
  }

  if (status === "suspended") {
    return {
      label: "Bloqueado",
      tone: "danger",
      group: "blocked",
    };
  }

  return {
    label: "Bloqueado",
    tone: "danger",
    group: "blocked",
  };
}

function getClientDocument(tenant: TenantListItem) {
  return tenant.profile?.cuit || "CUIT sin cargar";
}

function getPaymentStatusTone(status: string): Tone {
  if (status === "complete") return "success";
  if (status === "failed") return "danger";
  if (status === "cancelled" || status === "canceled") return "muted";
  return "warning";
}

function getPaymentStageLabel(payment: AdminPayment) {
  if (payment.status === "complete") return "Facturado";
  if (payment.status === "failed") return "Error a resolver";
  if (payment.status === "afip_pending") return "Pendiente ARCA";
  if (payment.status === "pdf_pending") return "Pendiente PDF";
  if (payment.status === "drive_pending") return "Pendiente Drive";
  if (payment.status === "sheets_pending") return "Pendiente Sheets";
  if (payment.status === "processing") return "En proceso";
  return "Pago recibido";
}

function getPaymentStageDetail(payment: AdminPayment) {
  if (payment.error) return payment.error;
  if (payment.status === "complete") return payment.drive_file_link ? "Drive y registro OK" : "CAE obtenido";
  if (payment.status === "afip_pending") return "Esperando envío o respuesta de ARCA";
  if (payment.status === "pdf_pending") return "CAE listo, falta PDF";
  if (payment.status === "drive_pending") return "PDF listo, falta Drive";
  if (payment.status === "sheets_pending") return "Falta registrar en Sheets";
  return "Sin error informado";
}

function getPaymentProviderIcon(provider: string): SectionIconName {
  if (provider.toUpperCase() === "MERCADOPAGO") return "mp";
  return "invoice";
}

function getPaymentTitle(payment: AdminPayment) {
  if (payment.cbte_nro) return `Comprobante ${payment.cbte_nro}`;
  if (payment.provider_payment_id) return `Pago ${payment.provider_payment_id}`;
  return `Pago ${payment.id}`;
}

function SectionHeader({ title, detail, actions }: { title: string; detail: string; actions?: ReactNode }) {
  return (
    <div className="admin-section-header">
      <div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {actions ? <div className="admin-section-header__actions">{actions}</div> : null}
    </div>
  );
}

const CLIENT_FILTERS: ClientFilter[] = ["all", "ready", "warning", "blocked", "onboarding"];
const TENANT_HEALTH_FILTERS: TenantHealth[] = ["healthy", "attention", "setup_pending"];
const TENANT_SLUG_MIN_LENGTH = 3;

function parseClientFilter(value: string | null): ClientFilter {
  return CLIENT_FILTERS.includes(value as ClientFilter) ? value as ClientFilter : "all";
}

function parseHealthFilter(searchParams: URLSearchParams): TenantHealth | "all" {
  const value = searchParams.get("health");
  if (TENANT_HEALTH_FILTERS.includes(value as TenantHealth)) return value as TenantHealth;
  // Compatibilidad con links viejos (?attention=1 / ?alerts=1).
  if (searchParams.get("attention") === "1" || searchParams.get("alerts") === "1") return "attention";
  return "all";
}

function getPaginationPages(page: number, totalPages: number) {
  const pages = new Set([1, page - 1, page, page + 1, totalPages]);
  return Array.from(pages).filter((value) => value >= 1 && value <= totalPages).sort((left, right) => left - right);
}

export function ClientsSectionPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("search") ?? "";
  const activeFilter = parseClientFilter(searchParams.get("tab"));
  const healthFilter = parseHealthFilter(searchParams);
  const planFilter = searchParams.get("plan") || "all";
  const requestedPage = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus>("ACTIVE");
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const pageSize = 6;

  function updateParams(changes: Record<string, string | null>, options: { resetPage?: boolean; replace?: boolean } = {}) {
    const { resetPage = true, replace = false } = options;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const legacyHealth = parseHealthFilter(current);

      next.delete("attention");
      next.delete("alerts");
      if (legacyHealth !== "all" && !next.get("health")) next.set("health", legacyHealth);

      Object.entries(changes).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });

      if (resetPage) next.delete("page");

      return next;
    }, { replace });
  }

  function setPage(pageNumber: number) {
    updateParams({ page: pageNumber > 1 ? String(pageNumber) : null }, { resetPage: false });
  }
  const { data, errorMessage, isLoading, reload } = useApiResource<TenantsResponse>("/admin/tenants", {
    fallbackErrorMessage: "No se pudo cargar el listado de clientes.",
  });

  const items = data?.items ?? [];
  const counters = useMemo(() => ({
    total: items.length,
    ready: items.filter((tenant) => getClientTableStatus(tenant).group === "ready").length,
    warning: items.filter((tenant) => getClientTableStatus(tenant).group === "warning").length,
    blocked: items.filter((tenant) => getClientTableStatus(tenant).group === "blocked").length,
    onboarding: items.filter((tenant) => getClientTableStatus(tenant).group === "onboarding").length,
  }), [items]);
  const planOptions = useMemo(() => {
    const planNames = new Set(items.map((tenant) => tenant.currentSubscription.planName).filter(Boolean) as string[]);
    return Array.from(planNames).sort((left, right) => left.localeCompare(right, "es"));
  }, [items]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((tenant) => {
      const matchesQuery = !normalizedQuery
        || tenant.name.toLowerCase().includes(normalizedQuery)
        || tenant.slug.toLowerCase().includes(normalizedQuery)
        || Boolean(tenant.profile?.cuit?.toLowerCase().includes(normalizedQuery))
        || Boolean(tenant.currentSubscription.planName?.toLowerCase().includes(normalizedQuery));
      const tableStatus = getClientTableStatus(tenant);
      const matchesTab = activeFilter === "all" || tableStatus.group === activeFilter;
      const matchesHealth = healthFilter === "all" || tenant.integrations.overallHealth === healthFilter;
      const matchesPlan = planFilter === "all"
        || (planFilter === "none" && !tenant.currentSubscription.planName)
        || tenant.currentSubscription.planName === planFilter;

      return matchesQuery && matchesTab && matchesHealth && matchesPlan;
    });
  }, [activeFilter, healthFilter, items, planFilter, query]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const visibleRows = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const normalizedTenantSlug = tenantSlug.trim();
  const isSlugValid = normalizedTenantSlug.length >= TENANT_SLUG_MIN_LENGTH;
  const canCreateTenant = Boolean(token && tenantName.trim() && isSlugValid && !isCreating);

  function updateFilter(filter: ClientFilter) {
    updateParams({ tab: filter });
  }

  function handleTenantNameChange(value: string) {
    setTenantName(value);
    setCreateError("");
    setCreateMessage("");

    if (!slugTouched) {
      setTenantSlug(createSlug(value));
    }
  }

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setCreateError("Tu sesión no está disponible. Ingresá nuevamente para crear clientes.");
      return;
    }

    if (!canCreateTenant) {
      setCreateError(`Completá el nombre y un slug de al menos ${TENANT_SLUG_MIN_LENGTH} caracteres para crear el cliente.`);
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreateMessage("");

    try {
      const createdTenant = await apiRequest<CreateTenantResponse>("/admin/tenants", {
        method: "POST",
        token,
        body: {
          name: tenantName.trim(),
          slug: createSlug(normalizedTenantSlug),
          status: tenantStatus,
        },
      });
      const createdName = createdTenant.tenant?.name ?? createdTenant.name ?? tenantName.trim();

      setTenantName("");
      setTenantSlug("");
      setSlugTouched(false);
      setTenantStatus("ACTIVE");
      setIsCreateOpen(false);
      setCreateMessage(`${createdName} creado correctamente.`);
      await reload();
    } catch (error) {
      setCreateError(getApiErrorMessage(error, "No se pudo crear el cliente."));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="admin-section-page clients-page">
      <SectionHeader
        title={activeFilter === "onboarding" ? "Altas" : "Clientes"}
        detail={activeFilter === "onboarding"
          ? "Clientes en onboarding o con datos pendientes de aprobación."
          : "Gestioná todos tus clientes."}
        actions={
          <PermissionGate
            permission="tenants:manage"
            fallback={<button type="button" className="section-button section-button--primary" disabled>+ Agregar cliente</button>}
          >
            <button type="button" className="section-button section-button--primary" onClick={() => setIsCreateOpen((current) => !current)}>
              + Agregar cliente
            </button>
          </PermissionGate>
        }
      />
      <div className="section-toolbar clients-toolbar">
        <label className="section-search">
          <SectionIcon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => updateParams({ search: event.target.value }, { replace: true })}
            placeholder="Buscar por nombre, slug, CUIT o plan…"
            aria-label="Buscar clientes"
          />
        </label>
        <select
          className="section-select clients-select"
          value={healthFilter}
          aria-label="Filtrar por estado operativo"
          onChange={(event) => updateParams({ health: event.target.value })}
        >
          <option value="all">Estado operativo</option>
          <option value="healthy">Listo para facturar</option>
          <option value="attention">Con problemas</option>
          <option value="setup_pending">En onboarding</option>
        </select>
        <select
          className="section-select clients-select"
          value={planFilter}
          aria-label="Filtrar por plan"
          onChange={(event) => updateParams({ plan: event.target.value })}
        >
          <option value="all">Todos los planes</option>
          <option value="none">Sin plan</option>
          {planOptions.map((planName) => (
            <option key={planName} value={planName}>{planName}</option>
          ))}
        </select>
        <button
          type="button"
          className="section-button section-button--soft clients-filter-button"
          onClick={() => setSearchParams(new URLSearchParams())}
        >
          <SectionIcon name="filter" />Limpiar filtros
        </button>
      </div>
      {isCreateOpen ? (
        <form className="section-create-panel" onSubmit={(event) => void handleCreateTenant(event)}>
          <label className="field">
            <span>Nombre visible</span>
            <input
              type="text"
              value={tenantName}
              onChange={(event) => handleTenantNameChange(event.target.value)}
              placeholder="Cliente Sur"
              disabled={isCreating}
            />
          </label>
          <label className="field">
            <span>Slug</span>
            <input
              type="text"
              value={tenantSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setTenantSlug(normalizeSlugInput(event.target.value));
                setCreateError("");
                setCreateMessage("");
              }}
              onBlur={() => setTenantSlug((current) => createSlug(current))}
              placeholder="cliente-sur"
              minLength={TENANT_SLUG_MIN_LENGTH}
              maxLength={50}
              required
              disabled={isCreating}
            />
            {tenantSlug && !isSlugValid ? <small>El slug tiene que tener al menos {TENANT_SLUG_MIN_LENGTH} caracteres.</small> : null}
          </label>
          <label className="field">
            <span>Estado inicial</span>
            <select value={tenantStatus} onChange={(event) => setTenantStatus(event.target.value as TenantStatus)} disabled={isCreating}>
              <option value="ACTIVE">Activo</option>
              <option value="DISABLED">Inactivo</option>
            </select>
          </label>
          <div className="section-create-panel__actions">
            <button type="submit" className="section-button section-button--primary" disabled={!canCreateTenant}>
              {isCreating ? "Creando…" : "Crear cliente"}
            </button>
            <button type="button" className="section-button" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
      {createError ? <p className="form-error">{createError}</p> : null}
      {createMessage ? <p className="form-success">{createMessage}</p> : null}
      <div className="section-tabs">
        {[
          ["all", "Todos", counters.total],
          ["ready", "Listos", counters.ready],
          ["warning", "Con advertencias", counters.warning],
          ["blocked", "Bloqueados", counters.blocked],
          ["onboarding", "En onboarding", counters.onboarding],
        ].map(([filter, label, count]) => (
          <button
            key={filter}
            type="button"
            className={`section-tab ${activeFilter === filter ? "section-tab--active" : ""}`}
            onClick={() => updateFilter(filter as ClientFilter)}
          >
            {label} <b>{count}</b>
          </button>
        ))}
      </div>
      <section className="section-table-card">
        <div className="section-table section-table--clients">
          <div className="section-table__head">
            <span>Cliente</span><span>Estado operativo</span><span>Plan</span><span>Alertas</span><span>Última actividad</span><span>Acción</span>
          </div>
          {isLoading ? (
            <div className="section-table__state">Cargando clientes…</div>
          ) : errorMessage ? (
            <div className="section-table__state section-table__state--danger">
              <span>{errorMessage}</span>
              <button type="button" className="section-button" onClick={() => void reload()}>Reintentar</button>
            </div>
          ) : visibleRows.length > 0 ? visibleRows.map((tenant) => {
            const attentionCount = getTenantAttentionCount(tenant);
            const tableStatus = getClientTableStatus(tenant);

            return (
              <div key={tenant.id} className="section-table__row">
                <span className="client-name-cell">
                  <strong>{tenant.name}</strong>
                  <small>{getClientDocument(tenant)}</small>
                </span>
                <span className="client-status-cell">
                  <StatusBadge tone={tableStatus.tone}>{tableStatus.label}</StatusBadge>
                </span>
                <span>{tenant.currentSubscription.planName ?? "Sin plan"}</span>
                <span>
                  <small className={`client-alert-badge${attentionCount > 0 ? " client-alert-badge--active" : ""}`}>
                    {attentionCount}
                  </small>
                </span>
                <span>{formatDateTime(tenant.updatedAt ?? tenant.createdAt)}</span>
                <Link to={`/admin/tenants/${tenant.slug}`} className="section-mini-button">Ver</Link>
              </div>
            );
          }) : (
            <div className="section-table__state">No encontramos clientes con esos filtros.</div>
          )}
        </div>
      </section>
      <div className="section-pagination clients-pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">{"<"}</button>
        {getPaginationPages(page, totalPages).map((pageNumber, index, pages) => (
          <Fragment key={pageNumber}>
            {index > 0 && pageNumber - pages[index - 1] > 1 ? <span>…</span> : null}
            <button
              type="button"
              className={page === pageNumber ? "section-pagination__active" : ""}
              aria-current={page === pageNumber ? "page" : undefined}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          </Fragment>
        ))}
        <button type="button" disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Página siguiente">{">"}</button>
      </div>
    </main>
  );
}

export function BillingSectionPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [providerFilter, setProviderFilter] = useState("");
  const queryParams = new URLSearchParams({
    page: String(page),
    pageSize: "10",
  });

  if (search.trim()) queryParams.set("search", search.trim());
  if (statusFilter) queryParams.set("status", statusFilter);
  if (providerFilter) queryParams.set("provider", providerFilter);

  const {
    data: dashboard,
    errorMessage: dashboardErrorMessage,
    isLoading: isDashboardLoading,
    reload: reloadDashboard,
  } = useApiResource<DashboardResponse>("/admin/dashboard", {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudo cargar el resumen de facturación.",
  });

  const {
    data: payments,
    errorMessage: paymentsErrorMessage,
    isLoading: arePaymentsLoading,
    reload: reloadPayments,
  } = useApiResource<AdminPaymentsResponse>(`/admin/payments?${queryParams.toString()}`, {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudo cargar la actividad de facturación.",
  });

  const paymentSummary = dashboard?.summary.payments;
  const stageCounts = paymentSummary?.statuses
    ? {
      arca: sumStatusCounts(paymentSummary.statuses, ["pending", "processing", "afip_pending"]),
      delivery: sumStatusCounts(paymentSummary.statuses, ["pdf_pending", "drive_pending", "sheets_pending"]),
      failed: sumStatusCounts(paymentSummary.statuses, ["failed"]),
    }
    : null;
  // Con desglose por estado, las etapas pendientes y los fallidos no se superponen.
  const failedCount = stageCounts ? stageCounts.failed : paymentSummary?.failed;
  const formatKpi = (value: number | undefined) => (isDashboardLoading && !paymentSummary) || value === undefined ? "—" : value;
  const totalPages = payments?.pagination.totalPages ?? 1;

  function resetFilters() {
    setSearch("");
    setStatusFilter("");
    setProviderFilter("");
    setPage(1);
  }

  function refreshBillingData() {
    void Promise.all([reloadDashboard(), reloadPayments()]);
  }

  return (
    <main className="admin-section-page">
      <SectionHeader
        title="Facturación"
        detail="Seguí cada pago por etapa: cobro, ARCA, PDF, Drive y Sheets."
        actions={
          <button type="button" className="section-button section-button--soft" onClick={refreshBillingData}>
            Actualizar
          </button>
        }
      />
      <section className="section-kpi-row">
        <article><span>Pagos recibidos</span><strong>{formatKpi(paymentSummary?.total)}</strong><small>Total histórico</small></article>
        {stageCounts ? (
          <>
            <article><span>Pendientes ARCA</span><strong>{formatKpi(stageCounts.arca)}</strong><small>Recibidos, en proceso o esperando ARCA</small></article>
            <article><span>Pendientes PDF/Drive</span><strong>{formatKpi(stageCounts.delivery)}</strong><small>Con CAE, falta PDF, Drive o Sheets</small></article>
          </>
        ) : (
          <article><span>En proceso</span><strong>{formatKpi(paymentSummary?.pending)}</strong><small>Todas las etapas en curso</small></article>
        )}
        <article><span>Errores a resolver</span><strong>{formatKpi(failedCount)}</strong><small className={(failedCount ?? 0) > 0 ? "section-danger-text" : ""}>{stageCounts ? "Pagos en estado fallido" : "Impactan la facturación"}</small></article>
        <article><span>Facturas emitidas</span><strong>{formatKpi(paymentSummary?.complete)}</strong><small>{paymentSummary ? formatCurrency(paymentSummary.totalAmount) + " registrados" : "—"}</small></article>
      </section>

      {dashboardErrorMessage ? (
        <section className="section-table__state section-table__state--danger">{dashboardErrorMessage}</section>
      ) : null}

      <section className="section-toolbar" aria-label="Filtros de facturación">
        <label className="section-search">
          <SectionIcon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar pago, comprobante o cliente"
          />
        </label>
        <select
          className="section-select"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pago recibido</option>
          <option value="processing">En proceso</option>
          <option value="afip_pending">Pendiente ARCA</option>
          <option value="pdf_pending">Pendiente PDF</option>
          <option value="drive_pending">Pendiente Drive</option>
          <option value="sheets_pending">Pendiente Sheets</option>
          <option value="complete">Facturado</option>
          <option value="failed">Error a resolver</option>
        </select>
        <select
          className="section-select"
          value={providerFilter}
          onChange={(event) => {
            setProviderFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los proveedores</option>
          <option value="MERCADOPAGO">Mercado Pago</option>
        </select>
        <button type="button" className="section-button section-button--soft" onClick={resetFilters}>
          Limpiar
        </button>
      </section>

      <section className="section-table-card section-table-card--scrollable">
        <div className="section-table section-table--billing">
          <div className="section-table__head">
            <span>Fecha pago</span><span>Comprobante</span><span>Cliente</span><span>Proveedor</span><span>Monto</span><span>Etapa actual</span><span>Último error</span><span>Acción</span>
          </div>
          {arePaymentsLoading ? (
            <div className="section-table__state">Cargando actividad de facturación…</div>
          ) : paymentsErrorMessage ? (
            <div className="section-table__state section-table__state--danger">{paymentsErrorMessage}</div>
          ) : payments && payments.items.length > 0 ? payments.items.map((payment) => (
            <div key={payment.id} className="section-table__row">
              <span>{formatDateTime(payment.createdAt)}</span>
              <Link
                to={`/admin/payments/${payment.id}`}
                className="section-payment-link"
                aria-label={`Abrir pago ${getPaymentTitle(payment)}`}
              >
                {getPaymentTitle(payment)}
              </Link>
              <span>{payment.tenant?.name ?? payment.customer ?? "-"}</span>
              <span className="section-service-name">
                <span className="integration-logo-frame"><SectionIcon name={getPaymentProviderIcon(payment.provider)} /></span>
                {payment.provider}
              </span>
              <span>{formatCurrency(payment.amount)}</span>
              <span><StatusBadge tone={getPaymentStatusTone(payment.status)}>{getPaymentStageLabel(payment)}</StatusBadge></span>
              <span className={payment.error ? "section-danger-text" : ""}>{getPaymentStageDetail(payment)}</span>
              <Link to={`/admin/payments/${payment.id}`} className="section-mini-button">Abrir</Link>
            </div>
          )) : (
            <div className="section-table__state">
              No hay pagos registrados con esos filtros. Cuando Mercado Pago informe cobros, van a aparecer acá.
            </div>
          )}
        </div>
      </section>

      <div className="section-pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{"<"}</button>
        <b>{page}</b>
        <span>de {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{">"}</button>
      </div>
    </main>
  );
}

export function IntegrationsSectionPage() {
  type HealthStatus = "healthy" | "attention" | "setup_pending";
  type HealthResponse = {
    checkedAt: string;
    integrations: Array<{ provider: string; status: HealthStatus; enabledCount: number; configuredCount: number; needsAttentionCount: number; missingCount: number }>;
    infrastructure: Array<{ name: string; status: HealthStatus; detail: string }>;
    queues: Array<{ name: string; status: HealthStatus; detail: string; counts: { waiting: number; active: number; delayed: number; failed: number } | null }>;
  };

  const { token } = useAuth();
  const { data, errorMessage, isLoading, reload } = useApiResource<HealthResponse>("/admin/health", {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudo consultar la salud operativa.",
  });
  const providerPresentation: Record<string, { label: string; icon: SectionIconName }> = {
    MERCADOPAGO: { label: "Mercado Pago", icon: "mp" },
    AFIP: { label: "ARCA", icon: "arca" },
    DRIVE: { label: "Google Drive", icon: "drive" },
    SHEETS: { label: "Google Sheets", icon: "sheets" },
  };
  const infrastructureIcons: Record<string, SectionIconName> = {
    Backend: "railway",
    Database: "postgresql",
    Redis: "redis",
    Workers: "railway",
    "Mercado Pago": "mp",
    ARCA: "arca",
    "Cola de pagos": "redis",
    "Cola de facturas": "redis",
  };
  const getTone = (status: HealthStatus): Tone => status === "healthy" ? "success" : status === "attention" ? "warning" : "muted";
  const getLabel = (status: HealthStatus) => status === "healthy" ? "Operativo" : status === "attention" ? "Revisar" : "Sin configurar";

  return (
    <main className="admin-section-page">
      <SectionHeader title="Integraciones" detail="Estado real de conexiones, infraestructura, workers y colas." actions={<button type="button" className="section-button section-button--soft" onClick={() => void reload()}>Verificar ahora</button>} />
      {isLoading ? <section className="section-table-card"><div className="section-table__state">Verificando servicios…</div></section> : null}
      {errorMessage ? <section className="section-table-card"><div className="section-table__state section-table__state--danger">{errorMessage}</div></section> : null}
      {data ? <>
      <section className="section-table-card">
        <div className="section-subheading">
          <h2>Integraciones de clientes</h2>
          <p>Estas conexiones determinan si cada cliente puede cobrar, facturar y registrar comprobantes.</p>
        </div>
        <div className="section-table section-table--integrations">
          <div className="section-table__head">
            <span>Servicio</span><span>Estado</span><span>Detalle</span><span>Última actividad</span><span>Acción</span>
          </div>
          {data.integrations.map((item) => {
            const presentation = providerPresentation[item.provider] ?? { label: item.provider, icon: "integrations" };
            return <div key={item.provider} className="section-table__row">
              <strong className="section-service-name"><span className="integration-logo-frame"><SectionIcon name={presentation.icon} /></span>{presentation.label}</strong>
              <span><StatusBadge tone={getTone(item.status)}>{getLabel(item.status)}</StatusBadge></span>
              <span>{`${item.configuredCount}/${item.enabledCount} habilitadas configuradas; ${item.needsAttentionCount} requieren atención`}</span>
              <span>{formatDateTime(data.checkedAt)}</span>
              <Link to="/admin/tenants?health=attention" className="section-mini-button">Ver clientes</Link>
            </div>
          })}
        </div>
      </section>
      <section className="section-table-card">
        <div className="section-subheading">
          <h2>Infraestructura del sistema</h2>
          <p>Estos servicios sostienen el procesamiento global. No son configuraciones comerciales por cliente.</p>
        </div>
        <div className="section-table section-table--integrations">
          <div className="section-table__head">
            <span>Servicio</span><span>Estado</span><span>Detalle</span><span>Última actividad</span><span>Acción</span>
          </div>
          {[...data.infrastructure, ...data.queues].map((item) => (
            <div key={item.name} className="section-table__row">
              <strong className="section-service-name"><span className="integration-logo-frame"><SectionIcon name={infrastructureIcons[item.name] ?? "integrations"} /></span>{item.name}</strong>
              <span><StatusBadge tone={getTone(item.status)}>{getLabel(item.status)}</StatusBadge></span><span>{item.detail}</span><span>{formatDateTime(data.checkedAt)}</span>
              <button type="button" className="section-mini-button" onClick={() => void reload()}>Verificar</button>
            </div>
          ))}
        </div>
        {false ? <SectionIcon name="guide" /> : null}
        <div><strong>¿Necesitás conectar un servicio?</strong><p>Consultá nuestra guía de integraciones o contactá a soporte.</p></div>
        {false ? <button type="button" className="section-button section-button--soft">Ver guia</button> : null}
      </section>
      </> : null}
    </main>
  );
}

export function AlertsSectionPage() {
  const { token, user, can } = useAuth();
  const [queueFilter, setQueueFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const { data, errorMessage, isLoading, reload } = useApiResource<{
    items: NonNullable<DashboardResponse["attentionItems"]>;
    total: number;
  }>("/admin/alerts", {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudieron cargar las alertas operativas.",
  });
  const allRows = data?.items ?? [];
  const rows = allRows.filter((item) => queueFilter === "all"
    || (queueFilter === "unassigned" && !item.assignment)
    || (queueFilter === "mine" && item.assignment?.adminUser?.id === user?.id));
  const criticalCount = rows.filter((item) => item.priority === "danger").length;
  const warningCount = rows.filter((item) => item.priority === "warning").length;

  async function updateAssignment(itemId: string, shouldClaim: boolean) {
    if (!token) return;
    setUpdatingAlertId(itemId);
    setActionErrorMessage(null);
    try {
      await apiRequest(`/admin/alerts/${encodeURIComponent(itemId)}/claim`, {
        method: shouldClaim ? "POST" : "DELETE",
        token,
      });
      await reload();
    } catch (error) {
      setActionErrorMessage(getApiErrorMessage(error, "No se pudo actualizar la asignación."));
    } finally {
      setUpdatingAlertId(null);
    }
  }

  return (
    <main className="admin-section-page">
      <SectionHeader
        title="Alertas"
        detail="Problemas, errores y eventos que requieren atención."
        actions={<button type="button" className="section-button section-button--soft" onClick={() => void reload()}>Actualizar</button>}
      />
      <div className="section-tabs">
        <button type="button" className={`section-tab${queueFilter === "all" ? " section-tab--active" : ""}`} onClick={() => setQueueFilter("all")}>Todas <b>{allRows.length}</b></button>
        <button type="button" className={`section-tab${queueFilter === "unassigned" ? " section-tab--active" : ""}`} onClick={() => setQueueFilter("unassigned")}>Sin asignar <b>{allRows.filter((item) => !item.assignment).length}</b></button>
        <button type="button" className={`section-tab${queueFilter === "mine" ? " section-tab--active" : ""}`} onClick={() => setQueueFilter("mine")}>Mis alertas <b>{allRows.filter((item) => item.assignment?.adminUser?.id === user?.id).length}</b></button>
        <span className="section-tab">Críticas <b>{criticalCount}</b></span><span className="section-tab">Advertencias <b>{warningCount}</b></span>
      </div>
      <section className="section-table-card">
        <div className="section-table section-table--alerts">
          <div className="section-table__head">
            <span>Alerta</span><span>Cliente</span><span>Severidad</span><span>Impacto</span><span>Responsable</span><span>Acción</span>
          </div>
          {isLoading ? (
            <div className="section-table__state">Cargando alertas…</div>
          ) : errorMessage ? (
            <div className="section-table__state section-table__state--danger">{errorMessage}</div>
          ) : rows.length > 0 ? rows.map((item) => (
            <div key={item.id} className="section-table__row">
              <span>{item.title}</span><strong>{item.tenant.name}</strong>
              <span><StatusBadge tone={item.priority === "danger" ? "danger" : item.priority === "warning" ? "warning" : "info"}>{item.priority === "danger" ? "Crítica" : item.priority === "warning" ? "Advertencia" : "Informativa"}</StatusBadge></span>
              <span>{item.detail}</span>
              <span>{item.assignment?.adminUser?.name ?? item.assignment?.adminUser?.email ?? "Sin asignar"}</span>
              <span className="section-row-actions">
                <Link to={item.actionPath} className="section-mini-button">{item.actionLabel}</Link>
                {can("payments:manage") ? (
                  <button type="button" className="section-mini-button" disabled={updatingAlertId === item.id} onClick={() => void updateAssignment(item.id, !item.assignment)}>
                    {updatingAlertId === item.id ? "Guardando…" : item.assignment ? "Liberar" : "Tomar"}
                  </button>
                ) : null}
              </span>
            </div>
          )) : (
            <div className="section-table__state">No hay alertas operativas pendientes.</div>
          )}
        </div>
      </section>
      {actionErrorMessage ? <p className="form-error">{actionErrorMessage}</p> : null}
      <section className="section-help-card">
        <SectionIcon name="alert" />
        <div><strong>Las alertas críticas pueden afectar la facturación automática.</strong><p>Resolvelas cuanto antes para evitar interrupciones.</p></div>      </section>
    </main>
  );
}
