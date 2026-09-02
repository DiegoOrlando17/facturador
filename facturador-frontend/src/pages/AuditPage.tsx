import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { formatDateTime } from "@/lib/formatters";

type AuditEntry = {
  id: string;
  tenant: { id: string; slug: string; name: string } | null;
  actorType: string;
  actorId: string | null;
  adminUser: { id: string; name: string | null; email: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

type AuditResponse = { items: AuditEntry[]; total: number };

function formatJson(value: unknown) {
  return value === null ? "Sin datos" : JSON.stringify(value, null, 2);
}

export function AuditPage() {
  const { token } = useAuth();
  const [tenantInput, setTenantInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [filters, setFilters] = useState({ tenant: "", action: "" });
  const query = useMemo(() => {
    const params = new URLSearchParams({ take: "100" });
    if (filters.tenant) params.set("tenant", filters.tenant);
    if (filters.action) params.set("action", filters.action);
    return params.toString();
  }, [filters]);
  const { data, errorMessage, isLoading, reload } = useApiResource<AuditResponse>(`/admin/audit?${query}`, {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudo cargar la auditoria.",
  });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ tenant: tenantInput.trim(), action: actionInput.trim() });
  }

  return (
    <main className="admin-section-page">
      <div className="admin-section-header">
        <div><h1>Auditoria</h1><p>Historial de acciones administrativas sensibles registradas por el backend.</p></div>
        <button type="button" className="section-button section-button--soft" onClick={() => void reload()}>Actualizar</button>
      </div>
      <section className="panel">
        <form className="settings-form__split" onSubmit={applyFilters}>
          <label className="field"><span>Tenant</span><input value={tenantInput} onChange={(event) => setTenantInput(event.target.value)} placeholder="fiebre" /></label>
          <label className="field"><span>Accion</span><input value={actionInput} onChange={(event) => setActionInput(event.target.value)} placeholder="payment_reprocess" /></label>
          <button type="submit" className="primary-button">Filtrar</button>
        </form>
      </section>
      <section className="admin-single-column">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Registro</span><h2>{data ? `${data.total} acciones` : "Auditoria"}</h2></div></div>
          <div className="audit-list">
            {isLoading ? <div className="panel-state">Cargando auditoria...</div>
              : errorMessage ? <div className="panel-state panel-state--danger">{errorMessage}</div>
                : data?.items.length ? data.items.map((entry) => (
                  <article key={entry.id} className="admin-user-card audit-card">
                    <div>
                      <strong>{entry.action.replace(/_/g, " ")}</strong>
                      <span>{entry.adminUser?.email ?? `${entry.actorType} ${entry.actorId ?? "sin ID"}`}</span>
                      <small>{formatDateTime(entry.createdAt)}</small>
                    </div>
                    <div>
                      {entry.tenant ? <Link to={`/tenants/${entry.tenant.slug}`}>{entry.tenant.name}</Link> : <span>Sin tenant</span>}
                      <span>{`${entry.entityType}${entry.entityId ? ` #${entry.entityId}` : ""}`}</span>
                    </div>
                    <details><summary>Ver cambios</summary><pre>{`Antes\n${formatJson(entry.before)}\n\nDespues\n${formatJson(entry.after)}`}</pre></details>
                  </article>
                )) : <div className="panel-state">No hay acciones para los filtros seleccionados.</div>}
          </div>
          {data && data.total > data.items.length ? <p className="section-next-action">Se muestran las 100 acciones mas recientes.</p> : null}
        </article>
      </section>
    </main>
  );
}
