export const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fiscalDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(amount: number | null | undefined) {
  return currencyFormatter.format(amount || 0);
}

/** Importe con centavos en la moneda indicada (ARS por defecto). */
export function formatMoney(amount: number | string | null | undefined, currency: string | null | undefined = "ARS") {
  const code = (currency || "ARS").toUpperCase();
  let formatter = moneyFormatters.get(code);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      formatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    moneyFormatters.set(code, formatter);
  }
  const value = typeof amount === "string" ? Number(amount) : amount;
  return formatter.format(Number.isFinite(value) ? Number(value) : 0);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Fecha no disponible";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return dateTimeFormatter.format(date);
}

function buildCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isSameDay = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isSameDay ? date : null;
}

/**
 * Fechas fiscales de ARCA (por ejemplo el vencimiento del CAE). Acepta
 * `dd/mm/yyyy`, `yyyymmdd` y `yyyy-mm-dd` (o ISO completo) y devuelve dd/mm/aaaa.
 * Son fechas de calendario: no se convierten de zona horaria.
 */
export function formatFiscalDate(value: string | number | null | undefined, fallback = "Sin dato") {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;

  let date: Date | null = null;
  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    date = buildCalendarDate(Number(match[3]), Number(match[2]), Number(match[1]));
  } else if ((match = raw.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    date = buildCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  } else if ((match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    date = buildCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  return date ? fiscalDateFormatter.format(date) : fallback;
}

/** Fecha y hora en hora argentina, independiente de la zona del navegador. */
export function formatArgentinaDateTime(value: string | Date | null | undefined, fallback = "Fecha no disponible") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ARGENTINA_TIMEZONE,
  }).format(date);
}

const ARGENTINA_UTC_OFFSET = "-03:00";

/**
 * Convierte el valor de un `<input type="datetime-local">` interpretado en hora
 * argentina a ISO UTC. Argentina no usa horario de verano (UTC−3 fijo).
 */
export function argentinaLocalInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}${ARGENTINA_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Instante → valor para `<input type="datetime-local">` en hora argentina. */
export function toArgentinaLocalInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ARGENTINA_TIMEZONE,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Fecha de hoy (yyyy-mm-dd) en hora argentina, para inputs de fecha. */
export function toArgentinaDateInput(date: Date) {
  return toArgentinaLocalInput(date).slice(0, 10);
}
