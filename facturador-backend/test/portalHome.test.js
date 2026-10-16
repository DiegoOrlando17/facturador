import test from "node:test";
import assert from "node:assert/strict";
import { buildAttentionItems, buildMonthWindows, percentChange, summarizeIssued } from "../src/domain/portalHome.js";
import { buildInvoiceViewWhere, normalizeInvoiceView } from "../src/domain/invoiceViews.js";

test("las vistas de facturas listan solo facturas y separan emitidas de anuladas", () => {
  assert.equal(normalizeInvoiceView("PENDING"), "pending");
  assert.equal(normalizeInvoiceView("cualquiera"), "all");
  assert.deepEqual(buildInvoiceViewWhere(1n, "all"), { tenantId: 1n, type: "INVOICE" });
  assert.deepEqual(buildInvoiceViewWhere(1n, "issued").creditNotes, { none: { status: "ISSUED" } });
  assert.deepEqual(buildInvoiceViewWhere(1n, "voided").creditNotes, { some: { status: "ISSUED" } });
  assert.equal(buildInvoiceViewWhere(1n, "voided").status, undefined);
});

test("el mes se corta en hora argentina y compara contra el mismo punto del mes anterior", () => {
  // 16/10/2026 01:30 UTC = 15/10/2026 22:30 en Argentina: sigue siendo octubre.
  const windows = buildMonthWindows(new Date("2026-10-16T01:30:00Z"));
  assert.equal(windows.monthKey, "2026-10");
  assert.equal(windows.previousMonthKey, "2026-09");
  assert.equal(windows.current.from.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(windows.previous.from.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(windows.previous.to.toISOString(), "2026-09-16T01:30:00.000Z");
});

test("la comparacion del mes anterior no pasa del ultimo dia de ese mes", () => {
  // 31/03 vs febrero: se recorta al fin de febrero.
  const windows = buildMonthWindows(new Date("2026-03-31T20:00:00Z"));
  assert.equal(windows.previous.to.toISOString(), "2026-03-01T03:00:00.000Z");
});

test("el facturado neto descuenta notas de credito y calcula el ticket promedio", () => {
  const summary = summarizeIssued([
    { type: "INVOICE", _sum: { amount: 1000 }, _count: { _all: 4 } },
    { type: "CREDIT_NOTE", _sum: { amount: 200 }, _count: { _all: 1 } },
  ]);
  assert.deepEqual(summary, { net: 800, invoiced: 1000, credited: 200, invoiceCount: 4, averageTicket: 250 });
  assert.equal(summarizeIssued([]).averageTicket, null);
});

test("la variacion es null sin base de comparacion", () => {
  assert.equal(percentChange(112, 100), 12);
  assert.equal(percentChange(50, 0), null);
});

test("la bandeja ordena por urgencia y omite lo que esta resuelto", () => {
  const items = buildAttentionItems({ pendingConfirmation: 3, failedInvoices: 1, profileStatus: "APPROVED", subscriptionStatus: "ACTIVE", mercadoPagoConnected: true });
  assert.deepEqual(items.map((item) => item.code), ["invoices_failed", "invoices_pending_confirmation"]);
  const fresh = buildAttentionItems({ profileStatus: "DRAFT", subscriptionStatus: "PAST_DUE", mercadoPagoConnected: false });
  assert.deepEqual(fresh.map((item) => item.code), ["subscription_unpaid", "profile_incomplete", "mercadopago_not_connected"]);
});
