import { Link } from "react-router-dom";
import { type FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { useApiResource } from "@/hooks/useApiResource";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";

type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  currentSubscription: {
    id?: string;
    status: string;
    planCode: string | null;
    planName: string | null;
  };
  integrations: {
    overallHealth: "healthy" | "attention" | "setup_pending";
    enabledCount: number;
    configuredCount: number;
    needsAttentionCount: number;
  };
};

type TenantsResponse = {
  items: TenantListItem[];
  total: number;
};

type CreateTenantResponse = {
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  id?: string;
  name?: string;
  slug?: string;
};

type DeleteTenantResponse = {
  ok: boolean;
  tenant: {
    slug: string;
    name: string;
  };
  deleted?: Record<string, number>;
};

function getMonthStartDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

function getStatusLabel(status: TenantListItem["status"]) {
  return status === "ACTIVE" ? "Activo" : "Deshabilitado";
}

function getHealthLabel(health: TenantListItem["integrations"]["overallHealth"]) {
  switch (health) {
    case "healthy":
      return "Saludable";
    case "attention":
      return "Atencion";
    case "setup_pending":
      return "Pendiente";
    default:
      return "Sin datos";
  }
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

export function TenantsPage() {
  const { can, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(() => searchParams.get("new") === "1");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantStatus, setTenantStatus] = useState<TenantListItem["status"]>("ACTIVE");
  const [mercadoPagoPaymentsFrom, setMercadoPagoPaymentsFrom] = useState(getMonthStartDate);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingTenantSlug, setDeletingTenantSlug] = useState<string | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const {
    data,
    errorMessage,
    isLoading,
    reload,
  } = useApiResource<TenantsResponse>("/admin/tenants", {
    fallbackErrorMessage: "No se pudo cargar el listado de tenants.",
  });

  const items = data?.items ?? [];
  const attentionOnly = searchParams.get("attention") === "1" || searchParams.get("alerts") === "1";
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scopedItems = attentionOnly
      ? items.filter((tenant) =>
        tenant.integrations.overallHealth === "attention"
        || tenant.integrations.needsAttentionCount > 0,
      )
      : items;

    if (!normalizedQuery) {
      return scopedItems;
    }

    return scopedItems.filter((tenant) =>
      tenant.name.toLowerCase().includes(normalizedQuery)
      || tenant.slug.toLowerCase().includes(normalizedQuery),
    );
  }, [attentionOnly, items, query]);

  const normalizedTenantSlug = tenantSlug.trim();
  const canCreateTenant = Boolean(tenantName.trim() && normalizedTenantSlug && token && !isCreating);

  function handleTenantNameChange(value: string) {
    setTenantName(value);
    setCreateErrorMessage(null);
    setCreateSuccessMessage(null);

    if (!tenantSlug.trim()) {
      setTenantSlug(createSlug(value));
    }
  }

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setCreateErrorMessage("Tu sesion no esta disponible. Ingresa nuevamente para crear tenants.");
      return;
    }

    if (!canCreateTenant) {
      setCreateErrorMessage("Completa nombre y slug para crear el tenant.");
      return;
    }

    setIsCreating(true);
    setCreateErrorMessage(null);
    setCreateSuccessMessage(null);

    try {
      const createdTenant = await apiRequest<CreateTenantResponse>("/admin/tenants", {
        method: "POST",
        token,
        body: {
          name: tenantName.trim(),
          slug: normalizedTenantSlug,
          status: tenantStatus,
          processingStartDate: mercadoPagoPaymentsFrom || null,
        },
      });
      const createdTenantName = createdTenant.tenant?.name ?? createdTenant.name ?? tenantName.trim();

      setTenantName("");
      setTenantSlug("");
      setTenantStatus("ACTIVE");
      setMercadoPagoPaymentsFrom(getMonthStartDate());
      setCreateSuccessMessage(`Tenant ${createdTenantName} creado correctamente. Revisa el detalle para cargar integraciones y procesar pagos.`);
      await reload();
    } catch (error) {
      setCreateErrorMessage(getApiErrorMessage(error, "No se pudo crear el tenant."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteTenant(tenant: TenantListItem) {
    if (!token) {
      setDeleteErrorMessage("Tu sesion no esta disponible. Ingresa nuevamente para eliminar tenants.");
      return;
    }

    const confirmedSlug = window.prompt(
      `Esto elimina ${tenant.name} y toda su informacion local asociada. Escribi el slug "${tenant.slug}" para confirmar.`,
    );

    if (confirmedSlug !== tenant.slug) {
      return;
    }

    setDeletingTenantSlug(tenant.slug);
    setDeleteErrorMessage(null);
    setDeleteSuccessMessage(null);

    try {
      const response = await apiRequest<DeleteTenantResponse>(
        `/admin/tenants/${tenant.slug}?deleteLocalFiles=true`,
        {
          method: "DELETE",
          token,
        },
      );

      setDeleteSuccessMessage(`Tenant ${response.tenant.name} eliminado correctamente.`);
      await reload();
    } catch (error) {
      setDeleteErrorMessage(getApiErrorMessage(error, "No se pudo eliminar el tenant."));
    } finally {
      setDeletingTenantSlug(null);
    }
  }

  return (
    <main className="shell shell--app">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Clientes</span>
          <h1>Clientes</h1>
          <p>
            {attentionOnly
              ? "Revisa los clientes que tienen alertas o integraciones pendientes."
              : "Busca, crea y revisa cada cliente junto con su estado operativo."}
          </p>

          <div className="hero-actions">
            <PermissionGate
              permission="tenants:manage"
              fallback={
                <button type="button" className="secondary-button" disabled>
                  Solo lectura
                </button>
              }
            >
              <button
                type="button"
                className="primary-button"
                onClick={() => setIsCreatePanelOpen((currentValue) => !currentValue)}
              >
                {isCreatePanelOpen ? "Cerrar formulario" : "Nuevo tenant"}
              </button>
            </PermissionGate>
            <button type="button" className="secondary-button" onClick={() => void reload()}>
              Actualizar listado
            </button>
          </div>
        </div>

        <div className="spotlight-card">
          <p>Resumen del modulo</p>
          <strong>{data ? `${data.total} tenants cargados` : "Cargando tenants..."}</strong>
          <span>
            {data
              ? `${items.filter((tenant) => tenant.status === "ACTIVE").length} activos y ${items.filter((tenant) => tenant.integrations.overallHealth === "attention").length} con alertas.`
              : "Consultando estado general del monitor."}
          </span>
          <small className="spotlight-card__meta">
            {can("tenants:manage")
              ? "Tu rol puede crear clientes y actualizar el listado."
              : "Tu rol puede consultar clientes, pero no modificarlos."}
          </small>
        </div>
      </section>

      {isCreatePanelOpen ? (
        <section className="panel tenant-form-panel" aria-label="Crear tenant">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Alta de cliente</span>
              <h2>Nuevo tenant</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsCreatePanelOpen(false);
                setCreateErrorMessage(null);
                setCreateSuccessMessage(null);
              }}
            >
              Cancelar
            </button>
          </div>

          <form className="tenant-form" onSubmit={(event) => void handleCreateTenant(event)}>
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
                  setTenantSlug(createSlug(event.target.value));
                  setCreateErrorMessage(null);
                  setCreateSuccessMessage(null);
                }}
                placeholder="cliente-sur"
                disabled={isCreating}
              />
            </label>

            <label className="field">
              <span>Estado inicial</span>
              <select
                value={tenantStatus}
                onChange={(event) => setTenantStatus(event.target.value as TenantListItem["status"])}
                disabled={isCreating}
              >
                <option value="ACTIVE">Activo</option>
                <option value="DISABLED">Deshabilitado</option>
              </select>
            </label>

            <label className="field">
              <span>Traer pagos de MP desde</span>
              <input
                type="date"
                value={mercadoPagoPaymentsFrom}
                onChange={(event) => {
                  setMercadoPagoPaymentsFrom(event.target.value);
                  setCreateErrorMessage(null);
                  setCreateSuccessMessage(null);
                }}
                disabled={isCreating}
              />
            </label>

            <div className="tenant-form__actions">
              <button type="submit" className="primary-button" disabled={!canCreateTenant}>
                {isCreating ? "Creando..." : "Crear tenant"}
              </button>
              <span>
                La fecha permite pedir el backfill inicial de Mercado Pago desde el arranque del cliente.
              </span>
            </div>

            {createErrorMessage ? <p className="form-error">{createErrorMessage}</p> : null}
            {createSuccessMessage ? <p className="form-success">{createSuccessMessage}</p> : null}
          </form>
        </section>
      ) : null}

      <section className="panel tenants-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Listado</span>
            <h2>{attentionOnly ? "Clientes que requieren atencion" : "Tenants"}</h2>
          </div>
          <label className="field tenants-search">
            <span>Buscar por nombre o slug</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="demo, cliente sur..."
            />
          </label>
        </div>

        {deleteErrorMessage ? <p className="form-error tenants-delete-feedback">{deleteErrorMessage}</p> : null}
        {deleteSuccessMessage ? <p className="form-success tenants-delete-feedback">{deleteSuccessMessage}</p> : null}

        {isLoading ? (
          <div className="panel-state">
            <strong>Cargando tenants...</strong>
            <span>Estamos trayendo el listado del backend admin.</span>
          </div>
        ) : errorMessage ? (
          <div className="panel-state panel-state--danger">
            <strong>No pudimos cargar el listado</strong>
            <span>{errorMessage}</span>
            <button type="button" className="secondary-button" onClick={() => void reload()}>
              Reintentar
            </button>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="tenants-list" aria-label="Listado de tenants">
            {filteredItems.map((tenant) => (
              <article key={tenant.id} className="tenant-card">
                <div className="tenant-card__header">
                  <div>
                    <strong>{tenant.name}</strong>
                    <span>{tenant.slug}</span>
                  </div>
                  <div className="tenant-card__badges">
                    <span className={`badge badge--${tenant.status === "ACTIVE" ? "success" : "muted"}`}>
                      {getStatusLabel(tenant.status)}
                    </span>
                    <span className={`badge badge--${tenant.integrations.overallHealth === "healthy" ? "success" : tenant.integrations.overallHealth === "attention" ? "warning" : "muted"}`}>
                      {getHealthLabel(tenant.integrations.overallHealth)}
                    </span>
                  </div>
                </div>

                <div className="tenant-card__grid">
                  <div>
                    <span>Plan</span>
                    <strong>{tenant.currentSubscription.planName ?? "Sin plan activo"}</strong>
                  </div>
                  <div>
                    <span>Usuarios</span>
                    <strong>{tenant.usersCount}</strong>
                  </div>
                  <div>
                    <span>Integraciones</span>
                    <strong>{tenant.integrations.configuredCount}/{tenant.integrations.enabledCount} configuradas</strong>
                  </div>
                  <div>
                    <span>Actualizado</span>
                    <strong>{formatDateTime(tenant.updatedAt)}</strong>
                  </div>
                </div>

                <div className="tenant-card__footer">
                  <span>
                    {tenant.integrations.needsAttentionCount > 0
                      ? `${tenant.integrations.needsAttentionCount} integraciones necesitan atencion.`
                      : "Sin alertas visibles en integraciones."}
                  </span>
                  <Link to={`/admin/tenants/${tenant.slug}`} className="secondary-button tenant-card__link">
                    Ver detalle
                  </Link>
                  <PermissionGate permission="tenants:delete">
                    <button
                      type="button"
                      className="secondary-button secondary-button--danger"
                      disabled={deletingTenantSlug === tenant.slug}
                      onClick={() => void handleDeleteTenant(tenant)}
                    >
                      {deletingTenantSlug === tenant.slug ? "Eliminando..." : "Eliminar"}
                    </button>
                  </PermissionGate>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel-state">
            <strong>No encontramos tenants con ese filtro</strong>
            <span>Prueba buscando por otro nombre o slug.</span>
          </div>
        )}
      </section>
    </main>
  );
}
