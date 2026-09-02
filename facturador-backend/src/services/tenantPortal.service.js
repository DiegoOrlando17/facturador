import { verifyPassword } from "../utils/password.js";
import {
  findTenantUserByEmail,
  findTenantUserById,
  listTenantIntegrations,
  resolveTenantIdBySlug,
  getTenantProfile,
  upsertTenantProfile,
} from "./tenantConfig.service.js";
import {
  getAdminDashboardSummary,
  getAdminPaymentDetail,
  getAdminReportsSummary,
  getAdminReportsTimeseries,
  listAdminPaymentsForExport,
  listAdminPayments,
} from "./adminMonitor.service.js";
import { db } from "../models/db.js";

function sanitizeTenantUser(tenantUser) {
  if (!tenantUser) return null;

  return {
    id: tenantUser.id,
    tenantId: tenantUser.tenantId,
    email: tenantUser.email,
    role: tenantUser.role,
    status: tenantUser.status,
    lastLoginAt: tenantUser.lastLoginAt,
    createdAt: tenantUser.createdAt,
    updatedAt: tenantUser.updatedAt,
    tenant: tenantUser.tenant
      ? {
          id: tenantUser.tenant.id,
          slug: tenantUser.tenant.slug,
          name: tenantUser.tenant.name,
          status: tenantUser.tenant.status,
        }
      : undefined,
  };
}

export async function authenticateTenantUser(tenantSlug, email, password) {
  const tenantId = await resolveTenantIdBySlug(tenantSlug);
  const tenantUser = await findTenantUserByEmail(tenantId, email);
  if (!tenantUser) return null;
  if (tenantUser.status !== "ACTIVE") return null;
  if (tenantUser.tenant?.status !== "ACTIVE") return null;
  if (!tenantUser.passwordHash) return null;

  const passwordOk = await verifyPassword(password, tenantUser.passwordHash);
  if (!passwordOk) return null;

  const updated = await db.tenantUser.update({
    where: { id: tenantUser.id },
    data: {
      lastLoginAt: new Date(),
    },
    include: {
      tenant: true,
    },
  });

  return sanitizeTenantUser(updated);
}

export async function getTenantPortalUserById(id) {
  const tenantUser = await findTenantUserById(id);
  return sanitizeTenantUser(tenantUser);
}

export async function getTenantPortalDashboard(tenantId) {
  const summary = await getAdminDashboardSummary({ tenantId });
  return buildTenantPortalDashboard(summary);
}

export function buildTenantPortalDashboard(summary) {
  return {
    payments: summary.payments,
    filters: summary.filters,
  };
}

export async function listTenantPortalPayments(tenantId, filters = {}) {
  return listAdminPayments({
    tenantId,
    ...filters,
  });
}

export async function getTenantPortalPaymentDetail(tenantId, paymentId) {
  return getAdminPaymentDetail(paymentId, tenantId);
}

export async function getTenantPortalReportsSummary(tenantId, filters = {}) {
  return getAdminReportsSummary({
    tenantId,
    ...filters,
  });
}

export async function getTenantPortalReportsTimeseries(tenantId, filters = {}) {
  return getAdminReportsTimeseries({
    tenantId,
    ...filters,
  });
}

export async function getTenantPortalIntegrations(tenantId) {
  return listTenantIntegrations(tenantId, { revealSecrets: false });
}

export async function listTenantPortalPaymentsForExport(tenantId, filters = {}) {
  return listAdminPaymentsForExport({
    tenantId,
    ...filters,
  });
}

export function validateTenantProfileInput(body = {}) {
  const cuit = String(body.cuit || "").replace(/\D/g, "");
  if (cuit && cuit.length !== 11) {
    throw new Error("El CUIT debe tener 11 digitos");
  }

  for (const field of ["contactEmail", "responsibleEmail"]) {
    const value = String(body[field] || "").trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error(`${field} no tiene un formato valido`);
    }
  }

  return body;
}

function presentTenantProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    tenantId: profile.tenantId,
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    cuit: profile.cuit,
    ivaCondition: profile.ivaCondition,
    fiscalAddress: profile.fiscalAddress,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    responsibleName: profile.responsibleName,
    responsibleEmail: profile.responsibleEmail,
    approvalStatus: profile.approvalStatus,
    reviewNotes: profile.reviewNotes,
    reviewedAt: profile.reviewedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function getTenantPortalProfile(tenantId) {
  return presentTenantProfile(await getTenantProfile(tenantId));
}

export async function updateTenantPortalProfile(tenantId, body) {
  validateTenantProfileInput(body);
  return presentTenantProfile(await upsertTenantProfile(tenantId, body));
}
