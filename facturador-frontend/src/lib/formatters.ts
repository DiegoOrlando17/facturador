export const ARGENTINA_TIMEZONE = "America/Argentina/Buenos_Aires";

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

const numberFormatters = new Map<string, Intl.NumberFormat>();

type CurrencyFormatOptions = {
  /** Decimales a mostrar (2 por defecto: los comprobantes tienen centavos). */
  decimals?: number;
  /** `"always"` para mostrar el + en importes positivos (diferencias, saldos). */
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
};

/** Convierte números, strings decimales del backend (Prisma Decimal) y nulos a número. */
export function toAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Formateador cacheado. Si la moneda no es un código ISO válido, cae a número con 2 decimales. */
export function getCurrencyFormatter(currency: string | null | undefined = "ARS", options: CurrencyFormatOptions = {}) {
  const code = (currency || "ARS").toUpperCase();
  const decimals = options.decimals ?? 2;
  const signDisplay = options.signDisplay ?? "auto";
  const key = `${code}|${decimals}|${signDisplay}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: code,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        signDisplay,
      });
    } catch {
      formatter = new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, signDisplay });
    }
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Importe en la moneda indicada (ARS por defecto) con 2 decimales.
 * `formatCurrency(1234.5)` → "$ 1.234,50"; `formatCurrency(10, "USD")` → "US$ 10,00".
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string | null | undefined = "ARS",
  options: CurrencyFormatOptions = {},
) {
  return getCurrencyFormatter(currency, options).format(toAmount(amount));
}

/** @deprecated Alias de formatCurrency (se mantiene por compatibilidad). */
export function formatMoney(amount: number | string | null | undefined, currency: string | null | undefined = "ARS") {
  return formatCurrency(amount, currency);
}

/** Número con separadores de es-AR. `formatNumber(1234.5, { decimals: 1 })` → "1.234,5". */
export function formatNumber(value: number | string | null | undefined, options: { decimals?: number; fallback?: string } = {}) {
  if (value === null || value === undefined || value === "") return options.fallback ?? "0";
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return options.fallback ?? "0";
  const decimals = options.decimals;
  const key = `number|${decimals ?? "auto"}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(
      "es-AR",
      decimals === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
    );
    numberFormatters.set(key, formatter);
  }
  return formatter.format(parsed);
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
