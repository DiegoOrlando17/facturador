import test from "node:test";
import assert from "node:assert/strict";
import { assertReportGranularity, buildReportDateRange, parseReportDateBoundary } from "../src/domain/reportPeriods.js";
import { hasRequiredIntegrationCredentials, resolveSettingsOnlyEnabled } from "../src/domain/integrationReadiness.js";
import { buildReportBucketSql, buildSqlDateFilter } from "../src/services/adminMonitor.service.js";

test("los limites de reporte se cortan en hora argentina", () => {
  const { from, to } = buildReportDateRange({ dateFrom: "2026-10-01", dateTo: "2026-10-01" });
  assert.equal(from.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(to.toISOString(), "2026-10-02T02:59:59.999Z");
  assert.equal(parseReportDateBoundary(""), null);
  assert.equal(parseReportDateBoundary("no-es-fecha"), null);
});

test("granularidad de reporte valida", () => {
  assert.equal(assertReportGranularity(undefined), "day");
  assert.equal(assertReportGranularity("MONTH"), "month");
  assert.throws(() => assertReportGranularity("hour; DROP TABLE"), /granularity/);
});

test("el filtro SQL de reportes une fragmentos sin [object Object]", () => {
  const filter = buildSqlDateFilter({ tenantId: 7n, dateFrom: "2026-10-01", dateTo: "2026-10-15" });
  assert.doesNotMatch(filter.sql, /object Object/);
  assert.equal(filter.values.length, 3);
  assert.equal(buildSqlDateFilter({}).sql, "");
});

test("el bucket de reportes agrupa en hora argentina", () => {
  const bucket = buildReportBucketSql("day");
  assert.match(bucket.sql, /date_trunc\('day'/);
  assert.match(bucket.sql, /America\/Argentina\/Buenos_Aires/);
  assert.equal(bucket.values.length, 0);
  assert.throws(() => buildReportBucketSql("hour"), /granularity/);
});

test("agenda o modalidad no habilitan Mercado Pago sin credenciales", () => {
  assert.equal(hasRequiredIntegrationCredentials("MERCADOPAGO", { INVOICE_MODE: "confirmation" }), false);
  assert.equal(hasRequiredIntegrationCredentials("MERCADOPAGO", { ACCESS_TOKEN: "***abcd", POS_ID: "1" }), true);
  assert.equal(resolveSettingsOnlyEnabled("MERCADOPAGO", { existingEnabled: true, config: { POLLING_MODE: "realtime" } }), false);
  assert.equal(resolveSettingsOnlyEnabled("MERCADOPAGO", { existingEnabled: false, config: { ACCESS_TOKEN: "x", POS_ID: "1" } }), false);
  assert.equal(resolveSettingsOnlyEnabled("MERCADOPAGO", { existingEnabled: true, config: { ACCESS_TOKEN: "x", POS_ID: "1" } }), true);
});
