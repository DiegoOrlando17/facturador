import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { saveBlobAsFile } from "@/lib/portalApi";
import { formatCurrency, formatDateTime, toArgentinaDateInput } from "@/lib/formatters";
import { getPaymentStatusLabel } from "@/lib/portalStatusLabels";

type PortalPayment = {
  id: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  amount: number;
  customer: string | null;
  createdAt: string;
  error: string | null;
  cae: string | null;
  cbte_nro: string | null;
};

type PaymentsResponse = {
  items: PortalPayment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const statusOptions = [
  ["", "Todos los estados"], ["pending", "Pago recibido"], ["processing", "En proceso"],
  ["afip_pending", "Pendiente ARCA"], ["pdf_pending", "Pendiente PDF"],
  ["drive_pending", "Pendiente Drive"], ["sheets_pending", "Pendiente Sheets"],
  ["complete", "Facturado"], ["failed", "Con error"],
];

function statusLabel(payment: PortalPayment) {
  if (payment.cae) return "Comprobante emitido";
  return getPaymentStatusLabel(payment.status);
}

export function ClientPaymentsPage() {
  const api = usePortalApi();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (status) params.set("status", status);
  const { data, isLoading, isRefreshing, errorMessage, reload } = usePortalResource<PaymentsResponse>(
    `/portal/payments?${params}`,
    { fallbackErrorMessage: "No pudimos cargar las ventas. Reintentá." },
  );
  const isBusy = isLoading || isRefreshing;

  async function exportCsv() {
    setIsExporting(true);
    setExportErrorMessage("");
    const exportParams = new URLSearchParams();
    if (search.trim()) exportParams.set("search", search.trim());
    if (status) exportParams.set("status", status);
    try {
      const suffix = exportParams.size ? `?${exportParams}` : "";
      const blob = await api.requestBlob(`/portal/payments/export.csv${suffix}`);
      saveBlobAsFile(blob, `pagos-${toArgentinaDateInput(new Date())}.csv`);
    } catch (error) {
      setExportErrorMessage(getPortalErrorMessage(error, "No pudimos exportar el CSV. Reintentá."));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="client-main client-payments-page">
      <header className="app-topbar">
        <div><strong>Pagos y facturas</strong><span>Consultá los cobros y comprobantes de tu empresa.</span></div>
        <div className="app-topbar__actions">
          <button type="button" className="secondary-button" onClick={() => void exportCsv()} disabled={isExporting}><AppIcon name="download" />{isExporting ? "Exportando…" : "Exportar CSV"}</button>
          <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void reload()} disabled={isBusy}><AppIcon name="refresh" /><span>{isRefreshing ? "Actualizando…" : "Actualizar"}</span></button>
        </div>
      </header>

      {exportErrorMessage ? <p className="form-error" role="alert">{exportErrorMessage}</p> : null}
      <p className="client-export-note">La exportación respeta la búsqueda y el estado seleccionados, con un máximo de 10.000 filas.</p>

      <section className="section-toolbar" aria-label="Filtros de pagos">
        <label className="section-search"><AppIcon name="search" /><input type="search" aria-label="Buscar pagos" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar pago, comprobante o cliente" /></label>
        <select className="section-select" aria-label="Filtrar por estado" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className="section-button section-button--soft" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>Limpiar</button>
      </section>

      <section className="section-table-card section-table-card--scrollable" aria-busy={isBusy}>
        <div className="section-table client-payments-table">
          <div className="section-table__head"><span>Fecha</span><span>Comprobante</span><span>Cliente</span><span>Monto</span><span>Estado</span><span>Acción</span></div>
          {isLoading ? <div className="section-table__state">Cargando ventas…</div>
            : errorMessage ? <div className="section-table__state section-table__state--danger"><span>{errorMessage}</span><button type="button" className="section-button" onClick={() => void reload()}>Reintentar</button></div>
              : data?.items.length ? data.items.map((payment) => (
                <div className="section-table__row" key={payment.id}>
                  <span>{formatDateTime(payment.createdAt)}</span>
                  <strong>{payment.cbte_nro ?? "Sin comprobante"}</strong>
                  <span>{payment.customer ?? "Consumidor final"}</span>
                  <span>{formatCurrency(payment.amount)}</span>
                  <span><small className={`status-pill status-pill--${payment.error ? "warning" : payment.cae ? "success" : "muted"}`}>{statusLabel(payment)}</small></span>
                  <Link className="section-mini-button" to={`/portal-cliente/pagos/${payment.id}`}>Abrir</Link>
                </div>
              )) : <div className="section-table__state">No hay ventas con esos filtros.</div>}
        </div>
      </section>

      <div className="section-pagination">
        <button type="button" disabled={page <= 1 || isBusy} onClick={() => setPage((current) => current - 1)}>Anterior</button>
        <span>Página <b>{data?.pagination.page ?? page}</b> de {data?.pagination.totalPages ?? 1}</span>
        <button type="button" disabled={page >= (data?.pagination.totalPages ?? 1) || isBusy} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
      </div>
    </main>
  );
}
