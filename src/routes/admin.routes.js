import { Router } from "express";
import { requireAdminAuth } from "../middlewares/adminAuth.middleware.js";
import { authenticateAdminUser } from "../services/adminUser.service.js";
import {
  getAdminDashboardSummary,
  getAdminPaymentDetail,
  getAdminReportsSummary,
  getAdminReportsTimeseries,
  getAdminTenantSummary,
  listAdminPaymentsForExport,
  listAdminPayments,
} from "../services/adminMonitor.service.js";
import {
  buildDashboardCards,
  summarizeTenantDetail,
  summarizeTenantListItem,
} from "../services/adminPresenter.service.js";
import { ensureInvoicePdfForPayment, getInvoicePdfFilename } from "../services/invoicePdf.service.js";
import { buildPaymentsCsv } from "../services/csvExport.service.js";
import {
  addOrUpdateTenantUserWithAuth,
  createTenant,
  getTenantBySlug,
  listTenantIntegrations,
  listTenantUsers,
  listTenants,
  replaceTenantIntegrationConfig,
  resolveTenantIdBySlug,
  updateTenant,
} from "../services/tenantConfig.service.js";
import {
  addTenantNote,
  listTenantNotes,
  reprocessPaymentAsAdmin,
} from "../services/tenantSupport.service.js";
import { createAdminToken } from "../utils/adminToken.js";
import { maskSecrets } from "../utils/crypto.js";
import { toBigIntId } from "../utils/bigint.js";

const router = Router();

const VALID_PROVIDERS = new Set(["MERCADOPAGO", "AFIP", "DRIVE", "SHEETS"]);
const VALID_TENANT_STATUS = new Set(["ACTIVE", "DISABLED"]);
const VALID_ROLES = new Set(["owner", "admin", "viewer", "approver"]);
const VALID_TENANT_USER_STATUS = new Set(["ACTIVE", "DISABLED"]);

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

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateTenantPayload(body, { partial = false } = {}) {
  const data = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) throw new Error("name es obligatorio");
    data.name = name;
  }

  if (!partial || body.slug !== undefined) {
    const slug = normalizeSlug(body.slug);
    if (!slug) throw new Error("slug es obligatorio");
    data.slug = slug;
  }

  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!VALID_TENANT_STATUS.has(status)) throw new Error("status invalido");
    data.status = status;
  }

  return data;
}

function validateProvider(provider) {
  const normalized = String(provider || "").toUpperCase();
  if (!VALID_PROVIDERS.has(normalized)) {
    throw new Error("provider invalido");
  }
  return normalized;
}

function validateIntegrationConfig(provider, config) {
  const current = config && typeof config === "object" && !Array.isArray(config) ? config : {};

  if (provider === "MERCADOPAGO") {
    if (!current.ACCESS_TOKEN) throw new Error("MERCADOPAGO.ACCESS_TOKEN es obligatorio");
    if (!current.POS_ID) throw new Error("MERCADOPAGO.POS_ID es obligatorio");
  }

  if (provider === "AFIP") {
    if (!current.CUIT) throw new Error("AFIP.CUIT es obligatorio");
    if (!current.PTO_VTA) throw new Error("AFIP.PTO_VTA es obligatorio");
    if (!current.CBTE_TIPO) throw new Error("AFIP.CBTE_TIPO es obligatorio");
  }

  if (provider === "DRIVE") {
    if (!current.REFRESH_TOKEN) throw new Error("DRIVE.REFRESH_TOKEN es obligatorio");
  }

  if (provider === "SHEETS") {
    if (!current.REFRESH_TOKEN) throw new Error("SHEETS.REFRESH_TOKEN es obligatorio");
  }

  return current;
}

async function buildAnalyticsFilters(query) {
  const filters = {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    granularity: query.granularity,
  };

  if (query.tenantSlug) {
    filters.tenantId = await resolveTenantIdBySlug(String(query.tenantSlug));
    filters.tenantSlug = String(query.tenantSlug);
  }

  return filters;
}

router.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email) throw new Error("email es obligatorio");
    if (!password) throw new Error("password es obligatoria");

    const adminUser = await authenticateAdminUser(email, password);
    if (!adminUser) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const token = createAdminToken(adminUser);
    return res.json({
      token,
      adminUser: normalizeJsonBigInts(adminUser),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo iniciar sesion" });
  }
});

router.post("/auth/logout", (_req, res) => {
  return res.status(204).send();
});

router.get("/me", requireAdminAuth, (req, res) => {
  return res.json(normalizeJsonBigInts(req.adminAuth.adminUser));
});

router.use(requireAdminAuth);

router.get("/dashboard", async (req, res) => {
  try {
    const filters = await buildAnalyticsFilters(req.query);
    const summary = await getAdminDashboardSummary(filters);
    return res.json(normalizeJsonBigInts({
      cards: buildDashboardCards(summary),
      summary,
    }));
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo obtener dashboard admin" });
  }
});

router.get("/reports/summary", async (req, res) => {
  try {
    const filters = await buildAnalyticsFilters(req.query);
    const summary = await getAdminReportsSummary(filters);
    return res.json(normalizeJsonBigInts(summary));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener resumen de reportes" });
  }
});

router.get("/reports/timeseries", async (req, res) => {
  try {
    const filters = await buildAnalyticsFilters(req.query);
    const series = await getAdminReportsTimeseries(filters);
    return res.json(normalizeJsonBigInts(series));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener serie temporal" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const payload = await listAdminPayments({
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
    const payload = await listAdminPaymentsForExport({
      status: req.query.status,
      provider: req.query.provider,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const csv = buildPaymentsCsv(payload.items, { includeTenant: true });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="payments-admin.csv"');
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
    const payment = await getAdminPaymentDetail(paymentId);

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
    const payment = await getAdminPaymentDetail(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const { payment: hydratedPayment, filePath } = await ensureInvoicePdfForPayment(payment.tenantId, paymentId);
    const filename = getInvoicePdfFilename(hydratedPayment);
    const asDownload = String(req.query.download || "false") === "true";

    if (asDownload) {
      return res.download(filePath, filename);
    }

    return res.sendFile(filePath, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el PDF" });
  }
});

router.post("/payments/:id/reprocess", async (req, res) => {
  try {
    const paymentId = toBigIntId(req.params.id, "paymentId");
    const payment = await getAdminPaymentDetail(paymentId);

    if (!payment) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const result = await reprocessPaymentAsAdmin(
      payment,
      req.adminAuth.adminUser,
      String(req.body.step || "auto").trim().toLowerCase()
    );

    return res.status(202).json(normalizeJsonBigInts({
      ok: true,
      paymentId,
      tenantId: payment.tenantId,
      ...result,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo solicitar reproceso" });
  }
});

router.get("/tenants", async (_req, res) => {
  try {
    const tenants = await listTenants();
    const items = tenants.map(summarizeTenantListItem);
    return res.json(normalizeJsonBigInts({
      items,
      total: items.length,
    }));
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudieron listar tenants" });
  }
});

router.post("/tenants", async (req, res) => {
  try {
    const tenant = await createTenant(validateTenantPayload(req.body));
    return res.status(201).json(normalizeJsonBigInts(tenant));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo crear tenant" });
  }
});

router.get("/tenants/:slug", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.slug);
    if (!tenant) return res.status(404).json({ error: "Tenant no encontrado" });

    const integrations = await listTenantIntegrations(tenant.id);
    const metrics = await getAdminTenantSummary(tenant.id);
    const notes = await listTenantNotes(tenant.id);
    return res.json(normalizeJsonBigInts(
      summarizeTenantDetail(tenant, integrations, metrics, notes)
    ));
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo obtener tenant" });
  }
});

router.get("/tenants/:slug/dashboard", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.slug);
    if (!tenant) return res.status(404).json({ error: "Tenant no encontrado" });

    const filters = await buildAnalyticsFilters({
      ...req.query,
      tenantSlug: req.params.slug,
    });
    const [summary, reportSummary, timeseries] = await Promise.all([
      getAdminDashboardSummary(filters),
      getAdminReportsSummary(filters),
      getAdminReportsTimeseries(filters),
    ]);

    return res.json(normalizeJsonBigInts({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
      },
      cards: buildDashboardCards(summary),
      summary,
      reports: {
        summary: reportSummary,
        timeseries,
      },
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener dashboard del tenant" });
  }
});

router.get("/tenants/:slug/payments", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const payload = await listAdminPayments({
      tenantId,
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
    return res.status(400).json({ error: error.message || "No se pudieron listar pagos del tenant" });
  }
});

router.get("/tenants/:slug/payments/export.csv", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const payload = await listAdminPaymentsForExport({
      tenantId,
      status: req.query.status,
      provider: req.query.provider,
      search: req.query.search,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    const csv = buildPaymentsCsv(payload.items, { includeTenant: true });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payments-${req.params.slug}.csv"`);
    res.setHeader("X-Export-Max-Rows", String(payload.exportInfo.maxRows));
    res.setHeader("X-Export-Truncated", String(payload.exportInfo.truncated));
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo exportar CSV del tenant" });
  }
});

router.get("/tenants/:slug/notes", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const notes = await listTenantNotes(tenantId);
    return res.json(normalizeJsonBigInts(notes));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar notas del tenant" });
  }
});

router.post("/tenants/:slug/notes", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const pinned = req.body.pinned !== undefined ? Boolean(req.body.pinned) : false;

    if (!title) throw new Error("title es obligatorio");
    if (!body) throw new Error("body es obligatorio");

    const note = await addTenantNote(tenantId, req.adminAuth.adminUser.id, { title, body, pinned });
    return res.status(201).json(normalizeJsonBigInts(note));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo crear nota del tenant" });
  }
});

router.patch("/tenants/:slug", async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.slug, validateTenantPayload(req.body, { partial: true }));
    return res.json(normalizeJsonBigInts(tenant));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo actualizar tenant" });
  }
});

router.get("/tenants/:slug/integrations", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const revealSecrets = String(req.query.revealSecrets || "false") === "true";
    const integrations = await listTenantIntegrations(tenantId, { revealSecrets });
    return res.json(normalizeJsonBigInts(integrations));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar integraciones" });
  }
});

router.put("/tenants/:slug/integrations/:provider", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const provider = validateProvider(req.params.provider);
    const enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : true;
    const config = validateIntegrationConfig(provider, req.body.config);

    const row = await replaceTenantIntegrationConfig(tenantId, provider, config, { enabled });
    return res.json(normalizeJsonBigInts({
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      enabled: row.enabled,
      config: maskSecrets(config),
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo guardar integracion" });
  }
});

router.get("/tenants/:slug/users", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const users = await listTenantUsers(tenantId);
    return res.json(normalizeJsonBigInts(users));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudieron listar usuarios del tenant" });
  }
});

router.put("/tenants/:slug/users", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = String(req.body.role || "").trim().toLowerCase();
    const password = req.body.password !== undefined ? String(req.body.password || "") : undefined;
    const status = req.body.status !== undefined ? String(req.body.status || "").trim().toUpperCase() : undefined;

    if (!email) throw new Error("email es obligatorio");
    if (!VALID_ROLES.has(role)) throw new Error("role invalido");
    if (status !== undefined && !VALID_TENANT_USER_STATUS.has(status)) throw new Error("status invalido");
    if (password !== undefined && password.length > 0 && password.length < 8) {
      throw new Error("password debe tener al menos 8 caracteres");
    }

    const user = await addOrUpdateTenantUserWithAuth(tenantId, { email, role, password, status });
    return res.json(normalizeJsonBigInts(user));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo guardar usuario del tenant" });
  }
});

export default router;
