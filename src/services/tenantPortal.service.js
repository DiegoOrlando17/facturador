import { verifyPassword } from "../utils/password.js";
import {
  findTenantUserByEmail,
  findTenantUserById,
  listTenantIntegrations,
  resolveTenantIdBySlug,
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
  return getAdminDashboardSummary({ tenantId });
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
