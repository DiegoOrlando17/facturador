import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { ApiError, apiBlobRequest, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

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
  return payment.status.replace(/_/g, " ");
}

export function ClientPaymentsPage() {
  const navigate = useNavigate();
  const { invalidateSession, token } = useTenantAuth();
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");

  const loadPayments = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage("");
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      setData(await apiRequest<PaymentsResponse>(`/portal/payments?${params}`, { token, skipAuthHandling: true }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        invalidateSession();
        navigate("/portal-cliente/login", { replace: true });
        return;
      }
      setErrorMessage(getApiErrorMessage(error, "No se pudieron cargar los pagos."));
    } finally {
      setIsLoading(false);
    }
  }, [invalidateSession, navigate, page, search, status, token]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  async function exportCsv() {
    if (!token) return;
    setIsExporting(true);
    setExportErrorMessage("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      const suffix = params.size ? `?${params}` : "";
      const blob = await apiBlobRequest(`/portal/payments/export.csv${suffix}`, { token, skipAuthHandling: true });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        invalidateSession();
        navigate("/portal-cliente/login", { replace: true });
        return;
      }
      setExportErrorMessage(getApiErrorMessage(error, "No se pudo exportar el CSV."));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="client-main client-payments-page">
      <header className="app-topbar">
        <div><strong>Pagos y facturas</strong><span>Consulta los cobros y comprobantes de tu empresa.</span></div>
        <div className="app-topbar__actions">
          <button type="button" className="secondary-button" onClick={() => void exportCsv()} disabled={isExporting}><AppIcon name="download" />{isExporting ? "Exportando..." : "Exportar CSV"}</button>
          <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadPayments()} disabled={isLoading}><AppIcon name="refresh" /><span>Actualizar</span></button>
        </div>
      </header>

      {exportErrorMessage ? <p className="form-error" role="alert">{exportErrorMessage}</p> : null}
      <p className="client-export-note">La exportacion respeta la busqueda y el estado seleccionados, con un maximo de 10.000 filas.</p>

      <section className="section-toolbar" aria-label="Filtros de pagos">
        <label className="section-search"><AppIcon name="search" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar pago, comprobante o cliente" /></label>
        <select className="section-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className="section-button section-button--soft" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>Limpiar</button>
      </section>

      <section className="section-table-card section-table-card--scrollable">
        <div className="section-table client-payments-table">
          <div className="section-table__head"><span>Fecha</span><span>Comprobante</span><span>Cliente</span><span>Monto</span><span>Estado</span><span>Accion</span></div>
          {isLoading ? <div className="section-table__state">Cargando pagos...</div>
            : errorMessage ? <div className="section-table__state section-table__state--danger"><span>{errorMessage}</span><button type="button" className="section-button" onClick={() => void loadPayments()}>Reintentar</button></div>
              : data?.items.length ? data.items.map((payment) => (
                <div className="section-table__row" key={payment.id}>
                  <span>{formatDateTime(payment.createdAt)}</span>
                  <strong>{payment.cbte_nro ?? `Pago ${payment.provider_payment_id ?? payment.id}`}</strong>
                  <span>{payment.customer ?? "Consumidor final"}</span>
                  <span>{formatCurrency(payment.amount)}</span>
                  <span><small className={`status-pill status-pill--${payment.error ? "warning" : payment.cae ? "success" : "muted"}`}>{statusLabel(payment)}</small></span>
                  <Link className="section-mini-button" to={`/portal-cliente/pagos/${payment.id}`}>Abrir</Link>
                </div>
              )) : <div className="section-table__state">No hay pagos con esos filtros.</div>}
        </div>
      </section>

      <div className="section-pagination">
        <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)}>Anterior</button>
        <span>Pagina <b>{data?.pagination.page ?? page}</b> de {data?.pagination.totalPages ?? 1}</span>
        <button type="button" disabled={page >= (data?.pagination.totalPages ?? 1) || isLoading} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
      </div>
    </main>
  );
}
