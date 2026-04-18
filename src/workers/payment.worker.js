import logger from "../utils/logger.js";
import { buildQueueJobId, toBigIntId, toQueueId } from "../utils/bigint.js";

import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { invoicesQueue } from "../queues/invoices.queue.js";

import { getPayment, updatePaymentStatus, updatePayment } from "../models/Payment.js";
import { getNextCbteNro, setLastCbteNro, resyncCbteNro } from "../models/InvoiceSequence.js";
import { createInvoiceAFIP } from "../services/afip.service.js";

import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";

const worker = new Worker("payments", async (job) => {
    try {
        const tenantId = toBigIntId(job.data.tenantId, "tenantId");
        const paymentId = toBigIntId(job.data.paymentId, "paymentId");

        if (!tenantId || !paymentId) throw new Error("Job inválido: faltan tenantId o paymentId");

        const payment = await getPayment(tenantId, paymentId);

        if (!payment) return;

        if (!["pending", "processing", "afip_pending"].includes(payment.status)) return;

        await updatePaymentStatus(tenantId, payment.id, "processing");
        await logPaymentEvent(tenantId, payment.id, "invoice_requested", "Inicio de emision AFIP", {
            previousStatus: payment.status,
        });
        payment.status = "processing";

        // Leer AFIP config por tenant (desde TenantIntegration)
        const afipCfg = await getTenantIntegrationConfig(tenantId, "AFIP");
        const ptoVta = Number(afipCfg.PTO_VTA);
        const cbteTipo = Number(afipCfg.CBTE_TIPO);

        if (!ptoVta || !cbteTipo) {
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", "AFIP config incompleta (PTO_VTA/CBTE_TIPO).");
            await logPaymentEvent(tenantId, payment.id, "failed", "AFIP config incompleta", {
                ptoVta,
                cbteTipo,
            });
            throw new Error("AFIP config incompleta (PTO_VTA/CBTE_TIPO).");
        }

        const seq = await getNextCbteNro(tenantId, ptoVta, cbteTipo, afipCfg);
        if (!seq) {
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", "No se pudo obtener el ultimo comprobante.");
            await logPaymentEvent(tenantId, payment.id, "failed", "No se pudo obtener el ultimo comprobante.");
            throw new Error("No se pudo obtener el ultimo comprobante.");
        }

        const nextCbteNro = seq.next;

        const response = await createInvoiceAFIP(nextCbteNro, payment.amount, afipCfg);
        if (response.error) {
            await updatePaymentStatus(tenantId, payment.id, "afip_pending", "No se pudo obtener el cae de AFIP.");
            await logPaymentEvent(tenantId, payment.id, "failed", "Error al emitir en AFIP", {
                error: String(response.error),
            });

            if (String(response.error).includes("El numero o fecha del comprobante no se corresponde con el proximo a autorizar")) {
                const resync = await resyncCbteNro(tenantId, ptoVta, cbteTipo, afipCfg);
                logger.info(`🔄 [t=${tenantId}] Ultimo comprobante actualizado → ${resync}`);
            }

            throw new Error("No se pudo obtener el cae de AFIP.");
        }

        const { cae, nroComprobante, fechaVtoCae } = response;

        await setLastCbteNro(seq.id, nextCbteNro);

        payment.cae = cae;
        payment.cae_vto = fechaVtoCae;
        payment.cbte_nro = nroComprobante;
        payment.cbte_tipo = cbteTipo;
        payment.pto_vta = ptoVta;

        await updatePayment(tenantId, payment.id, payment);
        await logPaymentEvent(tenantId, payment.id, "afip_ok", "Factura autorizada por AFIP", {
            cae,
            nroComprobante,
            fechaVtoCae,
        });

        await invoicesQueue.add(`invoices-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "post" }),
            attempts: 5,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 50,
        });
    } catch (err) {
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
