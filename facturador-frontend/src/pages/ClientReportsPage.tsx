import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ColumnChart, type ColumnDatum } from "@/components/charts/ColumnChart";
import { StatCard } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/EmptyState";
import { SelectField, TextField } from "@/components/ui/Field";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePortalQuery } from "@/hooks/usePortalResource";
import { ARGENTINA_TIMEZONE, formatCurrency, formatNumber, toArgentinaDateInput } from "@/lib/formatters";
import { getPaymentGroup, PAYMENT_GROUPS } from "@/lib/portalPayments";

type SummaryResponse = {
  totals: { paymentsCount: number; totalAmount: number; avgTicket: number };
  byStatus: Record<string, { count: number; amount: number }>;
};
type SeriesPoint = { bucketStart: string; paymentsCount: number; totalAmount: number };
type TimeseriesResponse = { series: SeriesPoint[] };
type Granularity = "day" | "week" | "month";

/* Períodos ------------------------------------------------------------------- */

function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function monthStart(isoDate: string, monthsBack = 0) {
  const [y, m] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return date.toISOString().slice(0, 10);
}

const PERIODS = [
  { key: "este-mes", label: "Este mes" },
  { key: "mes-pasado", label: "Mes pasado" },
  { key: "30-dias", label: "Últimos 30 días" },
  { key: "12-meses", label: "Últimos 12 meses" },
  { key: "personalizado", label: "Otras fechas" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function resolvePeriod(key: PeriodKey, custom: { from: string; to: string; granularity: Granularity }) {
  const today = toArgentinaDateInput(new Date());
  switch (key) {
    case "mes-pasado": {
      const from = monthStart(today, 1);
      return { from, to: addDays(monthStart(today), -1), granularity: "day" as Granularity };
    }
    case "30-dias":
      return { from: addDays(today, -29), to: today, granularity: "day" as Granularity };
    case "12-meses":
      return { from: monthStart(today, 11), to: today, granularity: "month" as Granularity };
    case "personalizado":
      return custom;
    default:
      return { from: monthStart(today), to: today, granularity: "day" as Granularity };
  }
}

/** Completa los días o meses sin ventas para que el gráfico no saltee períodos. */
function fillSeries(series: SeriesPoint[], from: string, to: string, granularity: Granularity) {
  if (granularity === "week") return series.map((point) => ({ ...point, key: toArgentinaDateInput(new Date(point.bucketStart)) }));
  const byKey = new Map(series.map((point) => {
    const local = toArgentinaDateInput(new Date(point.bucketStart));
    return [granularity === "month" ? local.slice(0, 7) : local, point];
  }));
  const keys: string[] = [];
  if (granularity === "month") {
    for (let cursor = monthStart(from); cursor <= to; cursor = monthStart(addDays(cursor, 32))) keys.push(cursor.slice(0, 7));
  } else {
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) keys.push(cursor);
  }
  return keys.map((key) => {
    const point = byKey.get(key);
    return { key, bucketStart: point?.bucketStart ?? `${key.length === 7 ? `${key}-01` : key}T03:00:00.000Z`, paymentsCount: point?.paymentsCount ?? 0, totalAmount: point?.totalAmount ?? 0 };
  });
}

const dayFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: ARGENTINA_TIMEZONE });
const fullDayFormat = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: ARGENTINA_TIMEZONE });
const monthFormat = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: ARGENTINA_TIMEZONE });
const fullMonthFormat = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: ARGENTINA_TIMEZONE });
const compactMoney = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

function periodLabel(bucketStart: string, granularity: Granularity, long = false) {
  const date = new Date(bucketStart);
  if (granularity === "month") return (long ? fullMonthFormat : monthFormat).format(date);
  if (granularity === "week") return `${long ? "Semana del " : ""}${dayFormat.format(date)}`;
  return (long ? fullDayFormat : dayFormat).format(date);
}

/* Página ---------------------------------------------------------------------- */

export function ClientReportsPage() {
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.find((item) => item.key === params.get("periodo"))?.key ?? "este-mes") as PeriodKey;
  const today = toArgentinaDateInput(new Date());
  const custom = {
    from: params.get("desde") ?? addDays(today, -29),
    to: params.get("hasta") ?? today,
    granularity: (["day", "week", "month"].includes(params.get("agrupar") ?? "") ? params.get("agrupar") : "day") as Granularity,
  };
  const range = resolvePeriod(period, custom);
  const invalidRange = range.from > range.to;

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ dateFrom: range.from, dateTo: range.to });
  const seriesQuery = new URLSearchParams(query);
  seriesQuery.set("granularity", range.granularity);

  const reports = usePortalQuery(
    invalidRange ? null : `reports?${seriesQuery}`,
    async (portal, signal) => {
      const [summary, timeseries] = await Promise.all([
        portal.request<SummaryResponse>(`/portal/reports/summary?${query}`, { signal }),
        portal.request<TimeseriesResponse>(`/portal/reports/timeseries?${seriesQuery}`, { signal }),
      ]);
      return { summary, timeseries };
    },
    { fallbackErrorMessage: "No pudimos cargar los reportes." },
  );

  const points = useMemo(
    () => (reports.data ? fillSeries(reports.data.timeseries.series, range.from, range.to, range.granularity) : []),
    [reports.data, range.from, range.to, range.granularity],
  );

  const chartData: ColumnDatum[] = points.map((point) => ({
    key: point.key,
    label: periodLabel(point.bucketStart, range.granularity),
    value: point.totalAmount,
    ariaLabel: `${periodLabel(point.bucketStart, range.granularity, true)}: ${formatCurrency(point.totalAmount)} en ${point.paymentsCount} ventas`,
    tooltip: (
      <>
        <strong className="portal-chart-tip__title">{periodLabel(point.bucketStart, range.granularity, true)}</strong>
        <span className="portal-chart-tip__row">
          <span>Vendido</span>
          <Money value={point.totalAmount} />
        </span>
        <span className="portal-chart-tip__row">
          <span>Ventas</span>
          <span className="portal-mono">{formatNumber(point.paymentsCount)}</span>
        </span>
      </>
    ),
  }));

  const groups = PAYMENT_GROUPS.filter((group) => group.key !== "all").map((group) => {
    const entries = Object.entries(reports.data?.summary.byStatus ?? {}).filter(([status]) => getPaymentGroup(status).key === group.key);
    return { ...group, count: entries.reduce((sum, [, item]) => sum + item.count, 0), amount: entries.reduce((sum, [, item]) => sum + item.amount, 0) };
  });

  const tableColumns: DataTableColumn<(typeof points)[number]>[] = [
    { id: "period", header: "Período", primary: true, cell: (row) => periodLabel(row.bucketStart, range.granularity, true) },
    { id: "count", header: "Ventas", align: "end", numeric: true, cell: (row) => formatNumber(row.paymentsCount) },
    { id: "amount", header: "Vendido", align: "end", numeric: true, cell: (row) => <Money value={row.totalAmount} /> },
  ];

  const totals = reports.data?.summary.totals;
  const hasSales = Boolean(totals && totals.paymentsCount > 0);

  return (
    <div className="portal-page portal-reports">
      <PageHeader title="Reportes" description="Cuánto vendiste y cómo viene la facturación, en hora de Argentina." />

      <div className="portal-chips" role="group" aria-label="Período">
        {PERIODS.map((item) => (
          <button key={item.key} type="button" className="portal-chip" aria-pressed={item.key === period} onClick={() => update({ periodo: item.key === "este-mes" ? null : item.key })}>
            {item.label}
          </button>
        ))}
      </div>

      {period === "personalizado" ? (
        <div className="portal-filters">
          <TextField label="Desde" type="date" value={custom.from} max={custom.to} onChange={(event) => update({ desde: event.target.value || null })} fieldClassName="portal-filters__date" />
          <TextField label="Hasta" type="date" value={custom.to} min={custom.from} onChange={(event) => update({ hasta: event.target.value || null })} fieldClassName="portal-filters__date" error={invalidRange ? "Tiene que ser posterior a Desde." : undefined} />
          <SelectField
            label="Agrupar por"
            value={custom.granularity}
            onChange={(event) => update({ agrupar: event.target.value })}
            options={[
              { value: "day", label: "Día" },
              { value: "week", label: "Semana" },
              { value: "month", label: "Mes" },
            ]}
            fieldClassName="portal-filters__date"
          />
        </div>
      ) : null}

      {reports.errorMessage ? (
        <ErrorState message={reports.errorMessage} onRetry={() => void reports.reload()} retrying={reports.isRefreshing} />
      ) : (
        <>
          <div className="portal-stats" aria-busy={reports.isLoading}>
            <StatCard label="Vendido" value={totals ? <Money value={totals.totalAmount} size="lg" /> : null} loading={!totals} />
            <StatCard label="Ventas" value={totals ? formatNumber(totals.paymentsCount) : null} loading={!totals} />
            <StatCard label="Ticket promedio" value={totals ? <Money value={totals.avgTicket} size="lg" /> : null} loading={!totals} />
          </div>

          <section className="portal-section portal-chart-card" aria-labelledby="reports-chart-title">
            <div className="portal-section__header">
              <h2 id="reports-chart-title">Vendido por {range.granularity === "month" ? "mes" : range.granularity === "week" ? "semana" : "día"}</h2>
            </div>
            {!reports.data ? (
              <Skeleton variant="block" height="16rem" />
            ) : hasSales ? (
              <ColumnChart data={chartData} ariaLabel="Importe vendido por período" formatTick={(value) => (value === 0 ? "0" : `$ ${compactMoney.format(value)}`)} />
            ) : (
              <p className="portal-muted">No hubo ventas en este período.</p>
            )}
          </section>

          <section className="portal-section" aria-labelledby="reports-status-title">
            <div className="portal-section__header">
              <h2 id="reports-status-title">Cómo quedaron las ventas</h2>
            </div>
            <div className="portal-stats">
              {groups.map((group) => (
                <StatCard
                  key={group.key}
                  label={group.chip}
                  value={reports.data ? formatNumber(group.count) : null}
                  hint={reports.data ? formatCurrency(group.amount) : undefined}
                  tone={group.count > 0 ? group.tone : "neutral"}
                  to={group.count > 0 ? `/portal-cliente/pagos?estado=${group.slug}&desde=${range.from}&hasta=${range.to}` : undefined}
                  linkLabel="Ver ventas"
                  loading={!reports.data}
                />
              ))}
            </div>
          </section>

          {hasSales ? (
            <section className="portal-section" aria-labelledby="reports-table-title">
              <div className="portal-section__header">
                <h2 id="reports-table-title">Detalle por período</h2>
              </div>
              <DataTable caption="Ventas por período" columns={tableColumns} rows={points.filter((point) => point.paymentsCount > 0).reverse()} getRowKey={(row) => row.key} density="compact" />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
