import crypto from "crypto";

const RELEASE_IF_OWNER_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export function buildPaymentPostProcessLockKey(tenantId, paymentId) {
  return `facturador:invoice-post:${tenantId}:${paymentId}`;
}

export async function claimDistributedSlot(redis, key, ttlMs) {
  const token = crypto.randomUUID();
  const claimed = await redis.set(key, token, "PX", ttlMs, "NX");

  return {
    claimed: claimed === "OK",
    async release() {
      if (claimed !== "OK") return false;
      const released = await redis.eval(RELEASE_IF_OWNER_SCRIPT, 1, key, token);
      return released === 1;
    },
  };
}
