import { Router } from "express";
import { buildTenantGoogleAuthUrl, connectTenantGoogleFromCallback } from "../services/tenantGoogle.service.js";

const router = Router();

router.get("/oauth/start", async (req, res) => {
  try {
    const tenantSlug = String(req.query.tenant || "").trim();
    if (!tenantSlug) {
      return res.status(400).json({ error: "Falta tenant" });
    }

    const authUrl = buildTenantGoogleAuthUrl({
      tenantSlug,
      driveFolderId: req.query.driveFolderId ? String(req.query.driveFolderId) : null,
      sheetsId: req.query.sheetsId ? String(req.query.sheetsId) : null,
      sheetName: req.query.sheetName ? String(req.query.sheetName) : null,
    });

    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo iniciar OAuth Google" });
  }
});

router.get("/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();

    if (!code || !state) {
      return res.status(400).json({ error: "Faltan code o state" });
    }

    const result = await connectTenantGoogleFromCallback({ code, state });
    return res.status(200).json({
      ok: true,
      message: "Google conectado al tenant",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo completar OAuth Google" });
  }
});

export default router;
