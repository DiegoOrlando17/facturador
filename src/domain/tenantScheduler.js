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

function normalizePositiveInteger(value, field, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} debe ser un entero entre ${min} y ${max}`);
  }
  return parsed;
}

export function buildUniformRunTimes(runsPerDay) {
  const count = normalizePositiveInteger(runsPerDay, "RUNS_PER_DAY", { max: MAX_RUNS_PER_DAY });
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
    throw new Error("La suscripcion no habilita facturacion automatica");
  }

  const mode = String(rawConfig.POLLING_MODE || policy?.processing?.defaultMode || "realtime").toLowerCase();
  if (![PROCESSING_MODES.REALTIME, PROCESSING_MODES.SCHEDULED].includes(mode)) {
    throw new Error("POLLING_MODE debe ser realtime o scheduled");
  }
  if (!supportsProcessingMode(policy, mode)) {
    throw new Error(`La suscripcion no habilita el modo ${mode}`);
  }

  const timezone = String(rawConfig.TIMEZONE || DEFAULT_SCHEDULER_TIMEZONE).trim();
  if (!IANAZone.isValidZone(timezone)) {
    throw new Error("TIMEZONE debe ser una zona IANA valida");
  }

  if (mode === PROCESSING_MODES.REALTIME) {
    const policyMinimum = policy?.processing?.minRealtimeIntervalMs;
    const minimum = Math.max(MIN_POLLING_INTERVAL_MS, policyMinimum ?? MIN_POLLING_INTERVAL_MS);
    const intervalMs = normalizePositiveInteger(
      rawConfig.POLLING_INTERVAL_MS ?? minimum,
      "POLLING_INTERVAL_MS",
      { min: minimum }
    );
    return { mode, timezone, intervalMs, runAtTimes: [], runsPerDay: null };
  }

  const explicitTimes = Array.isArray(rawConfig.RUN_AT_TIMES)
    ? [...new Set(rawConfig.RUN_AT_TIMES.map((value) => String(value).trim()))].sort()
    : [];
  if (explicitTimes.some((value) => !TIME_PATTERN.test(value))) {
    throw new Error("RUN_AT_TIMES debe contener horarios HH:mm validos");
  }

  const configuredRuns = explicitTimes.length || rawConfig.RUNS_PER_DAY || 1;
  const commercialMaximum = policy?.processing?.maxRunsPerDay;
  const maximum = commercialMaximum ?? MAX_RUNS_PER_DAY;
  const runsPerDay = normalizePositiveInteger(configuredRuns, "RUNS_PER_DAY", { max: maximum });
  const runAtTimes = explicitTimes.length ? explicitTimes : buildUniformRunTimes(runsPerDay);

  return { mode, timezone, intervalMs: null, runAtTimes, runsPerDay };
}

export function evaluateTenantSchedule(schedule, runtime = {}, now = DateTime.utc()) {
  const zonedNow = DateTime.isDateTime(now)
    ? now.setZone(schedule.timezone)
    : DateTime.fromJSDate(now).setZone(schedule.timezone);

  if (schedule.mode === PROCESSING_MODES.REALTIME) {
    const nowMs = zonedNow.toMillis();
    const shouldRun = !runtime.lastRunAt || nowMs - runtime.lastRunAt >= schedule.intervalMs;
    return {
      shouldRun,
      slotKey: null,
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
