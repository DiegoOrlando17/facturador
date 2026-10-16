import logger from "../utils/logger.js";
import axios from "axios";

import { DateTime } from "luxon";
import { config } from "../config/index.js";
import { parseUtc } from "../utils/date.js";

export const MP_MISSING_CREDENTIALS_MESSAGE = "La integración de Mercado Pago del cliente no tiene credenciales";
export const DEFAULT_MP_API_URL = "https://api.mercadopago.com";
const REQUIRED_MP_FIELDS = ["ACCESS_TOKEN", "POS_ID"];

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Normaliza la config MP de un tenant. Las credenciales (ACCESS_TOKEN, POS_ID)
 * salen SOLO de la integracion del tenant: nunca hay fallback al .env, para
 * no consultar la cuenta de otro cliente. API_URL es de plataforma.
 */
export function normalizeMpConfig(mpCfg = {}, platformConfig = config.MP) {
  const cfg = mpCfg && typeof mpCfg === "object" ? mpCfg : {};
  return {
    ACCESS_TOKEN: cleanString(cfg.ACCESS_TOKEN),
    POS_ID: cleanString(cfg.POS_ID),
    API_URL: cleanString(cfg.API_URL) || cleanString(platformConfig?.API_URL) || DEFAULT_MP_API_URL,
    POLLING_MODE: cfg.POLLING_MODE ?? "realtime",
    POLLING_INTERVAL_MS: Number(cfg.POLLING_INTERVAL_MS ?? 5000),
    RUNS_PER_DAY: cfg.RUNS_PER_DAY ? Number(cfg.RUNS_PER_DAY) : null,
    RUN_AT_TIMES: Array.isArray(cfg.RUN_AT_TIMES) ? cfg.RUN_AT_TIMES : [],
    TIMEZONE: cfg.TIMEZONE ?? "America/Argentina/Buenos_Aires",
  };
}

/** Campos de credenciales MP que faltan en la integracion del tenant. */
export function getMissingMpCredentials(mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);
  return REQUIRED_MP_FIELDS.filter((field) => !cfg[field]);
}

export function buildMissingMpCredentialsError(missing = REQUIRED_MP_FIELDS) {
  const error = new Error(`${MP_MISSING_CREDENTIALS_MESSAGE} (falta ${missing.join(", ")})`);
  error.code = "MP_MISSING_CREDENTIALS";
  error.missingFields = [...missing];
  return error;
}

/**
 * Devuelve la config normalizada o lanza un error claro si el tenant no tiene
 * ACCESS_TOKEN y POS_ID propios. Nunca consulta MP sin credenciales del tenant.
 */
export function requireMpCredentials(mpCfg = {}) {
  const missing = getMissingMpCredentials(mpCfg);
  if (missing.length > 0) throw buildMissingMpCredentialsError(missing);
  return normalizeMpConfig(mpCfg);
}

/**
 * Guard para workers multitenant: devuelve true si el tenant no tiene credenciales
 * MP propias y debe saltearse. Avisa una sola vez por tenant (hasta que las cargue)
 * para no inundar el log; los demas tenants siguen procesandose.
 */
export function createMpCredentialsGuard({ log = logger, action = "el procesamiento" } = {}) {
  const warned = new Set();
  return function shouldSkipTenant(tenantId, mpCfg) {
    const key = String(tenantId);
    const missing = getMissingMpCredentials(mpCfg);
    if (missing.length === 0) {
      warned.delete(key);
      return false;
    }
    if (!warned.has(key)) {
      warned.add(key);
      log.warn(`⚠️ [t=${key}] ${MP_MISSING_CREDENTIALS_MESSAGE} (falta ${missing.join(", ")}). Se omite ${action} de este cliente.`);
    }
    return true;
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
  const cfg = requireMpCredentials(mpCfg);

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
  const cfg = requireMpCredentials(mpCfg);

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
  const cfg = requireMpCredentials(mpCfg);

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
  const cfg = requireMpCredentials(mpCfg);
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
