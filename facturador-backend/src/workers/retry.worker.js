import logger from "../utils/logger.js";

import { getPendingPayments } from "../models/Payment.js";
import { getInvoiceByPaymentId, logInvoiceEvent } from "../models/Invoice.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { invoicesQueue } from "../queues/invoices.queue.js";
import { keepGoogleConnectionsAlive } from "../services/tenantGoogle.service.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";

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

        if (status === "afip_pending") {
          const step = invoice?.status === "ISSUED" ? "post" : "afip";
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
          await queue.add(`${step}-${tenantId}-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step }),
            attempts: 5,
            backoff: { type: "exponential", delay: step === "afip" ? 3000 : 2000 },
            removeOnComplete: true,
            removeOnFail: 50,
          });
        }
        else if (["pdf_pending", "drive_pending", "sheets_pending"].includes(status)) {
          await logPaymentEvent(tenantId, id, "retry_scheduled", "Retry worker reencolo paso post-AFIP", {
            status,
          });
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
