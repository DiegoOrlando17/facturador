import { assertCreditNoteEligible } from "../domain/creditNote.js";
import { ENTITLEMENTS, hasEntitlement } from "../domain/planPolicy.js";
import { ensureCreditNoteForInvoice } from "../models/Invoice.js";
import { creditNotesQueue } from "../queues/creditNotes.queue.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { getTenantSubscriptionPolicy } from "./subscriptionPolicy.service.js";
import { createTenantAuditLog, reprocessPaymentAsAdmin } from "./tenantSupport.service.js";
import { addOrReplaceFailedJob } from "../domain/retryPolicy.js";

export async function issuePaymentAsAdmin(payment, adminUser) {
  if (payment.invoice?.status === "ISSUED") throw new Error("La factura ya fue emitida en ARCA");
  return reprocessPaymentAsAdmin(payment, adminUser, "afip");
}

export async function cancelInvoiceAsAdmin(payment, adminUser) {
  const subscription = await getTenantSubscriptionPolicy(payment.tenantId);
  assertCreditNoteEligible(payment.invoice, hasEntitlement(subscription?.policy, ENTITLEMENTS.CREDIT_NOTES));

  const creditNote = await ensureCreditNoteForInvoice(payment.tenantId, payment.invoice);
  const alreadyIssued = creditNote.status === "ISSUED" && Boolean(creditNote.cae);
  if (!alreadyIssued && creditNote.status !== "ISSUING") {
    await addOrReplaceFailedJob(creditNotesQueue, `credit-note-${creditNote.id}`, {
      tenantId: toQueueId(payment.tenantId),
      invoiceId: toQueueId(creditNote.id),
    }, {
      jobId: buildQueueJobId({ tenantId: payment.tenantId, paymentId: creditNote.id, step: "credit-note" }),
      attempts: 5,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

  await createTenantAuditLog({
    tenantId: payment.tenantId,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: "invoice_credit_note_requested",
    entityType: "Invoice",
    entityId: String(payment.invoice.id),
    after: { creditNoteId: String(creditNote.id), alreadyIssued },
  });

  return { creditNoteId: creditNote.id, status: creditNote.status, queued: !alreadyIssued && creditNote.status !== "ISSUING" };
}
