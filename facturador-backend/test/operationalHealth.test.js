import test from "node:test";
import assert from "node:assert/strict";
import { classifyQueueHealth } from "../src/domain/operationalHealth.js";

test("una cola sin fallos se considera saludable aunque tenga trabajo pendiente", () => {
  const result = classifyQueueHealth({ waiting: 3, active: 1, delayed: 2, failed: 0 });
  assert.equal(result.status, "healthy");
  assert.deepEqual(result.counts, { waiting: 3, active: 1, delayed: 2, failed: 0 });
});

test("una cola con jobs fallidos requiere atencion", () => {
  const result = classifyQueueHealth({ failed: 2 });
  assert.equal(result.status, "attention");
  assert.match(result.detail, /2 fallidos/);
});
