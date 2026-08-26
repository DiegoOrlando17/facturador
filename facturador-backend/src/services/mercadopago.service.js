import logger from "../utils/logger.js";
import axios from "axios";

import { DateTime } from "luxon";
import { config } from "../config/index.js";
import { parseUtc } from "../utils/date.js";

export function normalizeMpConfig(mpCfg = {}) {
  return {
    ACCESS_TOKEN: mpCfg.ACCESS_TOKEN ?? config.MP.ACCESS_TOKEN,
    POS_ID: mpCfg.POS_ID ?? config.MP.POS_ID,
    API_URL: mpCfg.API_URL ?? config.MP.API_URL,
    POLLING_MODE: mpCfg.POLLING_MODE ?? "realtime",
    POLLING_INTERVAL_MS: Number(mpCfg.POLLING_INTERVAL_MS ?? config.MP.POLLING_INTERVAL ?? 5000),
    RUNS_PER_DAY: mpCfg.RUNS_PER_DAY ? Number(mpCfg.RUNS_PER_DAY) : null,
    RUN_AT_TIMES: Array.isArray(mpCfg.RUN_AT_TIMES) ? mpCfg.RUN_AT_TIMES : [],
    TIMEZONE: mpCfg.TIMEZONE ?? "America/Argentina/Buenos_Aires",
  };
}

export function getPaymentInfoMP(payment) {
  try {
    return {
      id: payment.id,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      date_approved: payment.date_approved,
      payment_method_id: payment.payment_method?.id || null,
      customer: payment.payer?.email || null,
      customer_doc_type: payment.payer?.identification?.type || null,
      customer_doc_number: payment.payer?.identification?.number || null,
    };
  } catch (error) {
    logger.error("Error obteniendo pago:", error);
    return null;
  }
}

/** Consulta puntual de una orden de pago por id. */
export async function fetchPaymentById(paymentId, mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);

  try {
    const res = await axios.get(`${cfg.API_URL}/payments/${paymentId}`, {
      headers: { Authorization: "Bearer " + cfg.ACCESS_TOKEN },
    });
    return res.data;
  } catch (error) {
    logger.error(`fetchPaymentById ${paymentId}: ${error.message}`);
    return null;
  }
}

/**
 * - Ordenar por date_approved DESC (mas nuevos primero)
 * - Paginamos con offset
 * - Procesamos pagos mientras su date_approved >= (lastApprovedDate - overlap)
 * - Apenas vemos pagos con date_approved < (lastApprovedDate - overlap), cortamos la paginacion
 * - De-duplicamos por provider_payment_id (DB) o por un set en memoria si hace falta
 */
export async function fetchNewPayments(lastTimestamp, mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);

  const limit = 200;
  const maxPages = 20;
  const overlapMs = 90_000;
  const maxLookbackMs = 8 * 60 * 60 * 1000;

  const newPayments = [];
  const seenIds = new Set();

  let offset = 0;
  let pages = 0;

  const now = new Date();
  const fallbackFloor = new Date(now.getTime() - maxLookbackMs);
  const lastApproved = lastTimestamp ? new Date(lastTimestamp) : fallbackFloor;
  const floorDate = new Date(Math.max(0, lastApproved.getTime() - overlapMs));

  let olderConsecutiveCount = 0;

  while (true) {
    if (pages >= maxPages) break;

    try {
      const params = {
        status: "approved",
        sort: "date_approved",
        criteria: "desc",
        limit,
        offset,
      };

      const res = await axios.get(`${cfg.API_URL}/payments/search`, {
        headers: { Authorization: "Bearer " + cfg.ACCESS_TOKEN },
        params,
      });

      const results = res.data.results || [];
      if (results.length === 0) break;

      results.sort((a, b) => new Date(b.date_approved) - new Date(a.date_approved));

      for (const payment of results) {
        const approvedAt = parseUtc(payment.date_approved);

        if (approvedAt < floorDate) {
          olderConsecutiveCount++;
        } else {
          olderConsecutiveCount = 0;
        }

        if (olderConsecutiveCount >= 10) break;

        const isPosOk = payment.pos_id !== null && String(payment.pos_id) === String(cfg.POS_ID);
        const isNotTransfer = payment.operation_type !== "money_transfer";

        if (!isPosOk || !isNotTransfer) continue;

        if (!seenIds.has(payment.id)) {
          seenIds.add(payment.id);
          newPayments.push(payment);
        }
      }

      if (results.length < limit) break;

      offset += limit;
      pages += 1;
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      logger.warn(`⚠️ MP devolvio ${status || "error"} en offset ${offset}: ${message}`);
      break;
    }
  }

  newPayments.sort((a, b) => new Date(a.date_approved) - new Date(b.date_approved));
  return newPayments;
}

export async function fetchLastPayment(mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);

  try {
    const params = {
      status: "approved",
      sort: "date_approved",
      criteria: "desc",
      limit: 1,
    };

    const res = await axios.get(`${cfg.API_URL}/payments/search`, {
      headers: { Authorization: "Bearer " + cfg.ACCESS_TOKEN },
      params,
    });

    const results = res.data.results || [];
    logger.info(`Resultado de FetchLastPayment: ${JSON.stringify(results)}`);
    if (results.length === 0) return null;

    return results[0];
  } catch (error) {
    logger.error("Error en FetchLastPayment de Mercadopago:", error);
    return null;
  }
}

export async function fetchLast24HsPayments(mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);
  const nowLocal = DateTime.now().setZone("America/Argentina/Buenos_Aires");
  const windowEndLocal = nowLocal;
  const windowStartLocal = nowLocal.minus({ hours: 25 });

  const startIsoUtc = windowStartLocal.toUTC().toISO();
  const endIsoUtc = windowEndLocal.toUTC().toISO();

  const limit = 500;
  let offset = 0;
  const all = [];
  const seen = new Set();

  while (true) {
    const params = {
      status: "approved",
      limit,
      offset,
      begin_date: startIsoUtc,
      end_date: endIsoUtc,
    };

    let res;
    try {
      res = await axios.get(`${cfg.API_URL}/payments/search`, {
        headers: { Authorization: "Bearer " + cfg.ACCESS_TOKEN },
        params,
      });
    } catch (err) {
      logger.error("⚠️ MP error en auditor:", err.response?.status, err.message);
      break;
    }

    const results = res.data.results || [];
    if (results.length === 0) break;

    for (const p of results) {
      const key = String(p.id);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(p);
      }
    }

    if (results.length < limit) break;
    offset += limit;
  }

  return all.filter((p) =>
    String(p.pos_id) === String(cfg.POS_ID) &&
    p.operation_type !== "money_transfer"
  );
}
