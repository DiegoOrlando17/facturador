import { Router } from "express";
import { requireTenantAuth, requireTenantPermission } from "../middlewares/tenantAuth.middleware.js";
import { TENANT_PERMISSIONS } from "../domain/permissions.js";
import {
  authenticateTenantUser,
  getTenantPortalPaymentDetail,
  getTenantPortalDashboard,
  getTenantPortalIntegrations,
  getTenantPortalReportsSummary,
  getTenantPortalReportsTimeseries,
  listTenantPortalPaymentsForExport,
  listTenantPortalPayments,
  getTenantPortalProfile,
  updateTenantPortalProfile,
} from "../services/tenantPortal.service.js";
import {
  getTenantIntegrationConfig,
  replaceTenantIntegrationConfig,
  tryGetTenantIntegrationConfig,
} from "../services/tenantConfig.service.js";
import { buildPaymentsCsv } from "../services/csvExport.service.js";
import { generateInvoicePdfById, generateInvoicePdfForPayment, getInvoicePdfFilename } from "../services/invoicePdf.service.js";
import {
  createTenantOnboardingSubmission,
  listTenantOnboardingSubmissions,
} from "../services/tenantOnboarding.service.js";
import { testIntegrationConnection } from "../services/integrationTest.service.js";
import { createTenantToken } from "../utils/tenantToken.js";
import { toBigIntId } from "../utils/bigint.js";
import { mergeGoogleTenantIntegrationConfig } from "../services/tenantGoogle.service.js";
import { getTenantSubscriptionPolicy } from "../services/subscriptionPolicy.service.js";
import { ENTITLEMENTS, hasEntitlement } from "../domain/planPolicy.js";
import { cancelTenantInvoice, confirmTenantInvoice, createManualTenantInvoice, getTenantInvoice, getTenantInvoiceSettings, listTenantInvoices, updateTenantInvoiceSettings } from "../services/tenantInvoice.service.js";

const router = Router();
const TESTABLE_PROVIDERS = new Set(["MERCADOPAGO", "AFIP", "DRIVE", "SHEETS"]);
const TENANT_CONFIGURABLE_PROVIDERS = new Set(["DRIVE", "SHEETS"]);

function normalizeJsonBigInts(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJsonBigInts);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, current]) => [key, normalizeJsonBigInts(current)])
  );
}

router.post("/auth/login", async (req, res) => {
  try {
    const tenantSlug = String(req.body.tenantSlug || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!tenantSlug) throw new Error("tenantSlug es obligatorio");
    if (!email) throw new Error("email es obligatorio");
    if (!password) throw new Error("password es obligatoria");

    const tenantUser = await authenticateTenantUser(tenantSlug, email, password);
    if (!tenantUser) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = createTenantToken(tenantUser);
    return res.json(normalizeJsonBigInts({
      token,
      tenantUser,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo iniciar sesion" });
  }
});

router.post("/auth/logout", (_req, res) => {
  return res.status(204).send();
});

router.get("/me", requireTenantAuth, (req, res) => {
  return res.json(normalizeJsonBigInts(req.tenantAuth.tenantUser));
});

router.use(requireTenantAuth);

router.get("/dashboard", async (req, res) => {
  try {
    const summary = await getTenantPortalDashboard(req.tenantAuth.tenantId);
    return res.json(normalizeJsonBigInts(summary));
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo obtener dashboard portal" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const payload = await listTenantPortalPayments(req.tenantAuth.tenantId, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      provider: req.query.provider,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.json(normalizeJsonBigInts(payload));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar pagos" });
  }
});

router.get("/payments/export.csv", async (req, res) => {
  try {
    const payload = await listTenantPortalPaymentsForExport(req.tenantAuth.tenantId, {
      status: req.query.status,
      provider: req.query.provider,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const csv = buildPaymentsCsv(payload.items, { includeTenant: false });
    const tenantSlug = req.tenantAuth.tenantUser.tenant?.slug || "tenant";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payments-${tenantSlug}.csv"`);
    res.setHeader("X-Export-Max-Rows", String(payload.exportInfo.maxRows));
    res.setHeader("X-Export-Truncated", String(payload.exportInfo.truncated));
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo exportar CSV" });
  }
});

router.get("/payments/:id", async (req, res) => {
  try {
    const paymentId = toBigIntId(req.params.id, "paymentId");
    const payment = await getTenantPortalPaymentDetail(req.tenantAuth.tenantId, paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    return res.json(normalizeJsonBigInts(payment));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el pago" });
  }
});

router.get("/payments/:id/pdf", async (req, res) => {
  try {
    const paymentId = toBigIntId(req.params.id, "paymentId");
    const { payment, pdfBuffer } = await generateInvoicePdfForPayment(req.tenantAuth.tenantId, paymentId);
    const filename = getInvoicePdfFilename(payment);
    const asDownload = String(req.query.download || "false") === "true";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${asDownload ? "attachment" : "inline"}; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el PDF" });
  }
});

router.get("/reports/summary", async (req, res) => {
  try {
    const summary = await getTenantPortalReportsSummary(req.tenantAuth.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    return res.json(normalizeJsonBigInts(summary));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener resumen de reportes" });
  }
});

router.get("/reports/timeseries", async (req, res) => {
  try {
    const series = await getTenantPortalReportsTimeseries(req.tenantAuth.tenantId, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      granularity: req.query.granularity,
    });

    return res.json(normalizeJsonBigInts(series));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener serie temporal" });
  }
});

router.get("/integrations", async (req, res) => {
  try {
    const integrations = await getTenantPortalIntegrations(req.tenantAuth.tenantId);
    return res.json(normalizeJsonBigInts(integrations));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar integraciones" });
  }
});

router.get("/invoices", async (req, res) => {
  try { return res.json(normalizeJsonBigInts(await listTenantInvoices(req.tenantAuth.tenantId, req.query))); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudieron listar comprobantes" }); }
});
router.get("/invoices/settings", async (req, res) => {
  try { return res.json(normalizeJsonBigInts(await getTenantInvoiceSettings(req.tenantAuth.tenantId))); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo obtener la modalidad" }); }
});
router.put("/invoices/settings", requireTenantPermission(TENANT_PERMISSIONS.MANAGE_INVOICES), async (req, res) => {
  try { return res.json(await updateTenantInvoiceSettings(req.tenantAuth.tenantId, req.body.mode)); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo guardar la modalidad" }); }
});
router.post("/invoices/manual", requireTenantPermission(TENANT_PERMISSIONS.MANAGE_INVOICES), async (req, res) => {
  try { return res.status(201).json(normalizeJsonBigInts(await createManualTenantInvoice(req.tenantAuth.tenantId, req.tenantAuth.tenantUser, req.body))); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo crear la factura manual" }); }
});
router.get("/invoices/:id", async (req, res) => {
  try { const invoice = await getTenantInvoice(req.tenantAuth.tenantId, toBigIntId(req.params.id, "invoiceId")); return invoice ? res.json(normalizeJsonBigInts(invoice)) : res.status(404).json({ error: "Comprobante no encontrado" }); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo obtener el comprobante" }); }
});
router.post("/invoices/:id/confirm", requireTenantPermission(TENANT_PERMISSIONS.CONFIRM_INVOICES), async (req, res) => {
  try { return res.json(normalizeJsonBigInts(await confirmTenantInvoice(req.tenantAuth.tenantId, toBigIntId(req.params.id, "invoiceId"), req.tenantAuth.tenantUser, { issueAt: req.body?.issueAt }))); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo confirmar el comprobante" }); }
});
router.post("/invoices/:id/credit-note", requireTenantPermission(TENANT_PERMISSIONS.MANAGE_INVOICES), async (req, res) => {
  try { if (req.body.confirmation !== "ANULAR") throw new Error("Debes confirmar escribiendo ANULAR"); return res.status(202).json(normalizeJsonBigInts(await cancelTenantInvoice(req.tenantAuth.tenantId, toBigIntId(req.params.id, "invoiceId"), req.tenantAuth.tenantUser))); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo solicitar la nota de credito" }); }
});
router.get("/invoices/:id/pdf", async (req, res) => {
  try { const { invoice, pdfBuffer } = await generateInvoicePdfById(req.tenantAuth.tenantId, toBigIntId(req.params.id, "invoiceId")); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${String(invoice.cbteNro || "comprobante").replace(/[^\d-]/g, "")}.pdf"`); return res.send(pdfBuffer); }
  catch (error) { return res.status(400).json({ error: error.message || "No se pudo obtener el PDF" }); }
});

router.get("/subscription", async (req, res) => {
  try {
    const subscription = await getTenantSubscriptionPolicy(req.tenantAuth.tenantId);
    return res.json(normalizeJsonBigInts(subscription));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener la suscripcion" });
  }
});

router.get("/profile", async (req, res) => {
  try {
    return res.json(normalizeJsonBigInts(await getTenantPortalProfile(req.tenantAuth.tenantId)));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el perfil fiscal" });
  }
});

router.put("/profile", requireTenantPermission(TENANT_PERMISSIONS.MANAGE_PROFILE), async (req, res) => {
  try {
    const profile = await updateTenantPortalProfile(req.tenantAuth.tenantId, req.body);
    return res.json(normalizeJsonBigInts(profile));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo guardar el perfil fiscal" });
  }
});

router.put("/integrations/:provider", requireTenantPermission(TENANT_PERMISSIONS.MANAGE_INTEGRATIONS), async (req, res) => {
  try {
    const provider = String(req.params.provider || "").trim().toUpperCase();
    if (!TENANT_CONFIGURABLE_PROVIDERS.has(provider)) {
      throw new Error("El portal solo permite configurar destinos de Drive y Sheets");
    }

    const subscription = await getTenantSubscriptionPolicy(req.tenantAuth.tenantId);
    if (!hasEntitlement(subscription?.policy, ENTITLEMENTS.GOOGLE_DRIVE_SHEETS)) {
      return res.status(403).json({ error: "Tu plan no incluye Google Drive y Sheets" });
    }

    const existing = await tryGetTenantIntegrationConfig(req.tenantAuth.tenantId, provider);
    if (!existing?.REFRESH_TOKEN) {
      throw new Error("Un administrador debe conectar Google por OAuth antes de configurar el destino");
    }

    const config = mergeGoogleTenantIntegrationConfig(provider, existing, req.body?.config);
    const row = await replaceTenantIntegrationConfig(req.tenantAuth.tenantId, provider, config, { enabled: true });
    return res.json(normalizeJsonBigInts({
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      enabled: row.enabled,
      config: provider === "DRIVE"
        ? { DRIVE_FOLDER_ID: config.DRIVE_FOLDER_ID ?? null }
        : { SHEETS_ID: config.SHEETS_ID ?? null, SHEET_NAME: config.SHEET_NAME ?? "Hoja1" },
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo guardar la integracion" });
  }
});

router.post("/integrations/:provider/test", requireTenantPermission(TENANT_PERMISSIONS.TEST_INTEGRATIONS), async (req, res) => {
  try {
    const provider = String(req.params.provider || "").trim().toUpperCase();
    if (!TESTABLE_PROVIDERS.has(provider)) {
      throw new Error(`Test de conexion no implementado para ${provider}`);
    }

    if (provider === "DRIVE" || provider === "SHEETS") {
      const subscription = await getTenantSubscriptionPolicy(req.tenantAuth.tenantId);
      if (!hasEntitlement(subscription?.policy, ENTITLEMENTS.GOOGLE_DRIVE_SHEETS)) {
        return res.status(403).json({ ok: false, provider, error: "Tu plan no incluye Google Drive y Sheets" });
      }
    }

    const config = await getTenantIntegrationConfig(req.tenantAuth.tenantId, provider);
    const result = await testIntegrationConnection(provider, config);

    return res.json(normalizeJsonBigInts({
      tenantId: req.tenantAuth.tenantId,
      ...result,
    }));
  } catch (error) {
    return res.status(400).json({
      ok: false,
      provider: String(req.params.provider || "").toUpperCase(),
      error: error.message || "No se pudo probar la integracion",
    });
  }
});

router.get("/onboarding", async (req, res) => {
  try {
    const items = await listTenantOnboardingSubmissions(req.tenantAuth.tenantId, {
      status: req.query.status,
    });
    return res.json(normalizeJsonBigInts({
      items,
      total: items.length,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo listar onboarding" });
  }
});

router.post("/onboarding", requireTenantPermission(TENANT_PERMISSIONS.SUBMIT_ONBOARDING), async (req, res) => {
  try {
    const submission = await createTenantOnboardingSubmission(
      req.tenantAuth.tenantId,
      req.tenantAuth.tenantUser.id,
      {
        business: req.body.business,
        integrations: req.body.integrations,
        documents: req.body.documents,
        processingStartDate: req.body.processingStartDate,
      }
    );

    return res.status(201).json(normalizeJsonBigInts(submission));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo enviar onboarding" });
  }
});

export default router;
