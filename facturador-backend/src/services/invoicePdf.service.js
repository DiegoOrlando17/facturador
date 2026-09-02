import { getPayment } from "../models/Payment.js";
import { buildInvoicePaymentView, getInvoiceById, getInvoiceByPaymentId } from "../models/Invoice.js";
import { normalizeAfipConfig } from "./afip.service.js";
import { createInvoicePdfBuffer } from "./pdf.service.js";
import { getTenantIntegrationConfig } from "./tenantConfig.service.js";

export async function generateInvoicePdfForPayment(tenantId, paymentId) {
  const payment = await getPayment(tenantId, paymentId);
  if (!payment) {
    throw new Error("Pago no encontrado");
  }

  const invoice = await getInvoiceByPaymentId(tenantId, paymentId);
  if (!invoice || invoice.status !== "ISSUED" || !invoice.cae || !invoice.cbteNro || !invoice.caeVto) {
    throw new Error("La factura todavia no tiene datos suficientes para generar PDF");
  }

  const invoiceView = buildInvoicePaymentView(payment, invoice);

  const afipRaw = await getTenantIntegrationConfig(tenantId, "AFIP");
  const afipBranding = normalizeAfipConfig(afipRaw);
  const pdfBuffer = await createInvoicePdfBuffer(
    invoiceView,
    invoice.cae,
    invoice.cbteNro,
    invoice.caeVto,
    afipBranding
  );

  if (!pdfBuffer) {
    throw new Error("No se pudo generar el PDF");
  }

  return {
    payment: invoiceView,
    invoice,
    pdfBuffer,
  };
}

export function getInvoicePdfFilename(payment) {
  const cbteNro = String(payment?.cbte_nro || "factura").replace(/[^\d-]/g, "");
  return `${cbteNro || "factura"}.pdf`;
}

export async function generateInvoicePdfById(tenantId, invoiceId) {
  const invoice = await getInvoiceById(tenantId, invoiceId);
  if (!invoice || invoice.status !== "ISSUED" || !invoice.cae || !invoice.cbteNro || !invoice.caeVto) throw new Error("El comprobante todavia no tiene datos suficientes para generar PDF");
  const view = { amount: invoice.amount, currency: invoice.currency, customer: invoice.customer, customer_doc_type: invoice.customerDocType, customer_doc_number: invoice.customerDocNumber, cae: invoice.cae, cae_vto: invoice.caeVto, cbte_nro: invoice.cbteNro, cbte_tipo: invoice.cbteTipo, pto_vta: invoice.ptoVta };
  const afipBranding = normalizeAfipConfig(await getTenantIntegrationConfig(tenantId, "AFIP"));
  const pdfBuffer = await createInvoicePdfBuffer(view, invoice.cae, invoice.cbteNro, invoice.caeVto, afipBranding);
  if (!pdfBuffer) throw new Error("No se pudo generar el PDF");
  return { invoice, pdfBuffer };
}
