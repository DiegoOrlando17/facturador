import { Router } from "express";
import { getBillingAvailability, listPublicPlans, registerPublicTenant, verifyPublicContact } from "../services/publicCommercial.service.js";

const router = Router();
const attempts = new Map();

function registrationRateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((value) => now - value < 15 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ error: "Demasiados intentos. Proba nuevamente en unos minutos." });
  recent.push(now); attempts.set(key, recent); return next();
}

router.get("/plans", async (_req, res) => { try { return res.json({ items: await listPublicPlans() }); } catch (error) { return res.status(500).json({ error: error.message || "No se pudieron obtener los planes" }); } });
router.get("/billing", (_req, res) => res.json(getBillingAvailability()));
router.post("/register", registrationRateLimit, async (req, res) => { try { return res.status(201).json(await registerPublicTenant(req.body)); } catch (error) { return res.status(400).json({ error: error.message || "No se pudo crear la cuenta" }); } });
router.post("/verify-contact", async (req, res) => { try { return res.json(await verifyPublicContact(req.body?.token)); } catch (error) { return res.status(400).json({ error: error.message || "No se pudo verificar el contacto" }); } });

export default router;
