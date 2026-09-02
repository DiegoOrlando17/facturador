import test from "node:test";
import assert from "node:assert/strict";
import { assertCreditNoteEligible, getCreditNoteType, parseIssuedInvoiceNumber } from "../src/domain/creditNote.js";
import { buildAssociatedVoucherXml } from "../src/services/afip.service.js";

test("mapea facturas ARCA a su nota de credito", () => {
  assert.equal(getCreditNoteType(1), 3);
  assert.equal(getCreditNoteType(6), 8);
  assert.equal(getCreditNoteType(11), 13);
  assert.equal(getCreditNoteType(51), 53);
});

test("la anulacion exige entitlement y factura emitida", () => {
  const invoice = { type: "INVOICE", status: "ISSUED", cae: "123", cbteTipo: 6, cbteNro: "00002-00020000" };
  assert.throws(() => assertCreditNoteEligible(invoice, false), /no incluye notas/);
  assert.doesNotThrow(() => assertCreditNoteEligible(invoice, true));
  assert.throws(() => assertCreditNoteEligible({ ...invoice, status: "FAILED" }, true), /factura emitida/);
});

test("construye el comprobante asociado sin perder punto de venta ni numero", () => {
  const number = parseIssuedInvoiceNumber("00002-00020000");
  const xml = buildAssociatedVoucherXml({ cbteTipo: 6, ptoVta: number.ptoVta, cbteNro: number.number });
  assert.match(xml, /<ar:Tipo>6<\/ar:Tipo>/);
  assert.match(xml, /<ar:PtoVta>2<\/ar:PtoVta>/);
  assert.match(xml, /<ar:Nro>20000<\/ar:Nro>/);
});
