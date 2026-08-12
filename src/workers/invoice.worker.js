import fs from "fs/promises";
import os from "os";
import path from "path";
import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { getPayment, updatePayment, updatePaymentStatus } from "../models/Payment.js";
import { normalizeAfipConfig } from "../services/afip.service.js";
import { uploadToDrive } from "../services/drive.service.js";
import { getGoogleInvoiceContext } from "../services/tenantGoogle.service.js";
import { createInvoicePdfBuffer } from "../services/pdf.service.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";
import { appendRow } from "../services/sheets.service.js";
import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { toBigIntId } from "../utils/bigint.js";
import { formatToLocalTime, getTodaysDate } from "../utils/date.js";
import logger from "../utils/logger.js";

const POST_AFIP_STATUSES = new Set([
  "processing",
  "pdf_pending",
  "drive_pending",
  "sheets_pending",
]);

async function createTemporaryInvoicePdf(payment, afipBranding) {
  const pdfBuffer = await createInvoicePdfBuffer(
    payment,
    payment.cae,
    payment.cbte_nro,
    payment.cae_vto,
    afipBranding
  );

  if (!pdfBuffer) return null;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "facturador-pdf-"));
  const filePath = path.join(tempDir, "invoice.pdf");
  try {
    await fs.writeFile(filePath, pdfBuffer);
    return { tempDir, filePath };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

const worker = new Worker("invoices", async (job) => {
  try {
    const tenantId = toBigIntId(job.data.tenantId, "tenantId");
    const paymentId = toBigIntId(job.data.paymentId, "paymentId");

    if (!tenantId || !paymentId) {
      throw new Error("Job invalido: faltan tenantId o paymentId");
    }

    const payment = await getPayment(tenantId, paymentId);
    if (!payment || !POST_AFIP_STATUSES.has(payment.status)) return;

    const googleCtx = await getGoogleInvoiceContext(tenantId);
    if (!googleCtx) {
      await updatePaymentStatus(tenantId, payment.id, "complete");
      await logPaymentEvent(
        tenantId,
        payment.id,
        "payment_updated",
        "Proceso post-AFIP completado sin entrega Google",
        {
          finalStatus: "complete",
          googleDelivery: "not_enabled_or_incomplete",
        }
      );
      return;
    }

    const needsDrive = ["processing", "pdf_pending", "drive_pending"].includes(payment.status);
    if (needsDrive) {
      const afipRaw = await getTenantIntegrationConfig(tenantId, "AFIP");
      const afipBranding = normalizeAfipConfig(afipRaw);
      const temporaryPdf = await createTemporaryInvoicePdf(payment, afipBranding);

      if (!temporaryPdf) {
        await updatePaymentStatus(tenantId, payment.id, "drive_pending", "No se pudo generar el PDF temporal.");
        await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo generar el PDF temporal para Drive");
        throw new Error("No se pudo generar el PDF temporal.");
      }

      try {
        const cuitFile = String(afipBranding.CUIT ?? "");
        const invoiceNumber = String(payment.cbte_nro || "").split("-")[1] || String(payment.cbte_nro || "");
        const fileName = `${cuitFile}_${payment.cbte_tipo?.toString().padStart(3, "0") ?? "000"}_${payment.pto_vta?.toString().padStart(5, "0") ?? "00000"}_${invoiceNumber}_${getTodaysDate()}.pdf`;
        const driveFile = await uploadToDrive(temporaryPdf.filePath, fileName, {
          accessToken: googleCtx.accessToken,
          folderId: googleCtx.driveFolderId,
        });

        if (!driveFile) {
          await updatePaymentStatus(tenantId, payment.id, "drive_pending", "No se pudo subir la factura al drive.");
          await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo subir la factura a Drive");
          throw new Error("No se pudo subir la factura al drive.");
        }

        payment.drive_file_link = driveFile.webViewLink;
        await updatePayment(tenantId, payment.id, payment);
        await logPaymentEvent(tenantId, payment.id, "drive_ok", "Factura subida a Drive", {
          driveFileLink: driveFile.webViewLink,
        });
      } finally {
        await fs.rm(temporaryPdf.tempDir, { recursive: true, force: true });
      }
    }

    const sheets = await appendRow([
      payment.provider_payment_id.toString(),
      payment.cbte_nro,
      formatToLocalTime(payment.date_approved),
      payment.amount,
      payment.customer || "Consumidor Final",
      payment.cae,
      payment.cae_vto,
      "OK",
      payment.drive_file_link,
    ], {
      accessToken: googleCtx.accessToken,
      spreadsheetId: googleCtx.sheetsId,
      sheetName: googleCtx.sheetName,
    });

    if (!sheets) {
      await updatePaymentStatus(tenantId, payment.id, "sheets_pending", "No se pudo registrar en el sheets.");
      await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo registrar la factura en Sheets");
      throw new Error("No se pudo registrar en el sheets.");
    }

    payment.sheets_row = sheets.row;
    await updatePayment(tenantId, payment.id, payment);
    await logPaymentEvent(tenantId, payment.id, "sheets_ok", "Factura registrada en Sheets", {
      row: sheets.row,
    });

    await updatePaymentStatus(tenantId, payment.id, "complete");
    await logPaymentEvent(tenantId, payment.id, "payment_updated", "Proceso post-AFIP completado", {
      finalStatus: "complete",
    });
  } catch (error) {
    logger.error("Error en el invoice worker: " + error);
    throw error;
  }
}, {
  concurrency: 1,
  connection,
  lockDuration: 30000,
  stalledInterval: 60000,
  lockRenewTime: 15000,
});

worker.on("ready", () => console.log("Worker invoices listo y conectado a Redis"));
worker.on("error", (error) => console.error("Error en worker:", error));
worker.on("failed", (job, error) => console.error(`Job ${job.id} fallo:`, error));
