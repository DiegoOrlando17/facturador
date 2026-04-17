import { PrismaClient } from "@prisma/client";
import { decryptJson, encryptJson, maskSecrets } from "../utils/crypto.js";

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
      users: {
        orderBy: [{ role: "asc" }, { email: "asc" }],
      },
    },
  });
}

export async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: [{ createdAt: "asc" }],
    include: {
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
