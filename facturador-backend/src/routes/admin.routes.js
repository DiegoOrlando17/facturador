import { Router } from "express";
import crypto from "crypto";
import { assertAdminPermission, requireAdminAuth, requireAdminPermission } from "../middlewares/adminAuth.middleware.js";
import { ADMIN_PERMISSIONS } from "../domain/permissions.js";
import {
  authenticateAdminUser,
  createManagedAdminUser,
  listAdminUsers,
  updateManagedAdminUser,
  updateOwnAdminProfile,
} from "../services/adminUser.service.js";
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
import { generateInvoicePdfForPayment, getInvoicePdfFilename } from "../services/invoicePdf.service.js";
import { buildPaymentsCsv } from "../services/csvExport.service.js";
import {
  addOrUpdateTenantUserWithAuth,
  createTenant,
  deleteTenantWithData,
  getTenantBySlug,
  getTenantIntegrationConfig,
  listTenantIntegrations,
  listTenantUsers,
  listTenants,
  replaceTenantIntegrationConfig,
  resolveTenantIdBySlug,
  reviewTenantProfile,
  tryGetTenantIntegrationConfig,
  upsertTenantProfile,
  upsertTenantSubscription,
  updateTenant,
} from "../services/tenantConfig.service.js";
import {
  addTenantNote,
  deliverPaymentToGoogleAsAdmin,
  listTenantNotes,
  reprocessPaymentAsAdmin,
} from "../services/tenantSupport.service.js";
import {
  approveTenantOnboardingSubmission,
  getTenantOnboardingSubmission,
  listTenantOnboardingSubmissions,
  rejectTenantOnboardingSubmission,
} from "../services/tenantOnboarding.service.js";
import { startMercadopagoProcessingFromDate } from "../services/mercadopagoBackfill.service.js";
import { testIntegrationConnection } from "../services/integrationTest.service.js";
import { createPlan, listPlans, updatePlan } from "../services/settings.service.js";
import { createAdminToken } from "../utils/adminToken.js";
import { maskSecrets } from "../utils/crypto.js";
import { toBigIntId } from "../utils/bigint.js";
import { normalizeTenantSchedule } from "../domain/tenantScheduler.js";
import { getTenantSubscriptionPolicy } from "../services/subscriptionPolicy.service.js";
import { buildTenantGoogleAuthUrl, mergeGoogleTenantIntegrationConfig } from "../services/tenantGoogle.service.js";
import { createAdminPaymentActionsRouter } from "./adminPaymentActions.routes.js";

const router = Router();

const VALID_PROVIDERS = new Set(["MERCADOPAGO", "AFIP", "DRIVE", "SHEETS"]);
const VALID_TENANT_STATUS = new Set(["ACTIVE", "DISABLED"]);
const VALID_ROLES = new Set(["owner", "admin", "viewer", "approver"]);
const VALID_TENANT_USER_STATUS = new Set(["ACTIVE", "DISABLED"]);

function normalizeJsonBigInts(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
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
    if (!current.REFRESH_TOKEN) throw new Error("Conecta Google por OAuth antes de guardar o probar Drive");
  }

  if (provider === "SHEETS") {
    if (!current.REFRESH_TOKEN) throw new Error("Conecta Google por OAuth antes de guardar o probar Sheets");
  }

  return current;
}

async function resolveGoogleManagedIntegrationConfig(tenantId, provider, submittedConfig) {
  if (provider !== "DRIVE" && provider !== "SHEETS") {
    return validateIntegrationConfig(provider, submittedConfig);
  }

  const existing = await tryGetTenantIntegrationConfig(tenantId, provider);
  const submitted = submittedConfig && typeof submittedConfig === "object" && !Array.isArray(submittedConfig)
    ? submittedConfig
    : {};
  const config = mergeGoogleTenantIntegrationConfig(provider, existing, submitted);
  return validateIntegrationConfig(provider, config);
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

router.use(createAdminPaymentActionsRouter({
  requireAdminPermission,
  getAdminPaymentDetail,
  reprocessPaymentAsAdmin,
  deliverPaymentToGoogleAsAdmin,
}));

router.patch("/me", async (req, res) => {
  try {
    const adminUser = await updateOwnAdminProfile(req.adminAuth.adminUser.id, {
      name: req.body.name,
      email: req.body.email,
    });

    return res.json(normalizeJsonBigInts(adminUser));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo actualizar tu perfil" });
  }
});

router.get("/users", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_ADMINS), async (req, res) => {
  try {
    const users = await listAdminUsers();
    return res.json(normalizeJsonBigInts({
      items: users,
      total: users.length,
    }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "No se pudieron listar usuarios internos" });
  }
});

router.post("/users", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_ADMINS), async (req, res) => {
  try {
    const user = await createManagedAdminUser({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      status: req.body.status,
    });

    return res.status(201).json(normalizeJsonBigInts(user));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo crear usuario interno" });
  }
});

router.patch("/users/:id", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_ADMINS), async (req, res) => {
  try {
    const user = await updateManagedAdminUser(req.params.id, {
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      status: req.body.status,
    });

    return res.json(normalizeJsonBigInts(user));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo actualizar usuario interno" });
  }
});

router.get("/settings/plans", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_PLANS), async (req, res) => {
  try {
    const plans = await listPlans();
    return res.json(normalizeJsonBigInts({
      items: plans,
      total: plans.length,
    }));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "No se pudieron listar planes" });
  }
});

router.post("/settings/plans", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_PLANS), async (req, res) => {
  try {
    const plan = await createPlan(req.body);
    return res.status(201).json(normalizeJsonBigInts(plan));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo crear plan" });
  }
});

router.patch("/settings/plans/:id", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_PLANS), async (req, res) => {
  try {
    const plan = await updatePlan(req.params.id, req.body);
    return res.json(normalizeJsonBigInts(plan));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo actualizar plan" });
  }
});

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

    const { payment: hydratedPayment, pdfBuffer } = await generateInvoicePdfForPayment(payment.tenantId, paymentId);
    const filename = getInvoicePdfFilename(hydratedPayment);
    const asDownload = String(req.query.download || "false") === "true";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${asDownload ? "attachment" : "inline"}; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo obtener el PDF" });
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

router.post("/tenants", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
  try {
    const integrations = req.body.integrations && typeof req.body.integrations === "object"
      ? req.body.integrations
      : {};
    const normalizedIntegrations = Object.entries(integrations).map(([providerKey, rawConfig]) => {
      const provider = validateProvider(providerKey);
      return [provider, validateIntegrationConfig(provider, rawConfig)];
    });

    const tenant = await createTenant(validateTenantPayload(req.body));
    const configuredIntegrations = [];
    let ownerUser = null;
    let mercadopagoStart = null;

    for (const [provider, config] of normalizedIntegrations) {
      const row = await replaceTenantIntegrationConfig(tenant.id, provider, config, { enabled: true });
      configuredIntegrations.push({
        id: row.id,
        provider,
        enabled: row.enabled,
        config: maskSecrets(config),
      });
    }

    if (req.body.ownerUser) {
      const email = String(req.body.ownerUser.email || "").trim().toLowerCase();
      const password = req.body.ownerUser.password !== undefined
        ? String(req.body.ownerUser.password || "")
        : undefined;

      if (!email) throw new Error("ownerUser.email es obligatorio");
      if (password !== undefined && password.length > 0 && password.length < 8) {
        throw new Error("ownerUser.password debe tener al menos 8 caracteres");
      }

      ownerUser = await addOrUpdateTenantUserWithAuth(tenant.id, {
        email,
        role: "owner",
        password,
        status: "ACTIVE",
      });
    }

    const mpEntry = normalizedIntegrations.find(([provider]) => provider === "MERCADOPAGO");
    if (mpEntry && req.body.processingStartDate) {
      const [, mpConfig] = mpEntry;
      mercadopagoStart = await startMercadopagoProcessingFromDate(
        tenant.id,
        req.body.processingStartDate,
        mpConfig
      );
      await replaceTenantIntegrationConfig(
        tenant.id,
        "MERCADOPAGO",
        {
          ...mpConfig,
          PROCESSING_START_DATE: req.body.processingStartDate,
        },
        { enabled: true }
      );
    }

    return res.status(201).json(normalizeJsonBigInts({
      tenant,
      ownerUser,
      integrations: configuredIntegrations,
      mercadopagoStart,
    }));
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

router.post("/tenants/:slug/notes", requireAdminPermission(ADMIN_PERMISSIONS.OPERATE), async (req, res) => {
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

router.patch("/tenants/:slug", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.slug, validateTenantPayload(req.body, { partial: true }));
    return res.json(normalizeJsonBigInts(tenant));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo actualizar tenant" });
  }
});

router.put("/tenants/:slug/profile", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const profile = await upsertTenantProfile(tenantId, req.body);
    return res.json(normalizeJsonBigInts(profile));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo guardar perfil del tenant" });
  }
});

router.post("/tenants/:slug/profile/review", requireAdminPermission(ADMIN_PERMISSIONS.OPERATE), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const profile = await reviewTenantProfile(tenantId, req.adminAuth.adminUser, {
      status: req.body.status,
      reviewNotes: req.body.reviewNotes,
    });
    return res.json(normalizeJsonBigInts(profile));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo revisar perfil del tenant" });
  }
});

router.put("/tenants/:slug/subscription", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_SUBSCRIPTIONS), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const subscription = await upsertTenantSubscription(tenantId, req.body);
    return res.json(normalizeJsonBigInts(subscription));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo guardar suscripcion del tenant" });
  }
});

router.delete("/tenants/:slug", requireAdminPermission(ADMIN_PERMISSIONS.DELETE_TENANT), async (req, res) => {
  try {
    const deleteLocalFiles = String(req.query.deleteLocalFiles || "true") !== "false";
    const result = await deleteTenantWithData(req.params.slug, { deleteLocalFiles });

    if (!result) {
      return res.status(404).json({ error: "Tenant no encontrado" });
    }

    return res.json(normalizeJsonBigInts({
      ok: true,
      ...result,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo eliminar tenant" });
  }
});

router.get("/tenants/:slug/integrations", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const revealSecrets = String(req.query.revealSecrets || "false") === "true";
    if (revealSecrets) assertAdminPermission(req, ADMIN_PERMISSIONS.REVEAL_SECRETS);
    const integrations = await listTenantIntegrations(tenantId, { revealSecrets });
    return res.json(normalizeJsonBigInts(integrations));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudieron listar integraciones" });
  }
});

router.post("/tenants/:slug/integrations/google/oauth-url", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const [drive, sheets] = await Promise.all([
      tryGetTenantIntegrationConfig(tenantId, "DRIVE"),
      tryGetTenantIntegrationConfig(tenantId, "SHEETS"),
    ]);
    const flowId = crypto.randomUUID();
    const authUrl = buildTenantGoogleAuthUrl({
      tenantSlug: req.params.slug,
      flowId,
      driveFolderId: drive?.DRIVE_FOLDER_ID ?? null,
      sheetsId: sheets?.SHEETS_ID ?? null,
      sheetName: sheets?.SHEET_NAME ?? "Hoja1",
    });

    return res.json({ authUrl, flowId });
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo iniciar OAuth Google" });
  }
});

router.post("/tenants/:slug/integrations/mercadopago/start", requireAdminPermission(ADMIN_PERMISSIONS.OPERATE), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const processingStartDate = req.body.processingStartDate || req.body.startDate;
    const mpCfg = await getTenantIntegrationConfig(tenantId, "MERCADOPAGO");
    const result = await startMercadopagoProcessingFromDate(tenantId, processingStartDate, mpCfg);
    return res.status(202).json(normalizeJsonBigInts({
      ok: true,
      tenantId,
      ...result,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo iniciar procesamiento MP" });
  }
});

router.put("/tenants/:slug/integrations/:provider", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const provider = validateProvider(req.params.provider);
    const enabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : true;
    const config = await resolveGoogleManagedIntegrationConfig(tenantId, provider, req.body.config);
    if (provider === "MERCADOPAGO") {
      const subscription = await getTenantSubscriptionPolicy(tenantId);
      normalizeTenantSchedule(config, subscription?.policy);
    }

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

router.post("/tenants/:slug/integrations/:provider/test", requireAdminPermission(ADMIN_PERMISSIONS.OPERATE), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const provider = validateProvider(req.params.provider);
    const config = req.body?.config !== undefined
      ? await resolveGoogleManagedIntegrationConfig(tenantId, provider, req.body.config)
      : await getTenantIntegrationConfig(tenantId, provider);
    const result = await testIntegrationConnection(provider, config);

    return res.json(normalizeJsonBigInts({
      tenantId,
      testedUnsavedConfig: req.body?.config !== undefined,
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

router.get("/tenants/:slug/onboarding", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const revealSecrets = String(req.query.revealSecrets || "false") === "true";
    if (revealSecrets) assertAdminPermission(req, ADMIN_PERMISSIONS.REVEAL_SECRETS);
    const items = await listTenantOnboardingSubmissions(tenantId, {
      status: req.query.status,
      revealSecrets,
    });
    return res.json(normalizeJsonBigInts({
      items,
      total: items.length,
    }));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo listar onboarding" });
  }
});

router.get("/tenants/:slug/onboarding/:submissionId", async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const submissionId = toBigIntId(req.params.submissionId, "submissionId");
    const revealSecrets = String(req.query.revealSecrets || "false") === "true";
    if (revealSecrets) assertAdminPermission(req, ADMIN_PERMISSIONS.REVEAL_SECRETS);
    const item = await getTenantOnboardingSubmission(tenantId, submissionId, { revealSecrets });

    if (!item) return res.status(404).json({ error: "Onboarding no encontrado" });
    return res.json(normalizeJsonBigInts(item));
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || "No se pudo obtener onboarding" });
  }
});

router.post("/tenants/:slug/onboarding/:submissionId/approve", requireAdminPermission(ADMIN_PERMISSIONS.OPERATE), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const submissionId = toBigIntId(req.params.submissionId, "submissionId");
    const result = await approveTenantOnboardingSubmission(tenantId, submissionId, req.adminAuth.adminUser, {
      reviewNotes: req.body.reviewNotes,
      processingStartDate: req.body.processingStartDate,
      enableProcessing: req.body.enableProcessing !== undefined ? Boolean(req.body.enableProcessing) : true,
    });

    return res.status(202).json(normalizeJsonBigInts({
      ok: true,
      tenantId,
      ...result,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo aprobar onboarding" });
  }
});

router.post("/tenants/:slug/onboarding/:submissionId/reject", requireAdminPermission(ADMIN_PERMISSIONS.OPERATE), async (req, res) => {
  try {
    const tenantId = await resolveTenantIdBySlug(req.params.slug);
    const submissionId = toBigIntId(req.params.submissionId, "submissionId");
    const submission = await rejectTenantOnboardingSubmission(tenantId, submissionId, req.adminAuth.adminUser, {
      reviewNotes: req.body.reviewNotes,
    });

    return res.json(normalizeJsonBigInts({
      ok: true,
      tenantId,
      submission,
    }));
  } catch (error) {
    return res.status(400).json({ error: error.message || "No se pudo rechazar onboarding" });
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

router.put("/tenants/:slug/users", requireAdminPermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
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
