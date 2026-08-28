import { Router } from "express";
import { connectTenantGoogleFromCallback } from "../services/tenantGoogle.service.js";

const router = Router();

router.get("/oauth/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    const state = String(req.query.state || "").trim();

    if (!code || !state) {
      return res.status(400).json({ error: "Faltan code o state" });
    }

    const result = await connectTenantGoogleFromCallback({ code, state });
    const completionMessage = JSON.stringify({
      type: "facturador:google-oauth",
      ok: true,
      tenantSlug: result.tenantSlug,
      flowId: result.flowId,
    }).replace(/</g, "\\u003c");
    return res.status(200).type("html").send(`<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><title>Google conectado</title></head>
  <body>
    <p>Google se conecto correctamente al tenant.</p>
    <p>Esta ventana se cerrara automaticamente.</p>
    <script>
      if (window.opener) window.opener.postMessage(${completionMessage}, "*");
      window.close();
    </script>
  </body>
</html>`);
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo completar OAuth Google" });
  }
});

export default router;
