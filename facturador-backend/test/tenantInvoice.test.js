import test from "node:test";
import assert from "node:assert/strict";
import { normalizeManualInvoiceInput, resolveInvoiceSchedule } from "../src/domain/tenantInvoice.js";

test("normaliza una factura manual valida", () => {
  assert.deepEqual(normalizeManualInvoiceInput({ amount: "100.50", currency: "ars", customer: " Cliente ", customerDocType: "cuit", customerDocNumber: "30-123" }), { amount: 100.5, currency: "ARS", customer: "Cliente", customerDocType: "CUIT", customerDocNumber: "30123" });
});
test("rechaza importes manuales no positivos", () => assert.throws(() => normalizeManualInvoiceInput({ amount: 0 }), /mayor a cero/));
test("calcula una emision diferida futura", () => { const now = new Date("2026-09-02T12:00:00Z"); const result = resolveInvoiceSchedule("2026-09-02T13:00:00Z", now); assert.equal(result.delay, 3600000); });
test("rechaza una emision diferida vencida o mayor a 30 dias", () => { const now = new Date("2026-09-02T12:00:00Z"); assert.throws(() => resolveInvoiceSchedule("2026-09-02T11:00:00Z", now), /futura/); assert.throws(() => resolveInvoiceSchedule("2026-10-03T12:00:00Z", now), /30 dias/); });
