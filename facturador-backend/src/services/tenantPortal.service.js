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
import { isValidCuit } from "../domain/tenantInvoice.js";

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

export const TENANT_LOGIN_FAILURES = Object.freeze({
  INVALID_CREDENTIALS: {
    code: "INVALID_CREDENTIALS",
    message: "Empresa, email o contraseña incorrectos.",
  },
  EMAIL_NOT_VERIFIED: {
    code: "EMAIL_NOT_VERIFIED",
    message: "Todavía no verificaste tu email. Revisá tu casilla o pedí un nuevo enlace de verificación.",
  },
  USER_DISABLED: {
    code: "USER_DISABLED",
    message: "Tu usuario está deshabilitado. Pedile acceso al responsable de tu empresa.",
  },
  TENANT_INACTIVE: {
    code: "TENANT_INACTIVE",
    message: "La cuenta de tu empresa no está activa. Escribinos a soporte para revisarla.",
  },
});

/**
 * Decide por que falla un login. Solo revela estados de la cuenta
 * (sin verificar, deshabilitada) cuando la contraseña es correcta, para no
 * filtrar que empresas o emails existen.
 */
export function resolveTenantLoginFailure({ tenantUser, passwordOk, hasPendingVerification = false }) {
  if (!tenantUser || !tenantUser.passwordHash || !passwordOk) return TENANT_LOGIN_FAILURES.INVALID_CREDENTIALS;
  if (tenantUser.status !== "ACTIVE") {
    return hasPendingVerification ? TENANT_LOGIN_FAILURES.EMAIL_NOT_VERIFIED : TENANT_LOGIN_FAILURES.USER_DISABLED;
  }
  if (tenantUser.tenant?.status !== "ACTIVE") return TENANT_LOGIN_FAILURES.TENANT_INACTIVE;
  return null;
}

async function findTenantIdForLogin(tenantSlug) {
  try {
    return await resolveTenantIdBySlug(tenantSlug);
  } catch {
    return null;
  }
}

/**
 * Devuelve { ok: true, tenantUser } o { ok: false, code, message } con un
 * mensaje listo para mostrar al usuario.
 */
export async function authenticateTenantUser(tenantSlug, email, password) {
  const tenantId = await findTenantIdForLogin(tenantSlug);
  const tenantUser = tenantId ? await findTenantUserByEmail(tenantId, email) : null;
  const passwordOk = tenantUser?.passwordHash ? await verifyPassword(password, tenantUser.passwordHash) : false;
  const hasPendingVerification = tenantUser && passwordOk && tenantUser.status !== "ACTIVE"
    ? (await db.contactVerification.count({ where: { tenantId: tenantUser.tenantId, email: tenantUser.email, verifiedAt: null } })) > 0
    : false;

  const failure = resolveTenantLoginFailure({ tenantUser, passwordOk, hasPendingVerification });
  if (failure) return { ok: false, ...failure };

  const updated = await db.tenantUser.update({
    where: { id: tenantUser.id },
    data: {
      lastLoginAt: new Date(),
    },
    include: {
      tenant: true,
    },
  });

  return { ok: true, tenantUser: sanitizeTenantUser(updated) };
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

// Condición frente al IVA de quien emite. "Consumidor final" no aplica a un emisor.
const ISSUER_IVA_CONDITIONS = new Set(["responsable_inscripto", "monotributo", "exento"]);
const EMAIL_FIELDS = { contactEmail: "email de contacto", responsibleEmail: "email del responsable" };

export function validateTenantProfileInput(body = {}) {
  const cuit = String(body.cuit || "").replace(/\D/g, "");
  if (cuit && cuit.length !== 11) {
    throw new Error("El CUIT tiene que tener 11 dígitos.");
  }
  if (cuit && !isValidCuit(cuit)) {
    throw new Error("Revisá el CUIT: el dígito verificador no coincide.");
  }

  const ivaCondition = String(body.ivaCondition || "").trim();
  if (ivaCondition && !ISSUER_IVA_CONDITIONS.has(ivaCondition)) {
    throw new Error("Elegí tu condición frente al IVA: responsable inscripto, monotributo o exento.");
  }

  for (const [field, label] of Object.entries(EMAIL_FIELDS)) {
    const value = String(body[field] || "").trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error(`Revisá el ${label}: no parece válido.`);
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
