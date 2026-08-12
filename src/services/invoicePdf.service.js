import { getPayment } from "../models/Payment.js";
import { normalizeAfipConfig } from "./afip.service.js";
import { createInvoicePdfBuffer } from "./pdf.service.js";
import { getTenantIntegrationConfig } from "./tenantConfig.service.js";

export async function generateInvoicePdfForPayment(tenantId, paymentId) {
  const payment = await getPayment(tenantId, paymentId);
  if (!payment) {
    throw new Error("Pago no encontrado");
  }

  if (!payment.cae || !payment.cbte_nro || !payment.cae_vto) {
    throw new Error("La factura todavia no tiene datos suficientes para generar PDF");
  }

  const afipRaw = await getTenantIntegrationConfig(tenantId, "AFIP");
  const afipBranding = normalizeAfipConfig(afipRaw);
  const pdfBuffer = await createInvoicePdfBuffer(
    payment,
    payment.cae,
    payment.cbte_nro,
    payment.cae_vto,
    afipBranding
  );

  if (!pdfBuffer) {
    throw new Error("No se pudo generar el PDF");
  }

  return {
    payment,
    pdfBuffer,
  };
}

export function getInvoicePdfFilename(payment) {
  const cbteNro = String(payment?.cbte_nro || "factura").replace(/[^\d-]/g, "");
  return `${cbteNro || "factura"}.pdf`;
}
