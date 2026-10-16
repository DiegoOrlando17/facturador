import { useMemo, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { usePortalQuery } from "@/hooks/usePortalResource";
import { ARGENTINA_TIMEZONE, formatCurrency, toArgentinaDateInput } from "@/lib/formatters";
import { getPaymentStatusLabel } from "@/lib/portalStatusLabels";

type SummaryResponse = {
  totals: { paymentsCount: number; totalAmount: number; avgTicket: number };
  byStatus: Record<string, { count: number; amount: number }>;
};

type TimeseriesResponse = {
  series: Array<{ bucketStart: string; paymentsCount: number; totalAmount: number }>;
};

type Granularity = "day" | "week" | "month";

function initialDateRange() {
  const today = new Date();
  const from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { dateFrom: toArgentinaDateInput(from), dateTo: toArgentinaDateInput(today) };
}

// El backend agrupa en hora argentina y devuelve el inicio de cada período como instante UTC.
function formatPeriod(value: string, granularity: Granularity) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", granularity === "month"
    ? { month: "long", year: "numeric", timeZone: ARGENTINA_TIMEZONE }
    : { day: "2-digit", month: "short", year: "numeric", timeZone: ARGENTINA_TIMEZONE }).format(date);
}

export function ClientReportsPage() {
  const initialRange = useMemo(initialDateRange, []);
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [granularity, setGranularity] = useState<Granularity>("day");

  const hasInvalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const params = new URLSearchParams({ dateFrom, dateTo });
  const seriesParams = new URLSearchParams(params);
  seriesParams.set("granularity", granularity);
  const queryKey = hasInvalidRange ? null : `reports?${seriesParams}`;

  const { data, isLoading: isFirstLoad, isRefreshing, errorMessage: loadError, reload: loadReports } = usePortalQuery(
    queryKey,
    async (portal, signal) => {
      const [summary, timeseries] = await Promise.all([
        portal.request<SummaryResponse>(`/portal/reports/summary?${params}`, { signal }),
        portal.request<TimeseriesResponse>(`/portal/reports/timeseries?${seriesParams}`, { signal }),
      ]);
      return { summary, timeseries };
    },
    { fallbackErrorMessage: "No pudimos cargar los reportes. Reintentá." },
  );
  const isLoading = isFirstLoad || isRefreshing;
  const summary = data?.summary ?? null;
  const timeseries = data?.timeseries ?? null;
  const errorMessage = hasInvalidRange ? "La fecha desde no puede ser posterior a la fecha hasta." : loadError;

  return (
    <div className="client-main client-reports-page">
      <header className="app-topbar">
        <div><strong>Reportes</strong><span>Analizá importes y cantidad de ventas por período (hora de Argentina).</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadReports()} disabled={isLoading || hasInvalidRange}><AppIcon name="refresh" /><span>{isRefreshing ? "Actualizando…" : "Actualizar"}</span></button>
      </header>

      <section className="client-report-filters" aria-label="Filtros del reporte">
        <label className="field"><span>Desde</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="field"><span>Hasta</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label className="field"><span>Agrupar por</span><select value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select></label>
      </section>

      {errorMessage ? <section className="section-table__state section-table__state--danger" role="alert"><span>{errorMessage}</span>{hasInvalidRange ? null : <button type="button" className="section-button" onClick={() => void loadReports()}>Reintentar</button>}</section> : null}

      <section className="client-report-kpis" aria-busy={isLoading}>
        <article><span>Ventas</span><strong>{isLoading || !summary ? "--" : summary.totals.paymentsCount}</strong><small>En el período</small></article>
        <article><span>Importe total</span><strong>{isLoading || !summary ? "--" : formatCurrency(summary.totals.totalAmount)}</strong><small>Procesado</small></article>
        <article><span>Ticket promedio</span><strong>{isLoading || !summary ? "--" : formatCurrency(summary.totals.avgTicket)}</strong><small>Por venta</small></article>
      </section>

      <section className="section-table-card section-table-card--scrollable">
        <div className="section-subheading"><h2>Evolución</h2><p>Los importes se agrupan por fecha de acreditación o, si falta, por fecha de registro, en hora de Argentina.</p></div>
        <div className="section-table client-report-table">
          <div className="section-table__head"><span>Período</span><span>Ventas</span><span>Importe</span></div>
          {isLoading ? <div className="section-table__state">Calculando reporte…</div>
            : timeseries?.series.length ? timeseries.series.map((item) => <div className="section-table__row" key={item.bucketStart}><strong>{formatPeriod(item.bucketStart, granularity)}</strong><span>{item.paymentsCount}</span><span>{formatCurrency(item.totalAmount)}</span></div>)
              : <div className="section-table__state">No hay ventas en el período elegido.</div>}
        </div>
      </section>

      <section className="client-table-card">
        <div className="admin-section-heading"><h2>Estados del período</h2></div>
        {summary && Object.keys(summary.byStatus).length ? <div className="client-status-grid">{Object.entries(summary.byStatus).map(([status, item]) => <article key={status}><span>{getPaymentStatusLabel(status)}</span><strong>{item.count}</strong><small>{formatCurrency(item.amount)}</small></article>)}</div> : <p className="client-empty-state">Sin estados para mostrar.</p>}
      </section>
    </div>
  );
}
