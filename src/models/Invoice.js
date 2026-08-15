import { db } from "./db.js";

function serializePayload(payload) {
  if (!payload) return null;
  return JSON.stringify(payload, (_key, value) => (
    typeof value === "bigint" ? value.toString() : value
  ));
}

function paymentSnapshot(payment) {
  return {
    amount: payment.amount,
    currency: payment.currency,
    customer: payment.customer,
    customerDocType: payment.customer_doc_type,
    customerDocNumber: payment.customer_doc_number,
  };
}

export async function ensureAutomaticInvoiceForPayment(tenantId, payment) {
  return db.invoice.upsert({
    where: {
      invoice_paymentId_tenantId: {
        paymentId: payment.id,
        tenantId,
      },
    },
    // El snapshot fiscal no se modifica si la factura ya existe.
    update: {},
    create: {
      tenantId,
      paymentId: payment.id,
      type: "INVOICE",
      source: "AUTOMATIC",
      status: "QUEUED",
      ...paymentSnapshot(payment),
    },
  });
}

export async function markInvoiceIssuing(tenantId, invoiceId, previousStatus) {
  const [, event] = await db.$transaction([
    db.invoice.update({
      where: { invoice_id_tenantId: { id: invoiceId, tenantId } },
      data: { status: "ISSUING", error: null },
    }),
    db.invoiceEvent.create({
      data: {
        tenantId,
        invoiceId,
        type: "ISSUANCE_REQUESTED",
        message: "Inicio de emision ARCA",
        payloadJson: serializePayload({ previousStatus }),
      },
    }),
  ]);

  return event;
}

export async function markInvoiceFailed(tenantId, invoiceId, message, payload = null) {
  const [invoice] = await db.$transaction([
    db.invoice.update({
      where: { invoice_id_tenantId: { id: invoiceId, tenantId } },
      data: { status: "FAILED", error: message },
    }),
    db.invoiceEvent.create({
      data: {
        tenantId,
        invoiceId,
        type: "FAILED",
        message,
        payloadJson: serializePayload(payload),
      },
    }),
  ]);

  return invoice;
}

export async function markInvoiceIssued(tenantId, invoiceId, fiscalData) {
  const issuedAt = new Date();
  const [invoice] = await db.$transaction([
    db.invoice.update({
      where: { invoice_id_tenantId: { id: invoiceId, tenantId } },
      data: {
        status: "ISSUED",
        cae: fiscalData.cae,
        caeVto: fiscalData.caeVto,
        cbteNro: fiscalData.cbteNro,
        cbteTipo: fiscalData.cbteTipo,
        ptoVta: fiscalData.ptoVta,
        issuedAt,
        error: null,
      },
    }),
    db.invoiceEvent.create({
      data: {
        tenantId,
        invoiceId,
        type: "ISSUED",
        message: "Comprobante autorizado por ARCA",
        payloadJson: serializePayload(fiscalData),
      },
    }),
  ]);

  return invoice;
}
