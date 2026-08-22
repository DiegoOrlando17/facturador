import { db } from "../models/db.js";
import { resolvePlanPolicy } from "../domain/planPolicy.js";

export async function getTenantSubscriptionPolicy(tenantId) {
  const subscription = await db.subscription.findFirst({
    where: {
      tenantId,
      status: "ACTIVE",
      plan: { status: "ACTIVE" },
    },
    include: { plan: true },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!subscription) return null;

  return {
    subscriptionId: subscription.id,
    planId: subscription.planId,
    planCode: subscription.plan.code,
    policy: resolvePlanPolicy(subscription.plan),
  };
}
