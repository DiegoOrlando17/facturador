import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { ApiError, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";

type SummaryResponse = {
  totals: { paymentsCount: number; totalAmount: number; avgTicket: number };
  byStatus: Record<string, { count: number; amount: number }>;
};

type TimeseriesResponse = {
  series: Array<{ bucketStart: string; paymentsCount: number; totalAmount: number }>;
};

type Granularity = "day" | "week" | "month";

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { dateFrom: toInputDate(from), dateTo: toInputDate(today) };
}

function formatPeriod(value: string, granularity: Granularity) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", granularity === "month"
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function ClientReportsPage() {
  const navigate = useNavigate();
  const { invalidateSession, token } = useTenantAuth();
  const initialRange = useMemo(initialDateRange, []);
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom);
  const [dateTo, setDateTo] = useState(initialRange.dateTo);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadReports = useCallback(async () => {
    if (!token) return;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setErrorMessage("La fecha desde no puede ser posterior a la fecha hasta.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    const params = new URLSearchParams({ dateFrom, dateTo });
    const seriesParams = new URLSearchParams(params);
    seriesParams.set("granularity", granularity);
    try {
      const [summaryResponse, timeseriesResponse] = await Promise.all([
        apiRequest<SummaryResponse>(`/portal/reports/summary?${params}`, { token, skipAuthHandling: true }),
        apiRequest<TimeseriesResponse>(`/portal/reports/timeseries?${seriesParams}`, { token, skipAuthHandling: true }),
      ]);
      setSummary(summaryResponse);
      setTimeseries(timeseriesResponse);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        invalidateSession();
        navigate("/portal-cliente/login", { replace: true });
        return;
      }
      setErrorMessage(getApiErrorMessage(error, "No se pudieron cargar los reportes."));
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, granularity, invalidateSession, navigate, token]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  return (
    <main className="client-main client-reports-page">
      <header className="app-topbar">
        <div><strong>Reportes</strong><span>Analiza importes y cantidad de pagos por periodo.</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadReports()} disabled={isLoading}><AppIcon name="refresh" /><span>Actualizar</span></button>
      </header>

      <section className="client-report-filters" aria-label="Filtros del reporte">
        <label className="field"><span>Desde</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="field"><span>Hasta</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label className="field"><span>Agrupar por</span><select value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mes</option></select></label>
      </section>

      {errorMessage ? <section className="section-table__state section-table__state--danger" role="alert"><span>{errorMessage}</span><button type="button" className="section-button" onClick={() => void loadReports()}>Reintentar</button></section> : null}

      <section className="client-report-kpis" aria-busy={isLoading}>
        <article><span>Pagos</span><strong>{isLoading ? "--" : summary?.totals.paymentsCount ?? 0}</strong><small>En el periodo</small></article>
        <article><span>Importe total</span><strong>{isLoading ? "--" : formatCurrency(summary?.totals.totalAmount)}</strong><small>Procesado</small></article>
        <article><span>Ticket promedio</span><strong>{isLoading ? "--" : formatCurrency(summary?.totals.avgTicket)}</strong><small>Por pago</small></article>
      </section>

      <section className="section-table-card section-table-card--scrollable">
        <div className="section-subheading"><h2>Evolucion</h2><p>Los importes se agrupan por fecha de acreditacion o, si falta, por fecha de registro.</p></div>
        <div className="section-table client-report-table">
          <div className="section-table__head"><span>Periodo</span><span>Pagos</span><span>Importe</span></div>
          {isLoading ? <div className="section-table__state">Calculando reporte...</div>
            : timeseries?.series.length ? timeseries.series.map((item) => <div className="section-table__row" key={item.bucketStart}><strong>{formatPeriod(item.bucketStart, granularity)}</strong><span>{item.paymentsCount}</span><span>{formatCurrency(item.totalAmount)}</span></div>)
              : <div className="section-table__state">No hay pagos en el periodo seleccionado.</div>}
        </div>
      </section>

      <section className="client-table-card">
        <div className="admin-section-heading"><h2>Estados del periodo</h2></div>
        {summary && Object.keys(summary.byStatus).length ? <div className="client-status-grid">{Object.entries(summary.byStatus).map(([status, item]) => <article key={status}><span>{status.replace(/_/g, " ")}</span><strong>{item.count}</strong><small>{formatCurrency(item.amount)}</small></article>)}</div> : <p className="client-empty-state">Sin estados para mostrar.</p>}
      </section>
    </main>
  );
}
