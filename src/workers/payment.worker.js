import logger from "../utils/logger.js";
import { buildQueueJobId, toBigIntId, toQueueId } from "../utils/bigint.js";

import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { invoicesQueue } from "../queues/invoices.queue.js";

import { getPayment, updatePaymentStatus } from "../models/Payment.js";
import {
    ensureAutomaticInvoiceForPayment,
    markInvoiceFailed,
    markInvoiceIssued,
    markInvoiceIssuing,
} from "../models/Invoice.js";
import { getNextCbteNro, setLastCbteNro, resyncCbteNro } from "../models/InvoiceSequence.js";
import { createInvoiceAFIP } from "../services/afip.service.js";

import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";
import { syncPaymentToSheets } from "../services/paymentSheets.service.js";

async function recordAfipFailureInSheets(tenantId, payment, errorMessage) {
    try {
        await syncPaymentToSheets(tenantId, payment, {
            status: "ERROR",
            error: errorMessage,
        });
    } catch (error) {
        logger.error(`No se pudo registrar el error AFIP en Sheets para pago ${payment.id}: ${error}`);
    }
}

async function enqueueInvoicePostProcess(tenantId, payment) {
    await invoicesQueue.add(`invoices-${payment.provider_payment_id.toString()}`, {
        tenantId: toQueueId(tenantId),
        paymentId: toQueueId(payment.id),
    }, {
        jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "post" }),
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 50,
    });
}

const worker = new Worker("payments", async (job) => {
    let tenantId;
    let payment;
    let invoice;
    try {
        tenantId = toBigIntId(job.data.tenantId, "tenantId");
        const paymentId = toBigIntId(job.data.paymentId, "paymentId");

        if (!tenantId || !paymentId) throw new Error("Job inválido: faltan tenantId o paymentId");

        payment = await getPayment(tenantId, paymentId);

        if (!payment) return;

        if (!["pending", "processing", "afip_pending"].includes(payment.status)) return;

        invoice = await ensureAutomaticInvoiceForPayment(tenantId, payment);

        if (invoice.status === "ISSUED" && invoice.cae && invoice.cbteNro && invoice.caeVto) {
            await updatePaymentStatus(tenantId, payment.id, "processing");
            await logPaymentEvent(tenantId, payment.id, "payment_updated", "Emision ARCA omitida: factura ya emitida", {
                invoiceId: invoice.id.toString(),
            });
            await enqueueInvoicePostProcess(tenantId, payment);
            return;
        }

        await updatePaymentStatus(tenantId, payment.id, "processing");
        await markInvoiceIssuing(tenantId, invoice.id, invoice.status);
        await logPaymentEvent(tenantId, payment.id, "invoice_requested", "Inicio de emision AFIP", {
            previousStatus: payment.status,
        });
        payment.status = "processing";
        payment.error = null;

        // Leer AFIP config por tenant (desde TenantIntegration)
        const afipCfg = await getTenantIntegrationConfig(tenantId, "AFIP");
        const ptoVta = Number(afipCfg.PTO_VTA);
        const cbteTipo = Number(afipCfg.CBTE_TIPO);

        if (!ptoVta || !cbteTipo) {
            await markInvoiceFailed(tenantId, invoice.id, "AFIP config incompleta (PTO_VTA/CBTE_TIPO).", {
                ptoVta,
                cbteTipo,
            });
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", "AFIP config incompleta (PTO_VTA/CBTE_TIPO).");
            await logPaymentEvent(tenantId, payment.id, "failed", "AFIP config incompleta", {
                ptoVta,
                cbteTipo,
            });
            payment.status = "afip_pending";
            payment.error = "AFIP config incompleta (PTO_VTA/CBTE_TIPO).";
            await recordAfipFailureInSheets(tenantId, payment, payment.error);
            throw new Error("AFIP config incompleta (PTO_VTA/CBTE_TIPO).");
        }

        const seq = await getNextCbteNro(tenantId, ptoVta, cbteTipo, afipCfg);
        if (!seq) {
            await markInvoiceFailed(tenantId, invoice.id, "No se pudo obtener el ultimo comprobante.");
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", "No se pudo obtener el ultimo comprobante.");
            await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo obtener el ultimo comprobante.");
            payment.status = "afip_pending";
            payment.error = "No se pudo obtener el ultimo comprobante.";
            await recordAfipFailureInSheets(tenantId, payment, payment.error);
            throw new Error("No se pudo obtener el ultimo comprobante.");
        }

        const nextCbteNro = seq.next;

        const response = await createInvoiceAFIP(nextCbteNro, payment.amount, afipCfg);
        if (response.error) {
            await markInvoiceFailed(tenantId, invoice.id, "Error al emitir en ARCA", {
                error: String(response.error),
            });
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", "No se pudo obtener el cae de AFIP.");
            await logPaymentEvent(tenantId, payment.id, "failed", "Error al emitir en AFIP", {
                error: String(response.error),
            });
            payment.status = "afip_pending";
            payment.error = String(response.error);
            await recordAfipFailureInSheets(tenantId, payment, payment.error);

            if (String(response.error).includes("El numero o fecha del comprobante no se corresponde con el proximo a autorizar")) {
                const resync = await resyncCbteNro(tenantId, ptoVta, cbteTipo, afipCfg);
                logger.info(`🔄 [t=${tenantId}] Ultimo comprobante actualizado → ${resync}`);
            }

            throw new Error("No se pudo obtener el cae de AFIP.");
        }

        const { cae, nroComprobante, fechaVtoCae } = response;

        invoice = await markInvoiceIssued(tenantId, invoice.id, {
            cae,
            caeVto: fechaVtoCae,
            cbteNro: nroComprobante,
            cbteTipo,
            ptoVta,
        });

        await setLastCbteNro(seq.id, nextCbteNro);

        await logPaymentEvent(tenantId, payment.id, "afip_ok", "Factura autorizada por AFIP", {
            cae,
            nroComprobante,
            fechaVtoCae,
        });

        await enqueueInvoicePostProcess(tenantId, payment);
    } catch (err) {
        if (tenantId && payment && payment.status === "processing") {
            const errorMessage = err?.message || String(err);
            if (invoice && invoice.status !== "ISSUED") {
                await markInvoiceFailed(tenantId, invoice.id, errorMessage, { source: "worker_catch" });
            }
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", errorMessage);
            payment.status = "afip_pending";
            payment.error = errorMessage;
            await recordAfipFailureInSheets(tenantId, payment, errorMessage);
        }
        logger.error("Error en el payment worker: " + err);
        throw err;
    }
}, {
    concurrency: 1,
    connection: connection,
    lockDuration: 30000,      // cuánto dura el lock antes de considerarlo muerto
    stalledInterval: 60000,   // cada 60s revisa jobs colgados
    lockRenewTime: 15000
});

worker.on("ready", () => console.log("✅ Worker payments listo y conectado a Redis"));
worker.on("error", (err) => console.error("❌ Error en worker:", err));
worker.on("failed", (job, err) => console.error(`⚠️ Job ${job.id} falló:`, err));
