import fs from "fs/promises";
import os from "os";
import path from "path";
import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { getPayment, updatePaymentStatus } from "../models/Payment.js";
import {
  buildInvoicePaymentView,
  getInvoiceByPaymentId,
  recordAvailableInvoiceDocument,
} from "../models/Invoice.js";
import { normalizeAfipConfig } from "../services/afip.service.js";
import { uploadToDrive } from "../services/drive.service.js";
import { getGoogleInvoiceContext } from "../services/tenantGoogle.service.js";
import { createInvoicePdfBuffer } from "../services/pdf.service.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";
import { syncPaymentToSheets } from "../services/paymentSheets.service.js";
import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { toBigIntId } from "../utils/bigint.js";
import { getTodaysDate } from "../utils/date.js";
import logger from "../utils/logger.js";
import {
  buildPaymentPostProcessLockKey,
  claimDistributedSlot,
} from "../services/distributedLock.service.js";

const POST_AFIP_STATUSES = new Set([
  "processing",
  "pdf_pending",
  "drive_pending",
  "sheets_pending",
]);
const POST_PROCESS_LOCK_TTL_MS = 10 * 60 * 1000;

async function createTemporaryInvoicePdf(payment, invoice, afipBranding) {
  const invoiceView = buildInvoicePaymentView(payment, invoice);
  const pdfBuffer = await createInvoicePdfBuffer(
    invoiceView,
    invoice.cae,
    invoice.cbteNro,
    invoice.caeVto,
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
    const googleRedelivery = job.data.googleRedelivery === true;

    if (!tenantId || !paymentId) {
      throw new Error("Job invalido: faltan tenantId o paymentId");
    }

    const postProcessClaim = await claimDistributedSlot(
      connection,
      buildPaymentPostProcessLockKey(tenantId, paymentId),
      POST_PROCESS_LOCK_TTL_MS
    );
    if (!postProcessClaim.claimed) {
      logger.info(`Postproceso omitido: otro worker procesa tenant=${tenantId} payment=${paymentId}`);
      return;
    }

    try {
    const payment = await getPayment(tenantId, paymentId);
    if (!payment) return;
    const invoice = await getInvoiceByPaymentId(tenantId, paymentId, { includeDocuments: true });
    if (!POST_AFIP_STATUSES.has(payment.status) && !googleRedelivery && invoice?.status !== "ISSUED") return;

    const hasIssuedInvoice = Boolean(
      invoice?.status === "ISSUED" && invoice.cae && invoice.cbteNro && invoice.caeVto
    );
    let googleCtx = null;
    if (hasIssuedInvoice) {
      try {
        googleCtx = await getGoogleInvoiceContext(tenantId);
      } catch (error) {
        const message = `No se pudo autenticar Google: ${error?.message || String(error)}`;
        await updatePaymentStatus(tenantId, payment.id, "drive_pending", message);
        await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo autenticar Google para el postproceso", {
          invoiceStatus: invoice.status,
        });
        throw error;
      }
    }
    if (!hasIssuedInvoice) {
      const sheetsResult = await syncPaymentToSheets(tenantId, payment, {
        status: "ERROR",
        error: payment.error || "La facturacion en ARCA no fue completada",
      });
      if (googleRedelivery && !sheetsResult.synced) {
        throw new Error("El tenant no tiene Sheets habilitado/configurado o no se pudo escribir");
      }
      return;
    }

    Object.assign(payment, buildInvoicePaymentView(payment, invoice));

    const driveDocument = invoice.documents.find((document) => (
      document.type === "PDF"
      && document.storageProvider === "GOOGLE_DRIVE"
      && document.status === "AVAILABLE"
      && document.externalUrl
    ));

    payment.drive_file_link = driveDocument?.externalUrl ?? null;

    if (googleRedelivery && driveDocument && payment.sheets_row) {
      await logPaymentEvent(tenantId, payment.id, "payment_updated", "Entrega Google omitida: ya estaba completa", {
        googleDelivery: "already_complete",
      });
      return;
    }

    const needsDrive = Boolean(googleCtx && !driveDocument);
    if (needsDrive) {
      const afipRaw = await getTenantIntegrationConfig(tenantId, "AFIP");
      const afipBranding = normalizeAfipConfig(afipRaw);
      const temporaryPdf = await createTemporaryInvoicePdf(payment, invoice, afipBranding);

      if (!temporaryPdf) {
        await updatePaymentStatus(tenantId, payment.id, "drive_pending", "No se pudo generar el PDF temporal.");
        await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo generar el PDF temporal para Drive");
        payment.error = "No se pudo generar el PDF temporal.";
        await syncPaymentToSheets(tenantId, payment, { status: "ERROR", error: payment.error });
        throw new Error("No se pudo generar el PDF temporal.");
      }

      try {
        const cuitFile = String(afipBranding.CUIT ?? "");
        const invoiceNumber = String(invoice.cbteNro || "").split("-")[1] || String(invoice.cbteNro || "");
        const fileName = `${cuitFile}_${invoice.cbteTipo?.toString().padStart(3, "0") ?? "000"}_${invoice.ptoVta?.toString().padStart(5, "0") ?? "00000"}_${invoiceNumber}_${getTodaysDate()}.pdf`;
        const driveFile = await uploadToDrive(temporaryPdf.filePath, fileName, {
          accessToken: googleCtx.accessToken,
          folderId: googleCtx.driveFolderId,
        });

        if (!driveFile) {
          await updatePaymentStatus(tenantId, payment.id, "drive_pending", "No se pudo subir la factura al drive.");
          await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo subir la factura a Drive");
          payment.error = "No se pudo subir la factura al drive.";
          await syncPaymentToSheets(tenantId, payment, { status: "ERROR", error: payment.error });
          throw new Error("No se pudo subir la factura al drive.");
        }

        await recordAvailableInvoiceDocument(tenantId, invoice.id, {
          type: "PDF",
          storageProvider: "GOOGLE_DRIVE",
          externalId: driveFile.id,
          externalUrl: driveFile.webViewLink,
          fileName,
          mimeType: "application/pdf",
        });
        payment.drive_file_link = driveFile.webViewLink;
        await logPaymentEvent(tenantId, payment.id, "drive_ok", "Factura subida a Drive", {
          driveFileLink: driveFile.webViewLink,
        });
      } finally {
        await fs.rm(temporaryPdf.tempDir, { recursive: true, force: true });
      }
    }

    const sheetsResult = await syncPaymentToSheets(tenantId, payment, {
      status: "OK",
      error: null,
    });
    if (!sheetsResult.synced && sheetsResult.reason === "write_failed") {
      await updatePaymentStatus(tenantId, payment.id, "sheets_pending", "No se pudo registrar en el sheets.");
      await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo registrar la factura en Sheets");
      throw new Error("No se pudo registrar en el sheets.");
    }

    if (googleRedelivery && !googleCtx && !sheetsResult.synced) {
      throw new Error("El tenant no tiene Drive ni Sheets habilitados/configurados completamente");
    }

    await updatePaymentStatus(tenantId, payment.id, "complete");
    await logPaymentEvent(tenantId, payment.id, "payment_updated", "Proceso post-AFIP completado", {
      finalStatus: "complete",
      driveDelivery: googleCtx ? "processed_or_existing" : "not_enabled_or_incomplete",
      sheetsDelivery: sheetsResult.synced ? "synced" : "not_enabled_or_incomplete",
    });
    } finally {
      try {
        await postProcessClaim.release();
      } catch (releaseError) {
        logger.error(`No se pudo liberar lock postproceso tenant=${tenantId} payment=${paymentId}: ${releaseError.message}`);
      }
    }
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
