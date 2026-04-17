import logger from "../utils/logger.js";
import { buildQueueJobId, toBigIntId, toQueueId } from "../utils/bigint.js";

import { Worker } from "bullmq";
import { updatePaymentStatus, getPayment, updatePayment } from "../models/Payment.js";
import { getPaymentInfoMP, fetchPaymentById } from "../services/mercadopago.service.js";
import { connection } from "../config/redis.js";
import { paymentsQueue } from "../queues/payments.queue.js";

const worker = new Worker("webhooks", async (job) => {
    try {
        const tenantId = toBigIntId(job.data.tenantId, "tenantId");
        const paymentId = toBigIntId(job.data.paymentId, "paymentId");

        if (!tenantId || !paymentId) throw new Error("Job inválido: faltan tenantId o paymentId");

        const payment = await getPayment(tenantId, paymentId);

        if (!payment) return;

        if (payment.status !== "pending" && payment.status !== "mercadopago_fetch_pending") return;

        await updatePaymentStatus(tenantId, payment.id, "processing");
        payment.status = "processing";

        if (payment.provider === "mercadopago") {

            const paymentMP = await fetchPaymentById(payment.provider_payment_id);
            if (paymentMP === null) {
                await updatePaymentStatus(tenantId, payment.id, "mercadopago_fetch_pending", "No se pudo recuperar el pago de la api mercadopago.");
                throw new Error("No se pudo recuperar el pago de la api mercadopago.");
            }

            const data = getPaymentInfoMP(paymentMP);
            if (data === null) {
                await updatePaymentStatus(tenantId, payment.id, "mercadopago_fetch_pending", "No se pudo mapear el pago de MercadoPago.");
                throw new Error("No se pudo mapear el pago de MercadoPago.");
            }

            if (paymentMP.status !== "approved") {
                throw new Error("El pago todavia no esta aprobado.");
            }

            payment.payment_method_id = data.payment_method_id;
            payment.amount = data.amount;
            payment.currency = data.currency;
            payment.customer = data.customer || "";
            payment.customer_doc_type = data.customer_doc_type || "";
            payment.customer_doc_number = data.customer_doc_number || "";
            payment.date_approved = data.date_approved;

            await updatePayment(tenantId, payment.id, payment);
        }

        await paymentsQueue.add(`payments-${tenantId}-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "afip" }),
            attempts: 10,
            backoff: { type: "exponential", delay: 3000 },
            removeOnComplete: true,
            removeOnFail: 50,
        });
    } catch (err) {
        logger.error("Error en el webhook worker: " + err);
        throw err;
    }
}, {
    concurrency: 10,
    connection: connection,
    lockDuration: 30000,
    stalledInterval: 60000,
    lockRenewTime: 15000
});

worker.on("ready", () => console.log("✅ Worker webhooks listo y conectado a Redis"));
worker.on("error", (err) => console.error("❌ Error en worker:", err));
worker.on("failed", (job, err) => console.error(`⚠️ Job ${job.id} falló:`, err));
