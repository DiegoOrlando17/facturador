import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { PLAN_CATALOG } from "../src/config/planCatalog.js";
import { resolvePlanPolicy } from "../src/domain/planPolicy.js";
import {
  buildUniformRunTimes,
  evaluateTenantSchedule,
  normalizeTenantSchedule,
} from "../src/domain/tenantScheduler.js";

const policy = resolvePlanPolicy(PLAN_CATALOG[0]);

test("realtime respeta el intervalo minimo", () => {
  const schedule = normalizeTenantSchedule({ POLLING_MODE: "realtime", POLLING_INTERVAL_MS: 5000 }, policy);
  const first = evaluateTenantSchedule(schedule, {}, DateTime.fromISO("2026-08-22T12:00:00Z"));
  const early = evaluateTenantSchedule(schedule, first.runtime, DateTime.fromISO("2026-08-22T12:00:04Z"));
  const due = evaluateTenantSchedule(schedule, first.runtime, DateTime.fromISO("2026-08-22T12:00:05Z"));

  assert.equal(first.shouldRun, true);
  assert.equal(early.shouldRun, false);
  assert.equal(due.shouldRun, true);
});

test("scheduled ejecuta una sola vez por slot y zona horaria", () => {
  const schedule = normalizeTenantSchedule({
    POLLING_MODE: "scheduled",
    TIMEZONE: "America/Argentina/Buenos_Aires",
    RUN_AT_TIMES: ["09:00"],
  }, policy);
  const now = DateTime.fromISO("2026-08-22T12:00:00Z");
  const first = evaluateTenantSchedule(schedule, {}, now);
  const duplicate = evaluateTenantSchedule(schedule, first.runtime, now.plus({ seconds: 20 }));

  assert.equal(first.shouldRun, true);
  assert.equal(duplicate.shouldRun, false);
});

test("rechaza horarios, zonas e intervalos invalidos", () => {
  assert.throws(
    () => normalizeTenantSchedule({ POLLING_MODE: "scheduled", RUN_AT_TIMES: ["25:00"] }, policy),
    /HH:mm/
  );
  assert.throws(
    () => normalizeTenantSchedule({ POLLING_MODE: "scheduled", TIMEZONE: "Argentina/Falsa" }, policy),
    /zona IANA/
  );
  assert.throws(
    () => normalizeTenantSchedule({ POLLING_MODE: "realtime", POLLING_INTERVAL_MS: 1000 }, policy),
    /POLLING_INTERVAL_MS/
  );
});

test("RUNS_PER_DAY heredado genera slots deterministas", () => {
  assert.deepEqual(buildUniformRunTimes(4), ["00:00", "06:00", "12:00", "18:00"]);
});
