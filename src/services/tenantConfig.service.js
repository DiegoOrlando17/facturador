import { PrismaClient } from "@prisma/client";
import { decryptJson, encryptJson, maskSecrets } from "../utils/crypto.js";
import { hashPassword } from "../utils/password.js";
import { createTenantAuditLog } from "./tenantSupport.service.js";

const prisma = new PrismaClient();

const tenantIdCache = new Map();
const integrationCache = new Map();

function integrationCacheKey(tenantId, provider) {
  return `${tenantId}:${provider}`;
}

function parseSecretEnc(secretEnc) {
  if (!secretEnc) return {};
  return decryptJson(secretEnc);
}

function serializeSecretEnc(value) {
  return encryptJson(value ?? {});
}

function normalizeProvider(provider) {
  return String(provider || "").toUpperCase();
}

export async function resolveTenantIdBySlug(slug) {
  if (!slug) throw new Error("resolveTenantIdBySlug: slug vacio");

  if (tenantIdCache.has(slug)) return tenantIdCache.get(slug);

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant no encontrado: ${slug}`);

  tenantIdCache.set(slug, tenant.id);
  return tenant.id;
}

export async function getTenantBySlug(slug) {
  return prisma.tenant.findUnique({
    where: { slug },
    include: {
      profile: true,
      users: {
        orderBy: [{ role: "asc" }, { email: "asc" }],
      },
      subscriptions: {
        include: {
          plan: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: [{ createdAt: "asc" }],
    include: {
      profile: true,
      integrations: {
        orderBy: { provider: "asc" },
        select: {
          id: true,
          tenantId: true,
          provider: true,
          enabled: true,
          secretEnc: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      users: {
        orderBy: [{ role: "asc" }, { email: "asc" }],
      },
      subscriptions: {
        include: {
          plan: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
    },
  });
}

export async function createTenant({ name, slug, status = "ACTIVE" }) {
  const tenant = await prisma.tenant.create({
    data: { name, slug, status },
  });
  tenantIdCache.set(tenant.slug, tenant.id);
  return tenant;
}

export async function updateTenant(slug, data) {
  const tenant = await prisma.tenant.update({
    where: { slug },
    data,
  });
  tenantIdCache.set(tenant.slug, tenant.id);
  return tenant;
}

function normalizeProfilePayload(body = {}) {
  return {
    legalName: String(body.legalName || "").trim() || null,
    tradeName: String(body.tradeName || "").trim() || null,
    cuit: String(body.cuit || "").replace(/\D/g, "") || null,
    ivaCondition: String(body.ivaCondition || "").trim() || null,
    fiscalAddress: String(body.fiscalAddress || "").trim() || null,
    contactEmail: String(body.contactEmail || "").trim().toLowerCase() || null,
    contactPhone: String(body.contactPhone || "").trim() || null,
    responsibleName: String(body.responsibleName || "").trim() || null,
    responsibleEmail: String(body.responsibleEmail || "").trim().toLowerCase() || null,
  };
}

function isProfileDataComplete(data = {}) {
  return Boolean(
    data.legalName
      && data.cuit
      && data.ivaCondition
      && data.fiscalAddress
      && data.contactEmail
  );
}

export async function getTenantProfile(tenantId) {
  return prisma.tenantProfile.findUnique({
    where: { tenantId },
  });
}

export async function upsertTenantProfile(tenantId, body = {}) {
  const data = normalizeProfilePayload(body);
  const approvalStatus = isProfileDataComplete(data) ? "PENDING" : "DRAFT";

  return prisma.tenantProfile.upsert({
    where: { tenantId },
    update: {
      ...data,
      approvalStatus,
      reviewedByAdminUserId: null,
      reviewNotes: null,
      reviewedAt: null,
    },
    create: {
      tenantId,
      ...data,
      approvalStatus,
    },
  });
}

export async function reviewTenantProfile(tenantId, adminUser, { status, reviewNotes = null } = {}) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalizedStatus)) {
    throw new Error("status de revision invalido");
  }

  const current = await prisma.tenantProfile.findUnique({
    where: { tenantId },
  });

  if (!current) {
    throw new Error("Perfil del tenant no encontrado");
  }

  if (normalizedStatus === "APPROVED" && !isProfileDataComplete(current)) {
    throw new Error("No se puede aprobar un perfil incompleto");
  }

  const updated = await prisma.tenantProfile.update({
    where: { tenantId },
    data: {
      approvalStatus: normalizedStatus,
      reviewedByAdminUserId: BigInt(adminUser.id),
      reviewNotes: String(reviewNotes || "").trim() || null,
      reviewedAt: new Date(),
    },
  });

  await createTenantAuditLog({
    tenantId,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: normalizedStatus === "APPROVED" ? "tenant_profile_approved" : "tenant_profile_rejected",
    entityType: "TenantProfile",
    entityId: String(updated.id),
    before: {
      approvalStatus: current.approvalStatus,
      reviewNotes: current.reviewNotes,
    },
    after: {
      approvalStatus: updated.approvalStatus,
      reviewNotes: updated.reviewNotes,
    },
  });

  return updated;
}

const VALID_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "PAST_DUE", "CANCELED"]);

function normalizeSubscriptionPayload(body = {}) {
  let planId;
  try {
    planId = BigInt(body.planId);
  } catch {
    throw new Error("planId invalido");
  }

  const status = String(body.status || "ACTIVE").trim().toUpperCase();

  if (!VALID_SUBSCRIPTION_STATUSES.has(status)) {
    throw new Error("status de suscripcion invalido");
  }

  return {
    planId,
    status,
    billingProvider: String(body.billingProvider || "").trim() || null,
    billingRef: String(body.billingRef || "").trim() || null,
  };
}

export async function upsertTenantSubscription(tenantId, body = {}) {
  if (!body.planId) {
    throw new Error("planId es obligatorio");
  }

  const data = normalizeSubscriptionPayload(body);
  const plan = await prisma.plan.findUnique({
    where: { id: data.planId },
  });

  if (!plan) {
    throw new Error("Plan no encontrado");
  }

  const currentSubscription = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: [{ createdAt: "desc" }],
  });

  const subscription = currentSubscription
    ? await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data,
        include: { plan: true },
      })
    : await prisma.subscription.create({
        data: {
          tenantId,
          ...data,
        },
        include: { plan: true },
      });

  return subscription;
}

export async function deleteTenantWithData(slug, _options = {}) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, status: true },
  });

  if (!tenant) return null;

  const counts = await prisma.$transaction(async (tx) => {
    const deleted = {};

    deleted.invoiceDocuments = (await tx.invoiceDocument.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.invoiceEvents = (await tx.invoiceEvent.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.invoices = (await tx.invoice.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.paymentEvents = (await tx.paymentEvent.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.payments = (await tx.payment.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.invoiceSequences = (await tx.invoiceSequence.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.integrationCheckpoints = (await tx.integrationCheckpoint.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.tenantIntegrations = (await tx.tenantIntegration.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.tenantProfiles = (await tx.tenantProfile.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.tenantUsers = (await tx.tenantUser.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.subscriptions = (await tx.subscription.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.tenantNotes = (await tx.tenantNote.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.onboardingSubmissions = (await tx.tenantOnboardingSubmission.deleteMany({ where: { tenantId: tenant.id } })).count;
    deleted.auditLogs = (await tx.tenantAuditLog.deleteMany({ where: { tenantId: tenant.id } })).count;
    await tx.tenant.delete({ where: { id: tenant.id } });
    deleted.tenants = 1;

    return deleted;
  });

  tenantIdCache.delete(tenant.slug);
  for (const provider of ["MERCADOPAGO", "AFIP", "DRIVE", "SHEETS"]) {
    integrationCache.delete(integrationCacheKey(tenant.id, provider));
  }

  return {
    tenant,
    deleted: counts,
    files: { requested: 0, deleted: 0, missing: 0, failed: [] },
  };
}

export async function getTenantIntegrationConfig(tenantId, provider) {
  const normalizedProvider = normalizeProvider(provider);
  const key = integrationCacheKey(tenantId, normalizedProvider);
  if (integrationCache.has(key)) return integrationCache.get(key);

  const row = await prisma.tenantIntegration.findUnique({
    where: {
      tenantId_provider: { tenantId, provider: normalizedProvider },
    },
  });

  if (!row || !row.enabled) {
    throw new Error(`Integracion ${normalizedProvider} no habilitada para tenant ${tenantId}`);
  }

  const parsed = parseSecretEnc(row.secretEnc);
  integrationCache.set(key, parsed);
  return parsed;
}

export async function tryGetTenantIntegrationConfig(tenantId, provider) {
  const normalizedProvider = normalizeProvider(provider);
  const key = integrationCacheKey(tenantId, normalizedProvider);
  const row = await prisma.tenantIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider: normalizedProvider } },
  });
  if (!row?.enabled || !row.secretEnc) return null;

  const parsed = parseSecretEnc(row.secretEnc);
  integrationCache.set(key, parsed);
  return parsed;
}

export async function getTenantActivePlan(tenantId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: "ACTIVE",
    },
    include: {
      plan: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return subscription?.plan ?? null;
}

export async function listTenantIntegrations(tenantId, { revealSecrets = false } = {}) {
  const rows = await prisma.tenantIntegration.findMany({
    where: { tenantId },
    orderBy: { provider: "asc" },
  });

  return rows.map((row) => {
    const parsed = parseSecretEnc(row.secretEnc);
    return {
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      config: revealSecrets ? parsed : maskSecrets(parsed),
    };
  });
}

export async function listEnabledTenantsByIntegration(provider) {
  const normalizedProvider = normalizeProvider(provider);
  const rows = await prisma.tenantIntegration.findMany({
    where: {
      provider: normalizedProvider,
      enabled: true,
      tenant: {
        is: {
          status: "ACTIVE",
        },
      },
    },
    include: {
      tenant: true,
    },
    orderBy: { tenantId: "asc" },
  });

  return rows.map((row) => ({
    tenantId: row.tenantId,
    tenant: row.tenant,
    config: parseSecretEnc(row.secretEnc),
  }));
}

export async function getIntegrationCheckpoint(tenantId, provider) {
  const row = await prisma.integrationCheckpoint.findUnique({
    where: { tenantId_provider: { tenantId, provider: normalizeProvider(provider) } },
  });

  return row?.valueJson ? JSON.parse(row.valueJson) : null;
}

export async function setIntegrationCheckpoint(tenantId, provider, value) {
  return prisma.integrationCheckpoint.upsert({
    where: { tenantId_provider: { tenantId, provider: normalizeProvider(provider) } },
    update: { valueJson: JSON.stringify(value) },
    create: {
      tenantId,
      provider: normalizeProvider(provider),
      valueJson: JSON.stringify(value),
    },
  });
}

export async function upsertTenantIntegrationConfig(tenantId, provider, partialConfig = {}, { enabled = true } = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const existing = await prisma.tenantIntegration.findUnique({
    where: { tenantId_provider: { tenantId, provider: normalizedProvider } },
  });

  const previous = existing?.secretEnc ? parseSecretEnc(existing.secretEnc) : {};
  const merged = { ...previous, ...partialConfig };

  integrationCache.set(integrationCacheKey(tenantId, normalizedProvider), merged);

  return prisma.tenantIntegration.upsert({
    where: { tenantId_provider: { tenantId, provider: normalizedProvider } },
    update: {
      enabled,
      secretEnc: serializeSecretEnc(merged),
    },
    create: {
      tenantId,
      provider: normalizedProvider,
      enabled,
      secretEnc: serializeSecretEnc(merged),
    },
  });
}

export async function replaceTenantIntegrationConfig(tenantId, provider, fullConfig = {}, { enabled = true } = {}) {
  const normalizedProvider = normalizeProvider(provider);
  integrationCache.set(integrationCacheKey(tenantId, normalizedProvider), fullConfig);

  return prisma.tenantIntegration.upsert({
    where: { tenantId_provider: { tenantId, provider: normalizedProvider } },
    update: {
      enabled,
      secretEnc: serializeSecretEnc(fullConfig),
    },
    create: {
      tenantId,
      provider: normalizedProvider,
      enabled,
      secretEnc: serializeSecretEnc(fullConfig),
    },
  });
}

export async function addOrUpdateTenantUser(tenantId, { email, role }) {
  return prisma.tenantUser.upsert({
    where: {
      tenantId_email: { tenantId, email: String(email).toLowerCase() },
    },
    update: {
      role,
    },
    create: {
      tenantId,
      email: String(email).toLowerCase(),
      role,
    },
  });
}

export async function listTenantUsers(tenantId) {
  return prisma.tenantUser.findMany({
    where: { tenantId },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
}

export async function findTenantUserByEmail(tenantId, email) {
  return prisma.tenantUser.findUnique({
    where: {
      tenantId_email: {
        tenantId,
        email: String(email || "").trim().toLowerCase(),
      },
    },
    include: {
      tenant: true,
    },
  });
}

export async function findTenantUserById(id) {
  return prisma.tenantUser.findUnique({
    where: { id },
    include: {
      tenant: true,
    },
  });
}

export async function addOrUpdateTenantUserWithAuth(
  tenantId,
  { email, role, password = undefined, status = undefined }
) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const data = {
    role,
  };

  if (status !== undefined) {
    data.status = status;
  }

  if (password !== undefined && String(password).length > 0) {
    data.passwordHash = await hashPassword(password);
  }

  return prisma.tenantUser.upsert({
    where: {
      tenantId_email: { tenantId, email: normalizedEmail },
    },
    update: data,
    create: {
      tenantId,
      email: normalizedEmail,
      role,
      status: status ?? "ACTIVE",
      passwordHash: data.passwordHash ?? null,
    },
  });
}
