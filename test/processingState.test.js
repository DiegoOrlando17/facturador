import test from "node:test";
import assert from "node:assert/strict";
import {
  assertInvoiceTransition,
  assertPaymentTransition,
} from "../src/domain/processingState.js";

test("acepta el circuito automatico de Payment", () => {
  assert.doesNotThrow(() => assertPaymentTransition("pending", "processing"));
  assert.doesNotThrow(() => assertPaymentTransition("processing", "afip_pending"));
  assert.doesNotThrow(() => assertPaymentTransition("afip_pending", "processing"));
  assert.doesNotThrow(() => assertPaymentTransition("processing", "complete"));
});

test("Payment completo no vuelve al circuito fiscal", () => {
  assert.throws(
    () => assertPaymentTransition("complete", "processing"),
    /Transicion Payment invalida/
  );
});

test("acepta emision y reintento de Invoice", () => {
  assert.doesNotThrow(() => assertInvoiceTransition("QUEUED", "ISSUING"));
  assert.doesNotThrow(() => assertInvoiceTransition("ISSUING", "FAILED"));
  assert.doesNotThrow(() => assertInvoiceTransition("FAILED", "ISSUING"));
  assert.doesNotThrow(() => assertInvoiceTransition("ISSUING", "ISSUED"));
});

test("Invoice emitida es terminal", () => {
  assert.throws(
    () => assertInvoiceTransition("ISSUED", "ISSUING"),
    /Transicion Invoice invalida/
  );
});
