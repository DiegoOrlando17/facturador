import { Prisma } from "@prisma/client";
import { createClient } from "redis";
import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "../config/index.js";
import { db } from "../models/db.js";
import { hydratePaymentWithInvoice } from "../models/Invoice.js";
import { normalizeAfipConfig } from "./afip.service.js";
import { normalizeMpConfig } from "./mercadopago.service.js";
import { decryptJson } from "../utils/crypto.js";
import { buildPaymentAttentionWhere, isPaymentAttentionState } from "../domain/paymentAttention.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10000;
const VALID_GRANULARITIES = new Set(["day", "week", "month"]);
const HEALTHCHECK_TIMEOUT_MS = 1200;
const EXTERNAL_HEALTHCHECK_TIMEOUT_MS = 3500;
const execFileAsync = promisify(execFile);
const WORKER_FILES = [
  "payment.worker.js",
  "invoice.worker.js",
  "retry.worker.js",
  "mercadopago.worker.js",
  "audit.worker.js",
];

const invoiceListInclude = {
  include: {
    documents: true,
  },
};

const invoiceDetailInclude = {
  include: {
    documents: true,
    events: {
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    },
  },
};

function normalizePage(value) {
  const current = Number(value || DEFAULT_PAGE);
  if (!Number.isFinite(current) || current < 1) return DEFAULT_PAGE;
  return Math.floor(current);
}

function normalizePageSize(value) {
  const current = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(current) || current < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(current), MAX_PAGE_SIZE);
}

function parseDateOrNull(value, { endOfDay = false } = {}) {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function buildPaymentWhere(filters = {}) {
  const where = {};

  if (filters.tenantId) {
    where.tenantId = filters.tenantId;
  }

  if (filters.status) {
    where.status = String(filters.status);
  }

  if (filters.provider) {
    where.provider = String(filters.provider);
  }

  if (filters.search) {
    const search = String(filters.search).trim();
    if (search) {
      where.OR = [
        { provider_payment_id: { contains: search, mode: "insensitive" } },
        { invoice: { is: { cbteNro: { contains: search, mode: "insensitive" } } } },
        { customer: { contains: search, mode: "insensitive" } },
        { customer_doc_number: { contains: search, mode: "insensitive" } },
        { tenant: { is: { name: { contains: search, mode: "insensitive" } } } },
        { tenant: { is: { slug: { contains: search, mode: "insensitive" } } } },
      ];
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};

    const from = parseDateOrNull(filters.dateFrom);
    const to = parseDateOrNull(filters.dateTo, { endOfDay: true });

    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  return where;
}

function buildAmountSummary(result = []) {
  return result.reduce((acc, row) => {
    const amount = Number(row._sum.amount || 0);
    acc.totalAmount += amount;
    acc.statuses[row.status] = {
      count: row._count._all,
      amount,
    };
    return acc;
  }, {
    totalAmount: 0,
    statuses: {},
  });
}

function buildSqlDateFilter(filters = {}) {
  const parts = [];

  if (filters.tenantId) {
    parts.push(Prisma.sql`AND p."tenantId" = ${filters.tenantId}`);
  }

  const from = parseDateOrNull(filters.dateFrom);
  if (from) {
    parts.push(Prisma.sql`AND COALESCE(p."date_approved", p."createdAt") >= ${from}`);
  }

  const to = parseDateOrNull(filters.dateTo, { endOfDay: true });
  if (to) {
    parts.push(Prisma.sql`AND COALESCE(p."date_approved", p."createdAt") <= ${to}`);
  }

  return Prisma.join(parts, Prisma.sql` `);
}

function normalizeSummaryFilters(filters = {}) {
  return {
    tenantId: filters.tenantId || null,
    tenantSlug: filters.tenantSlug || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
  };
}

function normalizeGranularity(value) {
  const current = String(value || "day").trim().toLowerCase();
  if (!VALID_GRANULARITIES.has(current)) {
    throw new Error("granularity invalida");
  }

  return current;
}

function withTimeout(promise, timeoutMs = HEALTHCHECK_TIMEOUT_MS) {
  let timer;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("healthcheck timeout")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function buildServiceHealth(name, status, detail = "") {
  return {
    name,
    status,
    detail,
  };
}

function receivedHttpResponse(status) {
  return status >= 100 && status < 600;
}

function parseSecretEnc(secretEnc) {
  if (!secretEnc) return {};

  try {
    return decryptJson(secretEnc);
  } catch {
    return {};
  }
}

async function getFirstConfiguredIntegration(provider) {
  const row = await db.tenantIntegration.findFirst({
    where: {
      provider,
      enabled: true,
      secretEnc: {
        not: null,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    select: { secretEnc: true },
  });

  return parseSecretEnc(row?.secretEnc);
}

async function getDatabaseHealth() {
  try {
    await withTimeout(db.$queryRaw`SELECT 1`);
    return buildServiceHealth("Database", "healthy", "Conexion disponible");
  } catch (error) {
    return buildServiceHealth("Database", "attention", error.message || "No responde");
  }
}

async function getRedisHealth() {
  if (!config.REDIS_URL) {
    return buildServiceHealth("Redis", "setup_pending", "REDIS_URL no configurado");
  }

  const client = createClient({ url: config.REDIS_URL });

  try {
    await withTimeout(client.connect());
    await withTimeout(client.ping());
    return buildServiceHealth("Redis", "healthy", "Conexion disponible");
  } catch (error) {
    return buildServiceHealth("Redis", "attention", error.message || "No responde");
  } finally {
    await client.disconnect().catch(() => null);
  }
}

async function getWorkersHealth() {
  if (config.ENABLE_WORKERS !== "true") {
    return buildServiceHealth("Workers", "setup_pending", "Workers deshabilitados");
  }

  try {
    const commandLines = await getProcessCommandLines();
    const runningWorkers = WORKER_FILES.filter((workerFile) =>
      commandLines.some((commandLine) => commandLine.includes(workerFile))
    );

    if (runningWorkers.length === WORKER_FILES.length) {
      return buildServiceHealth("Workers", "healthy", `${runningWorkers.length}/${WORKER_FILES.length} workers corriendo`);
    }

    return buildServiceHealth(
      "Workers",
      runningWorkers.length > 0 ? "attention" : "attention",
      `${runningWorkers.length}/${WORKER_FILES.length} workers corriendo`,
    );
  } catch (error) {
    return buildServiceHealth("Workers", "attention", error.message || "No se pudieron verificar procesos");
  }
}

async function getProcessCommandLines() {
  if (process.platform === "win32") {
    const { stdout } = await withTimeout(execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine",
    ], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }), 2500);

    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  const { stdout } = await withTimeout(execFileAsync("ps", ["-eo", "args"], {
    maxBuffer: 1024 * 1024,
  }), 2500);

  return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function getApiHealth() {
  const url = `http://127.0.0.1:${config.PORT}/health`;

  try {
    const response = await axios.get(url, {
      timeout: HEALTHCHECK_TIMEOUT_MS,
      validateStatus: () => true,
    });

    return buildServiceHealth(
      "Backend",
      response.status >= 200 && response.status < 300 ? "healthy" : "attention",
      `HTTP ${response.status}`,
    );
  } catch (error) {
    return buildServiceHealth("Backend", "attention", error.message || "No responde");
  }
}

async function getMercadoPagoApiHealth() {
  const tenantConfig = await getFirstConfiguredIntegration("MERCADOPAGO");
  const mpConfig = normalizeMpConfig(tenantConfig);
  const baseUrl = mpConfig.API_URL;

  if (!baseUrl) {
    return buildServiceHealth("Mercado Pago", "setup_pending", "API_URL no configurada");
  }

  const url = mpConfig.ACCESS_TOKEN ? `${baseUrl}/users/me` : baseUrl;

  try {
    const response = await axios.get(url, {
      headers: mpConfig.ACCESS_TOKEN ? { Authorization: `Bearer ${mpConfig.ACCESS_TOKEN}` } : undefined,
      timeout: EXTERNAL_HEALTHCHECK_TIMEOUT_MS,
      validateStatus: () => true,
    });

    return buildServiceHealth(
      "Mercado Pago",
      receivedHttpResponse(response.status) ? "healthy" : "attention",
      `HTTP ${response.status}`,
    );
  } catch (error) {
    return buildServiceHealth("Mercado Pago", "attention", error.message || "No responde");
  }
}

async function getAfipWebServiceHealth() {
  const tenantConfig = await getFirstConfiguredIntegration("AFIP");
  const afipConfig = normalizeAfipConfig(tenantConfig);
  const url = afipConfig.WSFE_URL || afipConfig.WSAA_URL;

  if (!url) {
    return buildServiceHealth("ARCA", "setup_pending", "WSFE_URL no configurada");
  }

  try {
    const response = await axios.get(url, {
      timeout: EXTERNAL_HEALTHCHECK_TIMEOUT_MS,
      validateStatus: () => true,
    });

    return buildServiceHealth(
      "ARCA",
      receivedHttpResponse(response.status) ? "healthy" : "attention",
      `HTTP ${response.status}`,
    );
  } catch (error) {
    return buildServiceHealth("ARCA", "attention", error.message || "No responde");
  }
}

async function buildOperationalServices() {
  const [workers, redis, database, api, mercadopago, afip] = await Promise.all([
    getWorkersHealth(),
    getRedisHealth(),
    getDatabaseHealth(),
    getApiHealth(),
    getMercadoPagoApiHealth(),
    getAfipWebServiceHealth(),
  ]);

  return [
    workers,
    redis,
    database,
    api,
    mercadopago,
    afip,
  ];
}

function getPaymentEventPresentation(event) {
  const provider = event.payment?.provider || "";
  const cbte = event.payment?.invoice?.cbteNro ? ` ${event.payment.invoice.cbteNro}` : "";

  switch (event.type) {
    case "payment_detected":
    case "payment_updated":
      return {
        icon: provider.toUpperCase() === "MERCADOPAGO" ? "mp" : "invoice",
        title: `Pago detectado por ${provider || "proveedor"}`,
      };
    case "afip_ok":
      return {
        icon: "afip",
        title: `Factura${cbte} emitida`,
      };
    case "pdf_ok":
      return {
        icon: "invoice",
        title: "PDF generado correctamente",
      };
    case "drive_ok":
      return {
        icon: "drive",
        title: "Comprobante subido a Google Drive",
      };
    case "sheets_ok":
      return {
        icon: "sheets",
        title: "Registro agregado a Google Sheets",
      };
    case "failed":
      return {
        icon: "alert",
        title: event.message || "Error operativo registrado",
      };
    default:
      return {
        icon: "invoice",
        title: event.message || "Actividad registrada",
      };
  }
}

async function listRecentActivity() {
  const [paymentEvents, payments, auditLogs, tenants] = await Promise.all([
    db.paymentEvent.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
        payment: {
          select: {
            id: true,
            provider: true,
            invoice: {
              select: { cbteNro: true },
            },
          },
        },
      },
    }),
    db.payment.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
      },
    }),
    db.tenantAuditLog.findMany({
      where: {
        tenantId: {
          not: null,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
      },
    }),
    db.tenant.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: { id: true, slug: true, name: true, createdAt: true },
    }),
  ]);

  const activity = [
    ...paymentEvents.map((event) => {
      const presentation = getPaymentEventPresentation(event);

      return {
        id: `payment-event-${event.id}`,
        type: event.type,
        ...presentation,
        tenant: event.tenant,
        paymentId: event.paymentId,
        createdAt: event.createdAt,
      };
    }),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      type: payment.status,
      icon: isPaymentAttentionState(payment.status, payment.error) ? "alert" : payment.provider === "MERCADOPAGO" ? "mp" : "invoice",
      title: isPaymentAttentionState(payment.status, payment.error)
        ? payment.error || "Pago con error"
        : `Pago ${payment.status} por ${payment.provider}`,
      tenant: payment.tenant,
      paymentId: payment.id,
      createdAt: payment.updatedAt || payment.createdAt,
    })),
    ...auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      type: log.action,
      icon: "clients",
      title: log.action === "tenant_profile_approved"
        ? "Datos del cliente aprobados"
        : log.action === "tenant_profile_rejected"
          ? "Datos del cliente rechazados"
          : "Actividad administrativa del cliente",
      tenant: log.tenant,
      createdAt: log.createdAt,
    })),
    ...tenants.map((tenant) => ({
      id: `tenant-created-${tenant.id}`,
      type: "tenant_created",
      icon: "clients",
      title: "Cliente creado",
      tenant,
      createdAt: tenant.createdAt,
    })),
  ];

  return activity
    .filter((item) => item.createdAt)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 8);
}

async function buildProviderOperationalHealth(provider, totalTenants) {
  const [enabledCount, configuredCount, needsAttentionCount] = await Promise.all([
    db.tenantIntegration.count({
      where: {
        provider,
        enabled: true,
      },
    }),
    db.tenantIntegration.count({
      where: {
        provider,
        enabled: true,
        secretEnc: {
          not: null,
        },
      },
    }),
    db.tenantIntegration.count({
      where: {
        provider,
        enabled: true,
        secretEnc: null,
      },
    }),
  ]);

  const missingCount = Math.max(totalTenants - enabledCount, 0);
  const status = needsAttentionCount > 0
    ? "attention"
    : configuredCount > 0
      ? "healthy"
      : "setup_pending";

  return {
    provider,
    status,
    enabledCount,
    configuredCount,
    needsAttentionCount,
    missingCount,
  };
}

function buildAttentionItem(type, tenant, detail = {}) {
  const base = {
    id: `${type}-${tenant.id}${detail.id ? `-${detail.id}` : ""}`,
    type,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    },
  };

  if (type === "onboarding_pending") {
    return {
      ...base,
      title: "Alta pendiente de aprobacion",
      detail: "El cliente envio datos para revisar antes de operar.",
      priority: "warning",
      actionLabel: "Revisar alta",
      actionPath: `/tenants/${tenant.slug}#tenant-onboarding`,
      createdAt: detail.createdAt,
    };
  }

  if (type === "integration_attention") {
    return {
      ...base,
      title: `${detail.provider} necesita configuracion`,
      detail: "Hay una integracion habilitada sin credenciales completas.",
      priority: "warning",
      actionLabel: "Configurar",
      actionPath: `/tenants/${tenant.slug}#tenant-integrations`,
      createdAt: detail.updatedAt,
    };
  }

  if (type === "profile_incomplete") {
    return {
      ...base,
      title: "Datos del cliente incompletos",
      detail: "Faltan datos fiscales o de contacto necesarios para operar.",
      priority: "warning",
      actionLabel: "Completar datos",
      actionPath: `/tenants/${tenant.slug}#tenant-profile`,
      createdAt: tenant.updatedAt,
    };
  }

  if (type === "profile_pending") {
    return {
      ...base,
      title: "Datos del cliente pendientes de aprobacion",
      detail: "El perfil fiscal esta completo y espera revision interna.",
      priority: "warning",
      actionLabel: "Aprobar datos",
      actionPath: `/tenants/${tenant.slug}#tenant-profile`,
      createdAt: detail.updatedAt || tenant.updatedAt,
    };
  }

  return {
    ...base,
    title: "Pago fallido",
    detail: detail.error || "Un pago requiere revision manual.",
    priority: "danger",
    actionLabel: "Ver pago",
    actionPath: `/payments/${detail.id}`,
    createdAt: detail.updatedAt,
  };
}

async function listAttentionItems() {
  const [pendingOnboarding, pendingProfiles, integrationsWithAttention, failedPayments] = await Promise.all([
    db.tenantOnboardingSubmission.findMany({
      where: { status: "pending" },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
      },
    }),
    db.tenantProfile.findMany({
      where: {
        approvalStatus: "PENDING",
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true, updatedAt: true },
        },
      },
    }),
    db.tenantIntegration.findMany({
      where: {
        enabled: true,
        secretEnc: null,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
      },
    }),
    db.payment.findMany({
      where: buildPaymentAttentionWhere(),
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      include: {
        tenant: {
          select: { id: true, slug: true, name: true },
        },
      },
    }),
  ]);

  return [
    ...pendingOnboarding.map((item) =>
      buildAttentionItem("onboarding_pending", item.tenant, {
        id: item.id,
        createdAt: item.createdAt,
      })
    ),
    ...pendingProfiles.map((profile) =>
      buildAttentionItem("profile_pending", profile.tenant, {
        id: profile.id,
        updatedAt: profile.updatedAt,
      })
    ),
    ...integrationsWithAttention.map((item) =>
      buildAttentionItem("integration_attention", item.tenant, {
        id: item.id,
        provider: item.provider,
        updatedAt: item.updatedAt,
      })
    ),
    ...failedPayments.map((item) =>
      buildAttentionItem("payment_failed", item.tenant, {
        id: item.id,
        error: item.error,
        updatedAt: item.updatedAt,
      })
    ),
  ]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 8);
}

export async function getAdminDashboardSummary(filters = {}) {
  const paymentWhere = buildPaymentWhere(filters);
  const [tenantCount, activeTenantCount] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { status: "ACTIVE" } }),
  ]);

  const [
    pendingApprovalTenants,
    paymentCount,
    pendingCount,
    failedCount,
    completeCount,
    tenantsWithAlerts,
    paymentsByStatus,
    mercadopagoHealth,
    afipHealth,
    attentionItems,
    recentActivity,
  ] = await Promise.all([
    db.tenantOnboardingSubmission.groupBy({
      by: ["tenantId"],
      where: {
        status: "pending",
      },
    }),
    db.payment.count({ where: paymentWhere }),
    db.payment.count({
      where: {
        ...paymentWhere,
        status: {
          in: ["pending", "processing", "afip_pending", "pdf_pending", "drive_pending", "sheets_pending"],
        },
      },
    }),
    db.payment.count({ where: { ...paymentWhere, ...buildPaymentAttentionWhere() } }),
    db.payment.count({ where: { ...paymentWhere, status: "complete" } }),
    db.tenant.count({
      where: {
        OR: [
          {
            onboardingSubmissions: {
              some: {
                status: "pending",
              },
            },
          },
          {
            payments: {
              some: buildPaymentAttentionWhere(),
            },
          },
          {
            profile: {
              is: { approvalStatus: "PENDING" },
            },
          },
          {
            integrations: {
              some: {
                enabled: true,
                secretEnc: null,
              },
            },
          },
        ],
      },
    }),
    db.payment.groupBy({
      by: ["status"],
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    buildProviderOperationalHealth("MERCADOPAGO", tenantCount),
    buildProviderOperationalHealth("AFIP", tenantCount),
    listAttentionItems(),
    listRecentActivity(),
  ]);

  const operationalServices = await buildOperationalServices();

  return {
    tenants: {
      total: tenantCount,
      active: activeTenantCount,
      pendingApproval: pendingApprovalTenants.length,
      withErrors: tenantsWithAlerts,
      withAlerts: tenantsWithAlerts,
    },
    payments: {
      total: paymentCount,
      pending: pendingCount,
      failed: failedCount,
      complete: completeCount,
      ...buildAmountSummary(paymentsByStatus),
    },
    systemHealth: {
      internal: {
        provider: "FACTURADOR",
        status: "healthy",
        detail: "API interna disponible",
      },
      mercadopago: mercadopagoHealth,
      afip: afipHealth,
    },
    operationalServices,
    attentionItems,
    filters: normalizeSummaryFilters(filters),
    recentActivity,
    recentPayments: [],
  };
}

export async function listAdminPayments(filters = {}) {
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const where = buildPaymentWhere(filters);

  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        invoice: invoiceListInclude,
      },
    }),
    db.payment.count({ where }),
  ]);

  return {
    items: items.map(hydratePaymentWithInvoice),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filters: {
      tenantId: filters.tenantId ? String(filters.tenantId) : null,
      status: filters.status || null,
      provider: filters.provider || null,
      search: filters.search || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    },
  };
}

export async function listAdminPaymentsForExport(filters = {}) {
  const where = buildPaymentWhere(filters);

  const items = await db.payment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: MAX_EXPORT_ROWS,
    include: {
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      invoice: invoiceListInclude,
    },
  });

  return {
    items: items.map(hydratePaymentWithInvoice),
    exportInfo: {
      maxRows: MAX_EXPORT_ROWS,
      truncated: items.length >= MAX_EXPORT_ROWS,
    },
    filters: {
      tenantId: filters.tenantId ? String(filters.tenantId) : null,
      status: filters.status || null,
      provider: filters.provider || null,
      search: filters.search || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    },
  };
}

export async function getAdminTenantSummary(tenantId) {
  const [
    totalPayments,
    paymentsByStatus,
    recentPayments,
    latestFailedPayment,
  ] = await Promise.all([
    db.payment.count({ where: { tenantId } }),
    db.payment.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.payment.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      include: {
        invoice: invoiceListInclude,
      },
    }),
    db.payment.findFirst({
      where: {
        tenantId,
        status: "failed",
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        invoice: invoiceListInclude,
      },
    }),
  ]);

  return {
    totalPayments,
    latestFailedPayment: hydratePaymentWithInvoice(latestFailedPayment),
    recentPayments: recentPayments.map(hydratePaymentWithInvoice),
    ...buildAmountSummary(paymentsByStatus),
  };
}

export async function getAdminReportsSummary(filters = {}) {
  const paymentWhere = buildPaymentWhere(filters);
  const sqlDateFilter = buildSqlDateFilter(filters);

  const [aggregate, byStatus, topTenants] = await Promise.all([
    db.payment.aggregate({
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
      _avg: { amount: true },
    }),
    db.payment.groupBy({
      by: ["status"],
      where: paymentWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    db.$queryRaw`
      SELECT
        t."id",
        t."slug",
        t."name",
        COUNT(*)::int AS "paymentsCount",
        COALESCE(SUM(p."amount"), 0)::float8 AS "totalAmount"
      FROM "Payment" p
      INNER JOIN "Tenant" t ON t."id" = p."tenantId"
      WHERE 1 = 1
      ${sqlDateFilter}
      GROUP BY t."id", t."slug", t."name"
      ORDER BY "totalAmount" DESC, "paymentsCount" DESC
      LIMIT 10
    `,
  ]);

  return {
    filters: normalizeSummaryFilters(filters),
    totals: {
      paymentsCount: aggregate._count._all,
      totalAmount: Number(aggregate._sum.amount || 0),
      avgTicket: Number(aggregate._avg.amount || 0),
    },
    byStatus: buildAmountSummary(byStatus).statuses,
    topTenants,
  };
}

export async function getAdminReportsTimeseries(filters = {}) {
  const granularity = normalizeGranularity(filters.granularity);
  const sqlDateFilter = buildSqlDateFilter(filters);
  const bucket = Prisma.raw(`date_trunc('${granularity}', COALESCE(p."date_approved", p."createdAt"))`);

  const rows = await db.$queryRaw`
    SELECT
      ${bucket} AS "bucketStart",
      COUNT(*)::int AS "paymentsCount",
      COALESCE(SUM(p."amount"), 0)::float8 AS "totalAmount"
    FROM "Payment" p
    WHERE 1 = 1
    ${sqlDateFilter}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return {
    filters: {
      ...normalizeSummaryFilters(filters),
      granularity,
    },
    series: rows,
  };
}

export async function getAdminPaymentDetail(paymentId, tenantId = null) {
  const include = {
    tenant: {
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
        },
      },
    },
    events: {
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    },
    invoice: invoiceDetailInclude,
  };

  let payment;
  if (tenantId !== null && tenantId !== undefined) {
    payment = await db.payment.findUnique({
      where: { id_tenantId: { id: paymentId, tenantId } },
      include,
    });
  } else {
    payment = await db.payment.findFirst({
      where: { id: paymentId },
      include,
    });
  }

  return hydratePaymentWithInvoice(payment);
}
