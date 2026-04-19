import fs from "fs";
import path from "path";
import { getPayment, updatePayment } from "../models/Payment.js";
import { normalizeAfipConfig } from "./afip.service.js";
import { createInvoicePDF } from "./pdf.service.js";
import { getTenantIntegrationConfig } from "./tenantConfig.service.js";
import { logPaymentEvent } from "./paymentEvent.service.js";

function resolvePdfPath(pdfPath) {
  if (!pdfPath) return null;
  return path.isAbsolute(pdfPath) ? pdfPath : path.resolve(pdfPath);
}

function fileExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

export async function ensureInvoicePdfForPayment(tenantId, paymentId) {
  const payment = await getPayment(tenantId, paymentId);
  if (!payment) {
    throw new Error("Pago no encontrado");
  }

  if (!payment.cae || !payment.cbte_nro || !payment.cae_vto) {
    throw new Error("La factura todavia no tiene datos suficientes para generar PDF");
  }

  const existingPath = resolvePdfPath(payment.pdf_path);
  if (fileExists(existingPath)) {
    return {
      payment,
      filePath: existingPath,
      generated: false,
    };
  }

  const afipRaw = await getTenantIntegrationConfig(tenantId, "AFIP");
  const afipBranding = normalizeAfipConfig(afipRaw);
  const generatedPath = await createInvoicePDF(
    payment,
    payment.cae,
    payment.cbte_nro,
    payment.cae_vto,
    afipBranding
  );

  if (!generatedPath) {
    throw new Error("No se pudo generar el PDF");
  }

  const absolutePath = resolvePdfPath(generatedPath);
  payment.pdf_path = generatedPath;
  await updatePayment(tenantId, payment.id, payment);
  await logPaymentEvent(tenantId, payment.id, "pdf_ok", "PDF generado on-demand", {
    onDemand: true,
    pdfPath: generatedPath,
  });

  return {
    payment: {
      ...payment,
      pdf_path: generatedPath,
    },
    filePath: absolutePath,
    generated: true,
  };
}

export function getInvoicePdfFilename(payment) {
  if (payment?.pdf_path) {
    return path.basename(String(payment.pdf_path));
  }

  const cbteNro = String(payment?.cbte_nro || "factura").replace(/[^\d-]/g, "");
  return `${cbteNro || "factura"}.pdf`;
}
