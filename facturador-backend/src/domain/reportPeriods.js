import { DateTime } from "luxon";

// Los reportes del portal y del admin cortan los días en hora argentina,
// independientemente de la zona horaria del servidor.
export const REPORT_TIMEZONE = "America/Argentina/Buenos_Aires";
export const REPORT_GRANULARITIES = Object.freeze(["day", "week", "month"]);

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte un límite de fecha de un filtro de reporte en un instante UTC.
 * "2026-10-01" se interpreta como el día 1/10 en hora argentina: el inicio es
 * 2026-10-01T03:00:00Z y el fin 2026-10-02T02:59:59.999Z.
 */
export function parseReportDateBoundary(value, { endOfDay = false, timezone = REPORT_TIMEZONE } = {}) {
  if (value === null || value === undefined || value === "") return null;

  const raw = String(value).trim();
  let dateTime = DATE_ONLY_PATTERN.test(raw)
    ? DateTime.fromISO(raw, { zone: timezone })
    : DateTime.fromISO(raw, { setZone: true });

  if (!dateTime.isValid) {
    const fallback = new Date(raw);
    if (Number.isNaN(fallback.getTime())) return null;
    dateTime = DateTime.fromJSDate(fallback);
  }

  const zoned = dateTime.setZone(timezone);
  return (endOfDay ? zoned.endOf("day") : zoned.startOf("day")).toJSDate();
}

export function buildReportDateRange(filters = {}, options = {}) {
  return {
    from: parseReportDateBoundary(filters.dateFrom, options),
    to: parseReportDateBoundary(filters.dateTo, { ...options, endOfDay: true }),
  };
}

export function assertReportGranularity(value) {
  const current = String(value || "day").trim().toLowerCase();
  if (!REPORT_GRANULARITIES.includes(current)) {
    throw new Error("granularity invalida");
  }
  return current;
}
