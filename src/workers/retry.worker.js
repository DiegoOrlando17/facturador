import logger from "../utils/logger.js";

import { getPendingPayments } from "../models/Payment.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { invoicesQueue } from "../queues/invoices.queue.js";
import { keepGoogleConnectionsAlive } from "../services/tenantGoogle.service.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";

const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

async function reenqueuePendingPayments() {

  try {
    const pendings = await getPendingPayments();

    if (!pendings.length) {
      return;
    }

    for (const payment of pendings) {
      try {
        const { id, tenantId, provider_payment_id, status } = payment;

        if (status === "afip_pending") {
          await paymentsQueue.add(`payments-${tenantId}-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "afip" }),
            attempts: 5,
            backoff: { type: "exponential", delay: 3000 },
            removeOnComplete: true,
            removeOnFail: 50,
          });
        }
        else if (["pdf_pending", "drive_pending", "sheets_pending"].includes(status)) {
          await invoicesQueue.add(`invoices-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "post" }),
            attempts: 5,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 50,
          });
        }
      } catch (innerErr) {
        logger.error(`❌ Error reintentando pago ${payment.id}: ${innerErr.message}`);
      }
    }

    await keepGoogleConnectionsAlive();

  } catch (err) {
    logger.error("❌ Error en Retry worker:", err);
  }
}

// Repite el proceso automáticamente cada X minutos
setInterval(reenqueuePendingPayments, RETRY_INTERVAL_MS);

// Ejecuta al arrancar también
await reenqueuePendingPayments();

logger.info(`♻️  Retry worker iniciado (intervalo: ${RETRY_INTERVAL_MS / 60000} min).`);
