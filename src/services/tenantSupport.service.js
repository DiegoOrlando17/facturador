import { db } from "../models/db.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { invoicesQueue } from "../queues/invoices.queue.js";
import { logPaymentEvent } from "./paymentEvent.service.js";

function serializeJson(value) {
  return value ? JSON.stringify(value) : null;
}

export async function createTenantAuditLog({
  tenantId = null,
  adminUserId = null,
  actorType,
  actorId = null,
  action,
  entityType,
  entityId = null,
  before = null,
  after = null,
}) {
  return db.tenantAuditLog.create({
    data: {
      tenantId,
      adminUserId,
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      beforeJson: serializeJson(before),
      afterJson: serializeJson(after),
    },
  });
}

export async function listTenantNotes(tenantId, { take = 50 } = {}) {
  return db.tenantNote.findMany({
    where: { tenantId },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function addTenantNote(tenantId, adminUserId, { title, body, pinned = false }) {
  const note = await db.tenantNote.create({
    data: {
      tenantId,
      createdByAdminUserId: adminUserId,
      title,
      body,
      pinned: Boolean(pinned),
    },
    include: {
      createdByAdmin: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await createTenantAuditLog({
    tenantId,
    adminUserId,
    actorType: "admin",
    actorId: String(adminUserId),
    action: "tenant_note_created",
    entityType: "TenantNote",
    entityId: String(note.id),
    after: {
      title: note.title,
      pinned: note.pinned,
    },
  });

  return note;
}

export async function reprocessPaymentAsAdmin(payment, adminUser, step = "auto") {
  const tenantId = payment.tenantId;
  const paymentId = payment.id;

  let resolvedStep = step;
  if (step === "auto") {
    resolvedStep = payment.status === "afip_pending" ? "afip" : "post";
  }

  if (!["afip", "post"].includes(resolvedStep)) {
    throw new Error("step invalido");
  }

  if (resolvedStep === "afip") {
    await paymentsQueue.add(
      `payments-${tenantId}-${payment.provider_payment_id.toString()}`,
      { tenantId: toQueueId(tenantId), paymentId: toQueueId(paymentId) },
      {
        jobId: buildQueueJobId({ tenantId, paymentId, step: "afip" }),
        attempts: 5,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 50,
      }
    );
  } else {
    await invoicesQueue.add(
      `invoices-${payment.provider_payment_id.toString()}`,
      { tenantId: toQueueId(tenantId), paymentId: toQueueId(paymentId) },
      {
        jobId: buildQueueJobId({ tenantId, paymentId, step: "post" }),
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 50,
      }
    );
  }

  await logPaymentEvent(
    tenantId,
    paymentId,
    "retried",
    `Reproceso manual solicitado por ${adminUser.email}`,
    {
      requestedByAdminUserId: String(adminUser.id),
      requestedByEmail: adminUser.email,
      requestedStep: resolvedStep,
      paymentStatus: payment.status,
    }
  );

  await createTenantAuditLog({
    tenantId,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: "payment_reprocess_requested",
    entityType: "Payment",
    entityId: String(paymentId),
    after: {
      step: resolvedStep,
      previousStatus: payment.status,
    },
  });

  return { step: resolvedStep };
}
