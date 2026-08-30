import test from "node:test";
import assert from "node:assert/strict";
import {
  addOrReplaceFailedJob,
  resolveAutomaticRetryStep,
  resolveManualRetryStep,
} from "../src/domain/retryPolicy.js";

test("processing con factura emitida reintenta solo postproceso", () => {
  assert.equal(resolveAutomaticRetryStep("processing", "ISSUED"), "post");
});

test("processing sin factura emitida no reintenta ARCA automaticamente", () => {
  assert.equal(resolveAutomaticRetryStep("processing", "ISSUING"), null);
  assert.equal(resolveAutomaticRetryStep("processing", "FAILED"), null);
});

test("afip_pending sin factura emitida reintenta ARCA", () => {
  assert.equal(resolveAutomaticRetryStep("afip_pending", "FAILED"), "afip");
});

test("el reproceso manual automatico respeta el estado fiscal", () => {
  assert.equal(resolveManualRetryStep("auto", "ISSUED"), "post");
  assert.equal(resolveManualRetryStep("auto", "FAILED"), "afip");
});

test("el reproceso manual no permite volver a ARCA con factura emitida", () => {
  assert.throws(
    () => resolveManualRetryStep("afip", "ISSUED"),
    /solo se permite reprocesar el postproceso/
  );
  assert.throws(
    () => resolveManualRetryStep("post", "FAILED"),
    /requiere una factura emitida/
  );
});

test("un job fallido se reemplaza antes de reencolar", async () => {
  const calls = [];
  const failedJob = {
    getState: async () => "failed",
    remove: async () => calls.push("remove"),
  };
  const queue = {
    getJob: async () => failedJob,
    add: async () => calls.push("add"),
  };

  const result = await addOrReplaceFailedJob(queue, "post", { paymentId: "1" }, { jobId: "post-1" });

  assert.equal(result, "replaced_failed");
  assert.deepEqual(calls, ["remove", "add"]);
});
