import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { TextField } from "@/components/ui/Field";
import { FiscalNumber, Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { getPaymentMethodLabel } from "@/lib/fiscalLabels";
import { toArgentinaDateInput } from "@/lib/formatters";
import { saveBlobAsFile } from "@/lib/portalApi";
import { formatShortDateTime, getInvoiceNumberLabel } from "@/lib/portalInvoices";
import { getPaymentGroup, PAYMENT_GROUPS, type PortalPayment } from "@/lib/portalPayments";

type PaymentsResponse = {
  items: PortalPayment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const PAGE_SIZE = 20;

const columns: DataTableColumn<PortalPayment>[] = [
  { id: "date", header: "Fecha", width: "8rem", cell: (row) => <span className="portal-mono">{formatShortDateTime(row.date_approved ?? row.createdAt)}</span> },
  { id: "method", header: "Medio de pago", primary: true, cell: (row) => getPaymentMethodLabel(row.payment_method_id, "Mercado Pago") },
  {
    id: "invoice",
    header: "Factura",
    cell: (row) => {
      const number = getInvoiceNumberLabel({ cbteNro: row.cbte_nro, cbteTipo: row.cbte_tipo });
      if (!number) return <span className="portal-muted">Sin emitir</span>;
      return row.invoice ? (
        <Link className="portal-link portal-link--plain" to={`/portal-cliente/comprobantes/${row.invoice.id}`} data-row-ignore>
          <FiscalNumber kind="plain" value={number} />
        </Link>
      ) : (
        <FiscalNumber kind="plain" value={number} />
      );
    },
  },
  { id: "customer", header: "Cliente", hideBelow: "md", cell: (row) => row.customer?.trim() || "Consumidor final" },
  { id: "amount", header: "Importe", align: "end", numeric: true, cell: (row) => <Money value={row.amount} currency={row.currency ?? "ARS"} /> },
  {
    id: "status",
    header: "Estado",
    cell: (row) => {
      const group = getPaymentGroup(row.status);
      return <StatusBadge tone={group.tone}>{group.label}</StatusBadge>;
    },
  },
];

export function ClientPaymentsPage() {
  const api = usePortalApi();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const group = PAYMENT_GROUPS.find((item) => item.slug === params.get("estado")) ?? PAYMENT_GROUPS[0];
  const page = Math.max(1, Number(params.get("pagina")) || 1);
  const dateFrom = params.get("desde") ?? "";
  const dateTo = params.get("hasta") ?? "";
  const query = params.get("q") ?? "";
  const [search, setSearch] = useState(query);
  const [isExporting, setIsExporting] = useState(false);

  /** Cambia filtros en la URL; cualquier filtro nuevo vuelve a la página 1. */
  function updateParams(changes: Record<string, string | null>, resetPage = true) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete("pagina");
    setParams(next, { replace: true });
  }

  // La búsqueda se aplica 300 ms después de dejar de escribir.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (search.trim() !== query) updateParams({ q: search.trim() || null });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filters = new URLSearchParams();
  if (group.statuses.length) filters.set("status", group.statuses.join(","));
  if (query) filters.set("search", query);
  if (dateFrom) filters.set("dateFrom", dateFrom);
  if (dateTo) filters.set("dateTo", dateTo);
  const listParams = new URLSearchParams(filters);
  listParams.set("page", String(page));
  listParams.set("pageSize", String(PAGE_SIZE));

  const list = usePortalResource<PaymentsResponse>(`/portal/payments?${listParams}`, { fallbackErrorMessage: "No pudimos cargar las ventas." });
  const hasFilters = Boolean(group.key !== "all" || query || dateFrom || dateTo);

  async function exportCsv() {
    setIsExporting(true);
    try {
      const suffix = filters.size ? `?${filters}` : "";
      const { blob, headers } = await api.requestFile(`/portal/payments/export.csv${suffix}`);
      saveBlobAsFile(blob, `ventas-${toArgentinaDateInput(new Date())}.csv`);
      if (headers.get("X-Export-Truncated") === "true") {
        const max = Number(headers.get("X-Export-Max-Rows")) || 10000;
        toast.info("Exportamos las primeras ventas", { description: `El archivo tiene las ${max.toLocaleString("es-AR")} más recientes. Acotá las fechas para bajar el resto.` });
      } else {
        toast.success("Listo, descargamos el archivo", { description: "Se abre directo en Excel." });
      }
    } catch (cause) {
      toast.error("No pudimos exportar las ventas", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="portal-page portal-payments">
      <PageHeader
        title="Ventas"
        description="Los cobros que leemos de Mercado Pago y la factura de cada uno."
        actions={
          <Button variant="secondary" iconLeft="download" onClick={() => void exportCsv()} loading={isExporting} loadingLabel="Exportando…">
            Exportar para Excel
          </Button>
        }
      />

      <div className="portal-filters" role="search" aria-label="Filtrar ventas">
        <TextField
          label="Buscar"
          hideLabel
          type="search"
          leading={<AppIcon name="search" />}
          placeholder="Operación, factura, cliente o documento"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          fieldClassName="portal-filters__search"
        />
        <TextField label="Desde" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => updateParams({ desde: event.target.value || null })} fieldClassName="portal-filters__date" />
        <TextField label="Hasta" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => updateParams({ hasta: event.target.value || null })} fieldClassName="portal-filters__date" />
        {hasFilters ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setParams({}, { replace: true });
            }}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      <div className="portal-chips" role="group" aria-label="Filtrar por estado">
        {PAYMENT_GROUPS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="portal-chip"
            aria-pressed={item.key === group.key}
            onClick={() => updateParams({ estado: item.key === "all" ? null : item.slug })}
          >
            {"chip" in item ? item.chip : item.label}
          </button>
        ))}
      </div>

      <DataTable
        caption="Ventas"
        columns={columns}
        rows={list.data?.items}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/portal-cliente/pagos/${row.id}`}
        getRowLabel={(row) => `Ver venta del ${formatShortDateTime(row.date_approved ?? row.createdAt)}`}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        errorMessage={list.errorMessage}
        onRetry={() => void list.reload()}
        skeletonRows={8}
        empty={
          hasFilters
            ? { icon: "search-empty", title: "No hay ventas con esos filtros", description: "Probá con otras fechas o limpiá la búsqueda." }
            : { title: "Todavía no hay ventas", description: "Cuando conectes Mercado Pago, las ventas aparecen acá." }
        }
      />

      {list.data && list.data.pagination.totalPages > 1 ? (
        <Pagination
          page={list.data.pagination.page}
          pageCount={list.data.pagination.totalPages}
          totalItems={list.data.pagination.total}
          pageSize={list.data.pagination.pageSize}
          itemLabel="ventas"
          disabled={list.isRefreshing}
          onPageChange={(next) => updateParams({ pagina: next > 1 ? String(next) : null }, false)}
        />
      ) : null}
    </div>
  );
}
