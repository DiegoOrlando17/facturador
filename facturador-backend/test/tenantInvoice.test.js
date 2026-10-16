import test from "node:test";
import assert from "node:assert/strict";
import { isValidCuit, normalizeManualInvoiceInput, resolveInvoiceSchedule } from "../src/domain/tenantInvoice.js";

test("normaliza una factura manual valida", () => {
  assert.deepEqual(normalizeManualInvoiceInput({ amount: "100.50", currency: "ars", customer: " Cliente ", customerDocType: "cuit", customerDocNumber: "20-12345678-6" }), { amount: 100.5, currency: "ARS", customer: "Cliente", customerDocType: "CUIT", customerDocNumber: "20123456786" });
});
test("valida el documento del cliente segun el tipo y descarta tipos desconocidos", () => {
  assert.equal(isValidCuit("20-12345678-6"), true);
  assert.equal(isValidCuit("20123456780"), false);
  assert.throws(() => normalizeManualInvoiceInput({ amount: 10, customerDocType: "CUIT", customerDocNumber: "20123456780" }), /CUIT/);
  assert.throws(() => normalizeManualInvoiceInput({ amount: 10, customerDocType: "DNI", customerDocNumber: "123" }), /DNI/);
  const anonymous = normalizeManualInvoiceInput({ amount: 10, customerDocType: "CONSUMIDOR_FINAL", customerDocNumber: "999" });
  assert.equal(anonymous.customerDocType, null);
  assert.equal(anonymous.customerDocNumber, null);
});
test("rechaza importes manuales no positivos", () => assert.throws(() => normalizeManualInvoiceInput({ amount: 0 }), /mayor a cero/));
test("calcula una emision diferida futura", () => { const now = new Date("2026-09-02T12:00:00Z"); const result = resolveInvoiceSchedule("2026-09-02T13:00:00Z", now); assert.equal(result.delay, 3600000); });
test("rechaza una emision diferida vencida o mayor a 30 dias", () => { const now = new Date("2026-09-02T12:00:00Z"); assert.throws(() => resolveInvoiceSchedule("2026-09-02T11:00:00Z", now), /futuro/); assert.throws(() => resolveInvoiceSchedule("2026-10-03T12:00:00Z", now), /30 días/); });
