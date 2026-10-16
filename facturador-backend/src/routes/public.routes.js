import { Router } from "express";
import { getBillingAvailability, listPublicPlans, registerPublicTenant, resendPublicContactVerification, verifyPublicContact } from "../services/publicCommercial.service.js";
import { processMercadoPagoBillingNotification } from "../services/mercadoPagoBilling.service.js";
import { PublicRequestError } from "../domain/publicRegistration.js";

const router = Router();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MESSAGE = "Hiciste demasiados intentos. Probá de nuevo en unos minutos.";

/**
 * Limitador en memoria por IP. Cada endpoint tiene su propio contador para que,
 * por ejemplo, reenviar la verificacion no consuma los intentos de registro.
 */
export function createRateLimit({ max, windowMs = RATE_LIMIT_WINDOW_MS, now = () => Date.now() }) {
  const attempts = new Map();
  return function rateLimit(req, res, next) {
    const key = req.ip || "unknown";
    const current = now();
    const recent = (attempts.get(key) || []).filter((value) => current - value < windowMs);
    if (recent.length >= max) {
      attempts.set(key, recent);
      return res.status(429).json({ error: RATE_LIMIT_MESSAGE, code: "RATE_LIMITED" });
    }
    recent.push(current);
    attempts.set(key, recent);
    return next();
  };
}

const registerRateLimit = createRateLimit({ max: 5 });
const resendRateLimit = createRateLimit({ max: 5 });
const verifyRateLimit = createRateLimit({ max: 30 });

function sendPublicError(res, error, fallback) {
  if (error instanceof PublicRequestError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error("[public]", error);
  return res.status(500).json({ error: fallback, code: "UNEXPECTED_ERROR" });
}

router.get("/plans", async (_req, res) => {
  try {
    return res.json({ items: await listPublicPlans() });
  } catch (error) {
    return sendPublicError(res, error, "No pudimos cargar los planes. Probá de nuevo en unos minutos.");
  }
});

router.get("/billing", (_req, res) => res.json(getBillingAvailability()));

router.post("/register", registerRateLimit, async (req, res) => {
  try {
    return res.status(201).json(await registerPublicTenant(req.body));
  } catch (error) {
    return sendPublicError(res, error, "No pudimos crear la cuenta. Probá de nuevo en unos minutos.");
  }
});

router.post("/verify-contact", verifyRateLimit, async (req, res) => {
  try {
    return res.json(await verifyPublicContact(req.body?.token));
  } catch (error) {
    return sendPublicError(res, error, "No pudimos verificar el email. Probá de nuevo en unos minutos.");
  }
});

router.post("/resend-verification", resendRateLimit, async (req, res) => {
  try {
    return res.status(202).json(await resendPublicContactVerification(req.body?.email));
  } catch (error) {
    return sendPublicError(res, error, "No pudimos reenviar el enlace. Probá de nuevo en unos minutos.");
  }
});

router.post("/billing/mercadopago/webhook", async (req, res) => { try { const topic = req.query.type || req.body?.type || req.query.topic || req.body?.topic; const id = req.query["data.id"] || req.body?.data?.id || req.query.id || req.body?.id; const result = await processMercadoPagoBillingNotification(topic, id); return res.status(200).json(result); } catch (error) { return res.status(400).json({ error: error.message || "Notificacion invalida" }); } });

export default router;
