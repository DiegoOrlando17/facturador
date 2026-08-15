import { getPayment } from "../models/Payment.js";
import { buildInvoicePaymentView, getInvoiceByPaymentId } from "../models/Invoice.js";
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
