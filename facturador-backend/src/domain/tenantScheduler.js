import { DateTime, IANAZone } from "luxon";
import {
  ENTITLEMENTS,
  PROCESSING_MODES,
  hasEntitlement,
  supportsProcessingMode,
} from "./planPolicy.js";

export const DEFAULT_SCHEDULER_TIMEZONE = "America/Argentina/Buenos_Aires";
export const MIN_POLLING_INTERVAL_MS = 5_000;
const MAX_RUNS_PER_DAY = 1_440;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TENANT_SCHEDULE_FIELDS = Object.freeze([
  "POLLING_MODE",
  "POLLING_INTERVAL_MS",
  "RUNS_PER_DAY",
  "RUN_AT_TIMES",
  "TIMEZONE",
]);

export function mergeTenantScheduleConfig(existing = {}, submitted = {}) {
  if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
    throw new Error("La agenda de lectura no es válida.");
  }

  const merged = { ...existing };
  for (const field of TENANT_SCHEDULE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(submitted, field)) merged[field] = submitted[field];
  }
  // Si el cliente elige "lecturas por día" sin mandar horarios, los horarios
  // explícitos anteriores no deben seguir ganando sobre RUNS_PER_DAY.
  if (
    Object.prototype.hasOwnProperty.call(submitted, "RUNS_PER_DAY")
    && !Object.prototype.hasOwnProperty.call(submitted, "RUN_AT_TIMES")
  ) {
    merged.RUN_AT_TIMES = [];
  }
  return merged;
}

function normalizePositiveInteger(value, message, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(typeof message === "function" ? message({ min, max }) : message);
  }
  return parsed;
}

export function buildUniformRunTimes(runsPerDay) {
  const count = normalizePositiveInteger(runsPerDay, ({ max }) => `Elegí entre 1 y ${max} lecturas por día.`, { max: MAX_RUNS_PER_DAY });
  const step = (24 * 60) / count;

  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = Math.floor(index * step);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  });
}

export function normalizeTenantSchedule(rawConfig = {}, policy) {
  if (!hasEntitlement(policy, ENTITLEMENTS.AUTOMATIC_INVOICING)) {
    throw new Error("Tu plan no incluye la facturación automática.");
  }

  const mode = String(rawConfig.POLLING_MODE || policy?.processing?.defaultMode || "realtime").toLowerCase();
  if (![PROCESSING_MODES.REALTIME, PROCESSING_MODES.SCHEDULED].includes(mode)) {
    throw new Error("Elegí cómo leer las ventas: al instante o en horarios.");
  }
  if (!supportsProcessingMode(policy, mode)) {
    throw new Error(mode === PROCESSING_MODES.SCHEDULED ? "Tu plan no incluye la lectura en horarios." : "Tu plan no incluye la lectura al instante.");
  }

  const timezone = String(rawConfig.TIMEZONE || DEFAULT_SCHEDULER_TIMEZONE).trim();
  if (!IANAZone.isValidZone(timezone)) {
    throw new Error("Elegí una zona horaria válida.");
  }

  if (mode === PROCESSING_MODES.REALTIME) {
    const policyMinimum = policy?.processing?.minRealtimeIntervalMs;
    const minimum = Math.max(MIN_POLLING_INTERVAL_MS, policyMinimum ?? MIN_POLLING_INTERVAL_MS);
    const intervalMs = normalizePositiveInteger(
      rawConfig.POLLING_INTERVAL_MS ?? minimum,
      ({ min }) => `El intervalo de lectura tiene que ser de al menos ${Math.round(min / 1000)} segundos.`,
      { min: minimum }
    );
    return { mode, timezone, intervalMs, runAtTimes: [], runsPerDay: null };
  }

  const explicitTimes = Array.isArray(rawConfig.RUN_AT_TIMES)
    ? [...new Set(rawConfig.RUN_AT_TIMES.map((value) => String(value).trim()))].sort()
    : [];
  if (explicitTimes.some((value) => !TIME_PATTERN.test(value))) {
    throw new Error("Revisá los horarios: usá el formato HH:mm (por ejemplo, 09:30).");
  }

  const configuredRuns = explicitTimes.length || rawConfig.RUNS_PER_DAY || 1;
  const commercialMaximum = policy?.processing?.maxRunsPerDay;
  const maximum = commercialMaximum ?? MAX_RUNS_PER_DAY;
  const runsPerDay = normalizePositiveInteger(configuredRuns, ({ max }) => `Tu plan permite hasta ${max} lecturas por día.`, { max: maximum });
  const runAtTimes = explicitTimes.length ? explicitTimes : buildUniformRunTimes(runsPerDay);

  return { mode, timezone, intervalMs: null, runAtTimes, runsPerDay };
}

export function evaluateTenantSchedule(schedule, runtime = {}, now = DateTime.utc()) {
  const zonedNow = DateTime.isDateTime(now)
    ? now.setZone(schedule.timezone)
    : DateTime.fromJSDate(now).setZone(schedule.timezone);

  if (schedule.mode === PROCESSING_MODES.REALTIME) {
    const nowMs = zonedNow.toMillis();
    const slotKey = `realtime|${Math.floor(nowMs / schedule.intervalMs)}`;
    const shouldRun = !runtime.lastRunAt || nowMs - runtime.lastRunAt >= schedule.intervalMs;
    return {
      shouldRun,
      slotKey,
      runtime: shouldRun ? { ...runtime, lastRunAt: nowMs } : runtime,
    };
  }

  const hhmm = zonedNow.toFormat("HH:mm");
  const slotKey = `${zonedNow.toISODate()}|${schedule.timezone}|${hhmm}`;
  const shouldRun = schedule.runAtTimes.includes(hhmm) && runtime.lastSlot !== slotKey;
  return {
    shouldRun,
    slotKey,
    runtime: shouldRun
      ? { ...runtime, lastSlot: slotKey, lastRunAt: zonedNow.toMillis() }
      : runtime,
  };
}
