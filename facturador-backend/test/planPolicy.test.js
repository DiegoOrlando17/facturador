import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG } from "../src/config/planCatalog.js";
import {
  ENTITLEMENTS,
  hasEntitlement,
  resolvePlanPolicy,
  supportsProcessingMode,
} from "../src/domain/planPolicy.js";

test("el catalogo mantiene capacidades acumulativas", () => {
  const policies = PLAN_CATALOG.map((plan) => resolvePlanPolicy(plan));

  assert.equal(hasEntitlement(policies[0], ENTITLEMENTS.PDF_DOWNLOAD), true);
  assert.equal(hasEntitlement(policies[0], ENTITLEMENTS.GOOGLE_DRIVE_SHEETS), false);
  assert.equal(hasEntitlement(policies[2], ENTITLEMENTS.GOOGLE_DRIVE_SHEETS), true);
  assert.equal(hasEntitlement(policies[3], ENTITLEMENTS.OCR_IMPORT), true);
  assert.equal(supportsProcessingMode(policies[1], "scheduled"), true);
});

test("los limites comerciales indefinidos no se inventan", () => {
  const policy = resolvePlanPolicy(PLAN_CATALOG[0]);
  assert.equal(policy.limits.monthlyInvoices, null);
  assert.equal(policy.processing.maxRunsPerDay, null);
  assert.equal(policy.processing.minRealtimeIntervalMs, 15000);
  assert.equal(resolvePlanPolicy(PLAN_CATALOG[3]).limits.ocrDocumentsMonthly, 500);
});

test("el catalogo publica nombres y precios mensuales en USD", () => {
  assert.deepEqual(PLAN_CATALOG.map(({ name, price, currency, billingCycle }) => ({ name, price, currency, billingCycle })), [
    { name: "Esencial", price: 50, currency: "USD", billingCycle: "monthly" },
    { name: "Control", price: 75, currency: "USD", billingCycle: "monthly" },
    { name: "Profesional", price: 100, currency: "USD", billingCycle: "monthly" },
    { name: "Inteligente", price: 125, currency: "USD", billingCycle: "monthly" },
  ]);
});

test("acepta featuresJson plano heredado", () => {
  const policy = resolvePlanPolicy({
    code: "CUSTOM",
    status: "ACTIVE",
    featuresJson: JSON.stringify({ googleDriveSheets: true, scheduledProcessing: true }),
  });

  assert.equal(hasEntitlement(policy, ENTITLEMENTS.GOOGLE_DRIVE_SHEETS), true);
  assert.equal(supportsProcessingMode(policy, "scheduled"), true);
});

test("un plan deshabilitado no concede capacidades", () => {
  const policy = resolvePlanPolicy({
    code: "TIER_4",
    status: "DISABLED",
    featuresJson: PLAN_CATALOG[3].featuresJson,
  });

  assert.equal(hasEntitlement(policy, ENTITLEMENTS.OCR_IMPORT), false);
});

test("los planes heredados A/B conservan facturacion automatica", () => {
  const policy = resolvePlanPolicy({ code: "A", status: "ACTIVE", featuresJson: null });
  assert.equal(hasEntitlement(policy, ENTITLEMENTS.AUTOMATIC_INVOICING), true);
  assert.equal(supportsProcessingMode(policy, "realtime"), true);
});
