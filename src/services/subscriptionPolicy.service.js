import { db } from "../models/db.js";
import { resolvePlanPolicy } from "../domain/planPolicy.js";

const policyCache = new Map();
const POLICY_CACHE_TTL_MS = 30_000;

export async function getTenantSubscriptionPolicy(tenantId) {
  const cacheKey = String(tenantId);
  const cached = policyCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const subscription = await db.subscription.findFirst({
    where: {
      tenantId,
      status: "ACTIVE",
      plan: { status: "ACTIVE" },
    },
    include: { plan: true },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!subscription) {
    policyCache.set(cacheKey, { value: null, expiresAt: Date.now() + POLICY_CACHE_TTL_MS });
    return null;
  }

  const value = {
    subscriptionId: subscription.id,
    planId: subscription.planId,
    planCode: subscription.plan.code,
    policy: resolvePlanPolicy(subscription.plan),
  };
  policyCache.set(cacheKey, { value, expiresAt: Date.now() + POLICY_CACHE_TTL_MS });
  return value;
}

export function clearTenantSubscriptionPolicyCache(tenantId) {
  policyCache.delete(String(tenantId));
}
