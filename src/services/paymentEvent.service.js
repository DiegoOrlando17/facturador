import { db } from "../models/db.js";

export async function logPaymentEvent(tenantId, paymentId, type, message = null, payload = null) {
  return db.paymentEvent.create({
    data: {
      tenantId,
      paymentId,
      type,
      message,
      payloadJson: payload ? JSON.stringify(payload) : null,
    },
  });
}

export async function listPaymentEvents(paymentId, tenantId = null, { take = 50 } = {}) {
  return db.paymentEvent.findMany({
    where: {
      paymentId,
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take,
  });
}
