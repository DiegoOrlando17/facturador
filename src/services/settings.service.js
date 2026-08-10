import { db } from "../models/db.js";

const VALID_PLAN_STATUSES = new Set(["ACTIVE", "DISABLED"]);
const VALID_BILLING_CYCLES = new Set(["monthly", "yearly", "one_time"]);

function normalizePlan(plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    status: plan.status,
    description: plan.description,
    featuresJson: plan.featuresJson,
    createdSubscriptions: plan._count?.subscriptions ?? undefined,
  };
}

function normalizePlanPayload(body, { partial = false } = {}) {
  const data = {};

  if (!partial || body.code !== undefined) {
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) throw new Error("code es obligatorio");
    data.code = code;
  }

  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) throw new Error("name es obligatorio");
    data.name = name;
  }

  if (body.price !== undefined) {
    const price = body.price === null || body.price === "" ? null : Number(body.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw new Error("price invalido");
    }
    data.price = price;
  }

  if (body.currency !== undefined) {
    const currency = String(body.currency || "ARS").trim().toUpperCase();
    if (!currency) throw new Error("currency es obligatorio");
    data.currency = currency;
  }

  if (body.billingCycle !== undefined) {
    const billingCycle = String(body.billingCycle || "monthly").trim().toLowerCase();
    if (!VALID_BILLING_CYCLES.has(billingCycle)) {
      throw new Error("billingCycle invalido");
    }
    data.billingCycle = billingCycle;
  }

  if (body.status !== undefined) {
    const status = String(body.status || "ACTIVE").trim().toUpperCase();
    if (!VALID_PLAN_STATUSES.has(status)) {
      throw new Error("status invalido");
    }
    data.status = status;
  }

  if (body.description !== undefined) {
    data.description = String(body.description || "").trim() || null;
  }

  if (body.featuresJson !== undefined) {
    data.featuresJson = String(body.featuresJson || "").trim() || null;
  }

  return data;
}

export async function listPlans() {
  const plans = await db.plan.findMany({
    orderBy: [{ code: "asc" }],
    include: {
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  return plans.map(normalizePlan);
}

export async function createPlan(body) {
  const plan = await db.plan.create({
    data: normalizePlanPayload(body),
    include: {
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  return normalizePlan(plan);
}

export async function updatePlan(id, body) {
  const plan = await db.plan.update({
    where: { id: BigInt(id) },
    data: normalizePlanPayload(body, { partial: true }),
    include: {
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  return normalizePlan(plan);
}
