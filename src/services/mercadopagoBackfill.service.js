import axios from "axios";
import { DateTime } from "luxon";
import logger from "../utils/logger.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { getPaymentByProviderPaymentId, upsertPayment } from "../models/Payment.js";
import { getPaymentInfoMP, normalizeMpConfig } from "./mercadopago.service.js";
import { logPaymentEvent } from "./paymentEvent.service.js";
import { setIntegrationCheckpoint } from "./tenantConfig.service.js";

const DEFAULT_ZONE = "America/Argentina/Buenos_Aires";

export function parseProcessingStartDate(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("processingStartDate es obligatorio");

  const parsed = raw.includes("T")
    ? DateTime.fromISO(raw, { setZone: true })
    : DateTime.fromISO(raw, { zone: DEFAULT_ZONE }).startOf("day");

  if (!parsed.isValid) {
    throw new Error("processingStartDate invalida");
  }

  return parsed.toUTC();
}

async function enqueueAfipJob(tenantId, payment) {
  await paymentsQueue.add(
    `payments-${tenantId}-${payment.provider_payment_id.toString()}`,
    { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) },
    {
      jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "afip" }),
      attempts: 10,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: true,
      removeOnFail: 50,
    }
  );
}

export async function fetchApprovedPaymentsSince(processingStartDate, mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);
  const start = parseProcessingStartDate(processingStartDate);
  const end = DateTime.utc();
  const limit = 200;
  const maxPages = 100;
  const payments = [];
  const seen = new Set();

  let offset = 0;
  let pages = 0;

  while (pages < maxPages) {
    const params = {
      status: "approved",
      sort: "date_approved",
      criteria: "asc",
      begin_date: start.toISO(),
      end_date: end.toISO(),
      limit,
      offset,
    };

    const res = await axios.get(`${cfg.API_URL}/payments/search`, {
      headers: { Authorization: "Bearer " + cfg.ACCESS_TOKEN },
      params,
    });

    const results = res.data.results || [];
    if (results.length === 0) break;

    for (const payment of results) {
      const approvedAt = payment.date_approved ? DateTime.fromISO(payment.date_approved, { setZone: true }) : null;
      const isInWindow = approvedAt?.isValid && approvedAt.toUTC() >= start && approvedAt.toUTC() <= end;
      const isPosOk = payment.pos_id !== null && String(payment.pos_id) === String(cfg.POS_ID);
      const isNotTransfer = payment.operation_type !== "money_transfer";
      const key = String(payment.id);

      if (isInWindow && isPosOk && isNotTransfer && !seen.has(key)) {
        seen.add(key);
        payments.push(payment);
      }
    }

    if (results.length < limit) break;
    offset += limit;
    pages += 1;
  }

  payments.sort((a, b) => {
    const byDate = new Date(a.date_approved).getTime() - new Date(b.date_approved).getTime();
    return byDate || Number(a.id) - Number(b.id);
  });

  return payments;
}

export async function startMercadopagoProcessingFromDate(tenantId, processingStartDate, mpCfg = {}) {
  const start = parseProcessingStartDate(processingStartDate);
  const mpPayments = await fetchApprovedPaymentsSince(start.toISO(), mpCfg);

  let created = 0;
  let skipped = 0;
  let enqueued = 0;

  for (const mpPayment of mpPayments) {
    const providerPaymentId = String(mpPayment.id || "");
    const existing = await getPaymentByProviderPaymentId(tenantId, "mercadopago", providerPaymentId);

    if (existing) {
      skipped += 1;
      continue;
    }

    const data = getPaymentInfoMP(mpPayment);
    if (!data) {
      logger.warn(`[t=${tenantId}] No se pudo mapear pago MP ${providerPaymentId}`);
      skipped += 1;
      continue;
    }

    const payment = await upsertPayment(tenantId, "mercadopago", providerPaymentId, {
      ...data,
      status: "pending",
    });

    await logPaymentEvent(tenantId, payment.id, "payment_detected", "Pago importado desde alta/backfill MP", {
      processingStartDate: start.toISO(),
      providerPaymentId,
    });

    await enqueueAfipJob(tenantId, payment);
    created += 1;
    enqueued += 1;
  }

  const newest = mpPayments.at(-1);
  await setIntegrationCheckpoint(tenantId, "MERCADOPAGO", {
    timestamp: newest?.date_approved || start.toISO(),
    lastPaymentId: newest ? String(newest.id) : "0",
    processingStartDate: start.toISO(),
    initializedBy: "admin_start_processing",
  });

  return {
    processingStartDate: start.toISO(),
    imported: mpPayments.length,
    created,
    skipped,
    enqueued,
    checkpoint: {
      timestamp: newest?.date_approved || start.toISO(),
      lastPaymentId: newest ? String(newest.id) : "0",
    },
  };
}
