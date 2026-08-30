import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaymentPostProcessLockKey,
  claimDistributedSlot,
} from "../src/services/distributedLock.service.js";

class FakeRedis {
  constructor() {
    this.values = new Map();
  }

  async set(key, value) {
    if (this.values.has(key)) return null;
    this.values.set(key, value);
    return "OK";
  }

  async eval(_script, _keyCount, key, token) {
    if (this.values.get(key) !== token) return 0;
    this.values.delete(key);
    return 1;
  }
}

test("solo una replica reclama el mismo slot", async () => {
  const redis = new FakeRedis();
  const first = await claimDistributedSlot(redis, "tenant:slot", 60_000);
  const second = await claimDistributedSlot(redis, "tenant:slot", 60_000);

  assert.equal(first.claimed, true);
  assert.equal(second.claimed, false);
});

test("el propietario puede liberar un slot fallido para reintento", async () => {
  const redis = new FakeRedis();
  const first = await claimDistributedSlot(redis, "tenant:slot", 60_000);

  assert.equal(await first.release(), true);
  assert.equal((await claimDistributedSlot(redis, "tenant:slot", 60_000)).claimed, true);
});

test("un claim rechazado no libera el slot de otra replica", async () => {
  const redis = new FakeRedis();
  await claimDistributedSlot(redis, "tenant:slot", 60_000);
  const rejected = await claimDistributedSlot(redis, "tenant:slot", 60_000);

  assert.equal(await rejected.release(), false);
  assert.equal(redis.values.has("tenant:slot"), true);
});

test("el lock de postproceso aisla tenant y pago", () => {
  assert.equal(buildPaymentPostProcessLockKey(7n, 42n), "facturador:invoice-post:7:42");
  assert.notEqual(buildPaymentPostProcessLockKey(7n, 42n), buildPaymentPostProcessLockKey(8n, 42n));
  assert.notEqual(buildPaymentPostProcessLockKey(7n, 42n), buildPaymentPostProcessLockKey(7n, 43n));
});
