import logger from "../utils/logger.js";

import { getPendingPayments } from "../models/Payment.js";
import { getInvoiceByPaymentId, logInvoiceEvent } from "../models/Invoice.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { invoicesQueue } from "../queues/invoices.queue.js";
import { keepGoogleConnectionsAlive } from "../services/tenantGoogle.service.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";
import { addOrReplaceFailedJob, resolveAutomaticRetryStep } from "../domain/retryPolicy.js";

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
        const invoice = await getInvoiceByPaymentId(tenantId, id);

        const step = resolveAutomaticRetryStep(status, invoice?.status);
        if (step) {
          await logPaymentEvent(tenantId, id, "retry_scheduled", `Retry worker reencolo paso ${step}`, {
            status,
            invoiceStatus: invoice?.status ?? null,
            resolvedStep: step,
          });
          if (invoice) {
            await logInvoiceEvent(tenantId, invoice.id, "RETRY_SCHEDULED", `Retry worker reencolo paso ${step}`, {
              paymentStatus: status,
              invoiceStatus: invoice.status,
            });
          }
          const queue = step === "afip" ? paymentsQueue : invoicesQueue;
          await addOrReplaceFailedJob(queue, `${step}-${tenantId}-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step }),
            attempts: 5,
            backoff: { type: "exponential", delay: step === "afip" ? 3000 : 2000 },
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
