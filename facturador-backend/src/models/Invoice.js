import { db } from "./db.js";
import { assertInvoiceTransition, stateConflict } from "../domain/processingState.js";

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

export function buildInvoicePaymentView(payment, invoice) {
  return {
    ...payment,
    amount: invoice.amount ?? payment.amount,
    currency: invoice.currency ?? payment.currency,
    customer: invoice.customer ?? payment.customer,
    customer_doc_type: invoice.customerDocType ?? payment.customer_doc_type,
    customer_doc_number: invoice.customerDocNumber ?? payment.customer_doc_number,
    cae: invoice.cae ?? null,
    cae_vto: invoice.caeVto ?? null,
    cbte_nro: invoice.cbteNro ?? null,
    cbte_tipo: invoice.cbteTipo ?? null,
    pto_vta: invoice.ptoVta ?? null,
    pdf_path: null,
  };
}

export function hydratePaymentWithInvoice(payment) {
  if (!payment?.invoice) return payment;

  const hydrated = buildInvoicePaymentView(payment, payment.invoice);
  const driveDocument = payment.invoice.documents?.find((document) => (
    document.type === "PDF"
    && document.storageProvider === "GOOGLE_DRIVE"
    && document.status === "AVAILABLE"
    && document.externalUrl
  ));

  return {
    ...hydrated,
    drive_file_link: driveDocument?.externalUrl ?? null,
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

export async function getInvoiceByPaymentId(tenantId, paymentId, { includeDocuments = false } = {}) {
  return db.invoice.findUnique({
    where: {
      invoice_paymentId_tenantId: {
        paymentId,
        tenantId,
      },
    },
    include: includeDocuments ? { documents: true } : undefined,
  });
}

export async function logInvoiceEvent(tenantId, invoiceId, type, message = null, payload = null) {
  return db.invoiceEvent.create({
    data: {
      tenantId,
      invoiceId,
      type,
      message,
      payloadJson: serializePayload(payload),
    },
  });
}

export async function recordAvailableInvoiceDocument(tenantId, invoiceId, {
  type,
  storageProvider,
  externalId = null,
  externalUrl = null,
  fileName = null,
  mimeType = null,
  checksum = null,
}) {
  const document = await db.invoiceDocument.upsert({
    where: {
      invoice_document_delivery: {
        invoiceId,
        type,
        storageProvider,
      },
    },
    update: {
      status: "AVAILABLE",
      externalId,
      externalUrl,
      fileName,
      mimeType,
      checksum,
      error: null,
    },
    create: {
      tenantId,
      invoiceId,
      type,
      status: "AVAILABLE",
      storageProvider,
      externalId,
      externalUrl,
      fileName,
      mimeType,
      checksum,
    },
  });

  await db.invoiceEvent.create({
    data: {
      tenantId,
      invoiceId,
      type: "DOCUMENT_CREATED",
      message: `${type} disponible en ${storageProvider}`,
      payloadJson: serializePayload({ documentId: document.id, externalId, externalUrl }),
    },
  });

  return document;
}

export async function markInvoiceIssuing(tenantId, invoiceId, previousStatus) {
  assertInvoiceTransition(previousStatus, "ISSUING");
  return db.$transaction(async (tx) => {
    const result = await tx.invoice.updateMany({
      where: { id: invoiceId, tenantId, status: previousStatus },
      data: { status: "ISSUING", error: null },
    });
    if (result.count !== 1) {
      throw stateConflict(`Invoice ${invoiceId} cambio de estado concurrentemente`);
    }

    return tx.invoiceEvent.create({
      data: {
        tenantId,
        invoiceId,
        type: "ISSUANCE_REQUESTED",
        message: "Inicio de emision ARCA",
        payloadJson: serializePayload({ previousStatus }),
      },
    });
  });
}

export async function markInvoiceFailed(tenantId, invoiceId, message, payload = null) {
  return db.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({
      where: { invoice_id_tenantId: { id: invoiceId, tenantId } },
      select: { status: true },
    });
    if (!current) throw new Error(`Invoice no encontrada: ${invoiceId}`);
    if (current.status === "FAILED") {
      return tx.invoice.findUnique({ where: { invoice_id_tenantId: { id: invoiceId, tenantId } } });
    }
    assertInvoiceTransition(current.status, "FAILED");

    const invoice = await tx.invoice.update({
      where: { invoice_id_tenantId: { id: invoiceId, tenantId } },
      data: { status: "FAILED", error: message },
    });
    await tx.invoiceEvent.create({
      data: {
        tenantId,
        invoiceId,
        type: "FAILED",
        message,
        payloadJson: serializePayload(payload),
      },
    });
    return invoice;
  });
}

export async function markInvoiceIssued(tenantId, invoiceId, fiscalData) {
  const issuedAt = new Date();
  return db.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({
      where: { invoice_id_tenantId: { id: invoiceId, tenantId } },
      select: { status: true },
    });
    if (!current) throw new Error(`Invoice no encontrada: ${invoiceId}`);
    assertInvoiceTransition(current.status, "ISSUED");

    const invoice = await tx.invoice.update({
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
    });
    await tx.invoiceEvent.create({
      data: {
        tenantId,
        invoiceId,
        type: "ISSUED",
        message: "Comprobante autorizado por ARCA",
        payloadJson: serializePayload(fiscalData),
      },
    });
    return invoice;
  });
}
