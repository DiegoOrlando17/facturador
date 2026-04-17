import logger from "../utils/logger.js";
import { toBigIntId } from "../utils/bigint.js";

import { Worker } from "bullmq";
import { updatePayment, updatePaymentStatus, getPayment } from "../models/Payment.js";
import { createInvoicePDF } from "../services/pdf.service.js";
import { uploadToDrive } from "../services/drive.service.js";
import { appendRow } from "../services/sheets.service.js";
import { connection } from "../config/redis.js";
import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { normalizeAfipConfig } from "../services/afip.service.js";
import { getGoogleInvoiceContext } from "../services/tenantGoogle.service.js";
import { getTodaysDate, formatToLocalTime } from "../utils/date.js";

const worker = new Worker("invoices", async (job) => {
    try {
        const tenantId = toBigIntId(job.data.tenantId, "tenantId");
        const paymentId = toBigIntId(job.data.paymentId, "paymentId");

        if (!tenantId || !paymentId) {
            throw new Error("Job inválido: faltan tenantId o paymentId");
        }

        const payment = await getPayment(tenantId, paymentId);

        if (!payment) return;

        if (payment.status !== "processing" && payment.status !== "pdf_pending" && payment.status !== "drive_pending" && payment.status !== "sheets_pending") return;

        const afipRaw = await getTenantIntegrationConfig(tenantId, "AFIP");
        const afipBranding = normalizeAfipConfig(afipRaw);

        const googleCtx = await getGoogleInvoiceContext(tenantId);

        if (payment.status === "processing" || payment.status === "pdf_pending") {
            const pdfPath = await createInvoicePDF(payment, payment.cae, payment.cbte_nro, payment.cae_vto, afipBranding);
            if (!pdfPath) {
                await updatePaymentStatus(tenantId, payment.id, "pdf_pending", "No se pudo generar la factura.");
                throw new Error("No se pudo generar la factura.");
            }

            payment.pdf_path = pdfPath;
            await updatePayment(tenantId, payment.id, payment);
        }

        if (payment.status === "processing" || payment.status === "pdf_pending" || payment.status === "drive_pending") {
            const cuitFile = String(afipBranding.CUIT ?? "");
            const fileName = `${cuitFile}_${payment.cbte_tipo?.toString().padStart(3, "0") ?? "000"}_${payment.pto_vta?.toString().padStart(5, "0") ?? "00000"}_${payment.cbte_nro.split("-")[1]}_${getTodaysDate()}.pdf`;
            const driveFile = await uploadToDrive(payment.pdf_path, fileName, {
                accessToken: googleCtx.accessToken,
                folderId: googleCtx.driveFolderId,
            });
            if (!driveFile) {
                await updatePaymentStatus(tenantId, payment.id, "drive_pending", "No se pudo subir la factura al drive.");
                throw new Error("No se pudo subir la factura al drive.");
            }

            payment.drive_file_link = driveFile.webViewLink;
            await updatePayment(tenantId, payment.id, payment);
        }

        if (payment.status === "processing" || payment.status === "pdf_pending" || payment.status === "drive_pending" || payment.status === "sheets_pending") {
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
                throw new Error("No se pudo registrar en el sheets.");
            }

            payment.sheets_row = sheets.row;
            await updatePayment(tenantId, payment.id, payment);
        }

        await updatePaymentStatus(tenantId, payment.id, "complete");

    } catch (err) {
        logger.error("Error en el invoice worker: " + err);
        throw err;
    }
}, {
    concurrency: 1,
    connection: connection,
    lockDuration: 30000,
    stalledInterval: 60000,
    lockRenewTime: 15000
});

worker.on("ready", () => console.log("✅ Worker invoices listo y conectado a Redis"));
worker.on("error", (err) => console.error("❌ Error en worker:", err));
worker.on("failed", (job, err) => console.error(`⚠️ Job ${job.id} falló:`, err));
