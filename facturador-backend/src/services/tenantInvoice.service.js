import { db } from "../models/db.js";
import { assertCreditNoteEligible } from "../domain/creditNote.js";
import { ENTITLEMENTS, hasEntitlement } from "../domain/planPolicy.js";
import { ensureCreditNoteForInvoice, getInvoiceById, markInvoiceQueued } from "../models/Invoice.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { creditNotesQueue } from "../queues/creditNotes.queue.js";
import { manualInvoicesQueue } from "../queues/manualInvoices.queue.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { addOrReplaceFailedJob } from "../domain/retryPolicy.js";
import { getTenantSubscriptionPolicy } from "./subscriptionPolicy.service.js";
import { createTenantAuditLog } from "./tenantSupport.service.js";
import { upsertTenantIntegrationConfig } from "./tenantConfig.service.js";
import { normalizeManualInvoiceInput, resolveInvoiceSchedule } from "../domain/tenantInvoice.js";
import { resolveSettingsOnlyEnabled } from "../domain/integrationReadiness.js";
import { decryptJson } from "../utils/crypto.js";

function formatScheduledAt(date) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(date); }

async function policyWith(entitlement, tenantId) { const subscription = await getTenantSubscriptionPolicy(tenantId); if (!hasEntitlement(subscription?.policy, entitlement)) throw new Error("Tu plan no incluye esta operacion"); return subscription.policy; }
function invoiceInclude() { return { payment: { select: { id: true, provider_payment_id: true } }, creditNotes: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 50 } }; }
export async function listTenantInvoices(tenantId, { page = 1, pageSize = 20, status = null } = {}) { const current = Math.max(1, Number(page) || 1); const take = Math.min(100, Math.max(1, Number(pageSize) || 20)); const where = { tenantId, ...(status ? { status: String(status).toUpperCase() } : {}) }; const [items,total] = await Promise.all([db.invoice.findMany({ where, include: invoiceInclude(), orderBy: { createdAt: "desc" }, skip: (current-1)*take, take }), db.invoice.count({ where })]); return { items, pagination: { page: current, pageSize: take, total, totalPages: Math.max(1, Math.ceil(total/take)) } }; }
export async function getTenantInvoice(tenantId, invoiceId) { return db.invoice.findUnique({ where: { invoice_id_tenantId: { id: invoiceId, tenantId } }, include: invoiceInclude() }); }
async function enqueue(queue, name, tenantId, invoiceId, step) { return addOrReplaceFailedJob(queue, name, { tenantId: toQueueId(tenantId), invoiceId: toQueueId(invoiceId) }, { jobId: buildQueueJobId({ tenantId, paymentId: invoiceId, step }), attempts: 5, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: true, removeOnFail: 50 }); }
export async function confirmTenantInvoice(tenantId, invoiceId, tenantUser, { issueAt = null } = {}) { await policyWith(ENTITLEMENTS.CLIENT_APPROVAL, tenantId); const invoice = await getInvoiceById(tenantId, invoiceId); if (!invoice || invoice.source !== "CONFIRMATION" || invoice.status !== "PENDING_CONFIRMATION" || !invoice.paymentId) throw new Error("El comprobante no esta pendiente de confirmacion"); const { delay, scheduledAt } = resolveInvoiceSchedule(issueAt); await markInvoiceQueued(tenantId, invoice.id, invoice.status); if (scheduledAt) await db.invoiceEvent.create({ data: { tenantId, invoiceId: invoice.id, type: "NOTE_ADDED", message: `Emisión programada para ${formatScheduledAt(scheduledAt)}`, payloadJson: JSON.stringify({ kind: "scheduled_issue", scheduledAt: scheduledAt.toISOString() }) } }); await addOrReplaceFailedJob(paymentsQueue, `payment-confirmed-${invoice.paymentId}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(invoice.paymentId) }, { jobId: buildQueueJobId({ tenantId, paymentId: invoice.paymentId, step: "afip" }), delay, attempts: 5, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: true, removeOnFail: 50 }); await createTenantAuditLog({ tenantId, actorType: "tenant_user", actorId: String(tenantUser.id), action: scheduledAt ? "invoice_scheduled" : "invoice_confirmed", entityType: "Invoice", entityId: String(invoice.id), after: { issueAt: scheduledAt?.toISOString() ?? null } }); return getTenantInvoice(tenantId, invoice.id); }
export async function cancelTenantInvoice(tenantId, invoiceId, tenantUser) { await policyWith(ENTITLEMENTS.CREDIT_NOTES, tenantId); const invoice = await getInvoiceById(tenantId, invoiceId); assertCreditNoteEligible(invoice, true); const note = await ensureCreditNoteForInvoice(tenantId, invoice); if (note.status !== "ISSUED" && note.status !== "ISSUING") await enqueue(creditNotesQueue, `credit-note-${note.id}`, tenantId, note.id, "credit-note"); await createTenantAuditLog({ tenantId, actorType: "tenant_user", actorId: String(tenantUser.id), action: "invoice_credit_note_requested", entityType: "Invoice", entityId: String(invoice.id), after: { creditNoteId: String(note.id) } }); return note; }
export async function createManualTenantInvoice(tenantId, tenantUser, body = {}) { const policy = await policyWith(ENTITLEMENTS.MANUAL_INVOICING, tenantId); const data = normalizeManualInvoiceInput(body); const limit = policy.limits?.manualInvoicesMonthly; if (limit !== null && limit !== undefined) { const start = new Date(); start.setUTCDate(1); start.setUTCHours(0,0,0,0); const used = await db.invoice.count({ where: { tenantId, source: "MANUAL", createdAt: { gte: start } } }); if (used >= limit) throw new Error("Se alcanzo el limite mensual de facturas manuales"); } const invoice = await db.invoice.create({ data: { tenantId, type: "INVOICE", source: "MANUAL", status: "QUEUED", ...data }, include: invoiceInclude() }); await db.invoiceEvent.create({ data: { tenantId, invoiceId: invoice.id, type: "CREATED", message: "Factura manual creada desde el portal" } }); await enqueue(manualInvoicesQueue, `manual-invoice-${invoice.id}`, tenantId, invoice.id, "manual-invoice"); await createTenantAuditLog({ tenantId, actorType: "tenant_user", actorId: String(tenantUser.id), action: "manual_invoice_created", entityType: "Invoice", entityId: String(invoice.id), after: { amount: data.amount, currency: invoice.currency } }); return invoice; }
export async function getTenantIntegrationState(tenantId, provider) {
  const row = await db.tenantIntegration.findUnique({ where: { tenantId_provider: { tenantId, provider: String(provider).toUpperCase() } } });
  return { exists: Boolean(row), enabled: Boolean(row?.enabled), config: row?.secretEnc ? decryptJson(row.secretEnc) : {} };
}

export async function getTenantInvoiceSettings(tenantId) {
  // La modalidad es un ajuste del cliente: se lee aunque Mercado Pago todavía no esté habilitado.
  const [subscription, state] = await Promise.all([getTenantSubscriptionPolicy(tenantId), getTenantIntegrationState(tenantId, "MERCADOPAGO")]);
  return { mode: String(state.config?.INVOICE_MODE || "automatic").toLowerCase(), policy: subscription?.policy ?? null };
}

export async function updateTenantInvoiceSettings(tenantId, mode) {
  const normalized = String(mode || "").toLowerCase();
  if (!["automatic", "confirmation"].includes(normalized)) throw new Error("Modalidad invalida");
  if (normalized === "confirmation") await policyWith(ENTITLEMENTS.CLIENT_APPROVAL, tenantId);
  // Guardar la modalidad nunca habilita Mercado Pago: sin credenciales propias el polling no debe arrancar.
  const state = await getTenantIntegrationState(tenantId, "MERCADOPAGO");
  const enabled = resolveSettingsOnlyEnabled("MERCADOPAGO", { existingEnabled: state.enabled, config: state.config });
  await upsertTenantIntegrationConfig(tenantId, "MERCADOPAGO", { INVOICE_MODE: normalized }, { enabled });
  return { mode: normalized };
}
