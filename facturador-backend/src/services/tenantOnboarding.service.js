import { db } from "../models/db.js";
import { maskSecrets } from "../utils/crypto.js";
import {
  replaceTenantIntegrationConfig,
  upsertTenantIntegrationConfig,
} from "./tenantConfig.service.js";
import { createTenantAuditLog } from "./tenantSupport.service.js";
import { startMercadopagoProcessingFromDate } from "./mercadopagoBackfill.service.js";

const ALLOWED_INTEGRATIONS = new Set(["MERCADOPAGO", "AFIP", "DRIVE", "SHEETS"]);
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected"]);

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

function stringifyJson(value) {
  return JSON.stringify(value ?? {});
}

function normalizeIntegrationKey(provider) {
  const normalized = String(provider || "").trim().toUpperCase();
  if (!ALLOWED_INTEGRATIONS.has(normalized)) {
    throw new Error(`Integracion invalida: ${provider}`);
  }
  return normalized;
}

function sanitizeSubmission(row, { revealSecrets = false } = {}) {
  if (!row) return null;

  const data = parseJsonField(row.dataJson, {});
  const documents = parseJsonField(row.documentsJson, []);
  const integrations = data.integrations || {};
  const safeIntegrations = Object.fromEntries(
    Object.entries(integrations).map(([provider, config]) => [
      provider,
      revealSecrets ? config : maskSecrets(config),
    ])
  );

  return {
    ...row,
    data: {
      ...data,
      integrations: safeIntegrations,
    },
    documents,
    dataJson: undefined,
    documentsJson: undefined,
  };
}

export async function createTenantOnboardingSubmission(
  tenantId,
  submittedByUserId,
  { integrations = {}, documents = [], business = {}, processingStartDate = null } = {}
) {
  const normalizedIntegrations = Object.fromEntries(
    Object.entries(integrations || {}).map(([provider, config]) => [
      normalizeIntegrationKey(provider),
      config && typeof config === "object" && !Array.isArray(config) ? config : {},
    ])
  );

  if (!processingStartDate && normalizedIntegrations.MERCADOPAGO?.PROCESSING_START_DATE) {
    processingStartDate = normalizedIntegrations.MERCADOPAGO.PROCESSING_START_DATE;
  }

  const row = await db.tenantOnboardingSubmission.create({
    data: {
      tenantId,
      submittedByUserId,
      status: "pending",
      dataJson: stringifyJson({
        business,
        integrations: normalizedIntegrations,
        processingStartDate,
      }),
      documentsJson: stringifyJson(documents),
    },
  });

  return sanitizeSubmission(row);
}

export async function listTenantOnboardingSubmissions(tenantId, { status = null, revealSecrets = false } = {}) {
  const where = { tenantId };
  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(normalizedStatus)) throw new Error("status invalido");
    where.status = normalizedStatus;
  }

  const rows = await db.tenantOnboardingSubmission.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
  });

  return rows.map((row) => sanitizeSubmission(row, { revealSecrets }));
}

export async function getTenantOnboardingSubmission(tenantId, submissionId, { revealSecrets = false } = {}) {
  const row = await db.tenantOnboardingSubmission.findFirst({
    where: { tenantId, id: submissionId },
  });
  return sanitizeSubmission(row, { revealSecrets });
}

export async function approveTenantOnboardingSubmission(
  tenantId,
  submissionId,
  adminUser,
  { reviewNotes = null, processingStartDate = null, enableProcessing = true } = {}
) {
  const row = await db.tenantOnboardingSubmission.findFirst({
    where: { tenantId, id: submissionId },
  });

  if (!row) throw new Error("Onboarding no encontrado");
  if (row.status !== "pending") throw new Error("El onboarding ya fue revisado");

  const data = parseJsonField(row.dataJson, {});
  const integrations = data.integrations || {};
  const resolvedProcessingStartDate =
    processingStartDate ||
    data.processingStartDate ||
    integrations.MERCADOPAGO?.PROCESSING_START_DATE;

  for (const [provider, config] of Object.entries(integrations)) {
    const normalizedProvider = normalizeIntegrationKey(provider);
    const enabled = normalizedProvider === "MERCADOPAGO" ? Boolean(enableProcessing) : true;
    await replaceTenantIntegrationConfig(tenantId, normalizedProvider, config, { enabled });
  }

  let mercadopagoStart = null;
  if (enableProcessing && integrations.MERCADOPAGO) {
    if (!resolvedProcessingStartDate) {
      throw new Error("processingStartDate es obligatorio para aprobar y procesar Mercado Pago");
    }

    await upsertTenantIntegrationConfig(
      tenantId,
      "MERCADOPAGO",
      { PROCESSING_START_DATE: resolvedProcessingStartDate },
      { enabled: true }
    );

    mercadopagoStart = await startMercadopagoProcessingFromDate(
      tenantId,
      resolvedProcessingStartDate,
      integrations.MERCADOPAGO
    );
  }

  const updated = await db.tenantOnboardingSubmission.update({
    where: { id: submissionId },
    data: {
      status: "approved",
      reviewedByAdminUserId: BigInt(adminUser.id),
      reviewNotes,
      reviewedAt: new Date(),
    },
  });

  await createTenantAuditLog({
    tenantId,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: "tenant_onboarding_approved",
    entityType: "TenantOnboardingSubmission",
    entityId: String(submissionId),
    after: {
      enableProcessing,
      processingStartDate: resolvedProcessingStartDate,
      mercadopagoStart,
    },
  });

  return {
    submission: sanitizeSubmission(updated),
    mercadopagoStart,
  };
}

export async function rejectTenantOnboardingSubmission(tenantId, submissionId, adminUser, { reviewNotes = null } = {}) {
  const row = await db.tenantOnboardingSubmission.findFirst({
    where: { tenantId, id: submissionId },
  });

  if (!row) throw new Error("Onboarding no encontrado");
  if (row.status !== "pending") throw new Error("El onboarding ya fue revisado");

  const updated = await db.tenantOnboardingSubmission.update({
    where: { id: submissionId },
    data: {
      status: "rejected",
      reviewedByAdminUserId: BigInt(adminUser.id),
      reviewNotes,
      reviewedAt: new Date(),
    },
  });

  await createTenantAuditLog({
    tenantId,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: "tenant_onboarding_rejected",
    entityType: "TenantOnboardingSubmission",
    entityId: String(submissionId),
    after: { reviewNotes },
  });

  return sanitizeSubmission(updated);
}
