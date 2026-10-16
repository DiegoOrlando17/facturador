import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { resolvePlanPolicy } from "../domain/planPolicy.js";
import { classifyContactVerification, normalizePublicRegistration, PublicRequestError, shouldExposeDevVerification } from "../domain/publicRegistration.js";
import { hashPassword } from "../utils/password.js";
import { isMercadoPagoBillingConfigured } from "./mercadoPagoBilling.service.js";
import { sendVerificationEmail } from "./email.service.js";

const prisma = new PrismaClient();
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function presentPlan(plan) {
  return { id: String(plan.id), code: plan.code, name: plan.name, description: plan.description, price: plan.price, currency: plan.currency, billingCycle: plan.billingCycle, policy: resolvePlanPolicy(plan) };
}

export async function listPublicPlans() {
  const plans = await prisma.plan.findMany({ where: { status: "ACTIVE", code: { in: ["TIER_1", "TIER_2", "TIER_3", "TIER_4"] } }, orderBy: { code: "asc" } });
  return plans.map(presentPlan);
}

export async function registerPublicTenant(payload, { exposeVerificationToken = shouldExposeDevVerification() } = {}) {
  const data = normalizePublicRegistration(payload);
  const plan = await prisma.plan.findUnique({ where: { code: data.planCode } });
  if (!plan || plan.status !== "ACTIVE") throw new PublicRequestError("El plan elegido no está disponible. Elegí otro.", { code: "PLAN_UNAVAILABLE" });
  const passwordHash = await hashPassword(data.password);
  const token = crypto.randomBytes(32).toString("base64url");

  const result = await prisma.$transaction(async (tx) => {
    const existingTenant = await tx.tenant.findUnique({ where: { slug: data.slug } });
    if (existingTenant) throw new PublicRequestError("Ese identificador de empresa ya está en uso. Probá con otro.", { code: "SLUG_TAKEN", status: 409 });
    const existingUser = await tx.tenantUser.findFirst({ where: { email: data.email } });
    if (existingUser) throw new PublicRequestError("Ya existe una cuenta con ese email. Ingresá al portal o, si no verificaste el email, pedí un nuevo enlace.", { code: "EMAIL_TAKEN", status: 409 });

    const tenant = await tx.tenant.create({ data: { name: data.businessName, slug: data.slug, status: "ACTIVE" } });
    await tx.tenantProfile.create({ data: { tenantId: tenant.id, tradeName: data.businessName, contactEmail: data.email, responsibleEmail: data.email } });
    await tx.tenantUser.create({ data: { tenantId: tenant.id, email: data.email, role: "owner", passwordHash, status: "DISABLED" } });
    await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "PAST_DUE", billingProvider: "MERCADOPAGO" } });
    await tx.contactVerification.create({ data: { tenantId: tenant.id, email: data.email, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) } });
    return tenant;
  });

  let emailDelivery;
  try { emailDelivery = await sendVerificationEmail({ to: data.email, businessName: data.businessName, token }); }
  catch (error) { emailDelivery = { sent: false, reason: error.message }; }
  return { tenantSlug: result.slug, email: data.email, verificationRequired: true, emailSent: emailDelivery.sent, billingStatus: "provider_pending", ...(exposeVerificationToken ? { verificationToken: token } : {}) };
}

export async function resendPublicContactVerification(email, { exposeVerificationToken = shouldExposeDevVerification() } = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await prisma.tenantUser.findFirst({ where: { email: normalizedEmail, status: "DISABLED" }, include: { tenant: true } });
  if (!user) return { accepted: true };
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.contactVerification.updateMany({ where: { tenantId: user.tenantId, email: normalizedEmail, verifiedAt: null }, data: { expiresAt: new Date(0) } }),
    prisma.contactVerification.create({ data: { tenantId: user.tenantId, email: normalizedEmail, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) } }),
  ]);
  let delivery;
  try { delivery = await sendVerificationEmail({ to: normalizedEmail, businessName: user.tenant.name, token }); }
  catch { delivery = { sent: false }; }
  return { accepted: true, emailSent: delivery.sent, ...(exposeVerificationToken ? { verificationToken: token } : {}) };
}

export async function verifyPublicContact(token) {
  const normalized = String(token || "").trim();
  if (!normalized) throw new PublicRequestError("El enlace de verificación está incompleto. Abrilo de nuevo desde el email o pedí uno nuevo.", { code: "VERIFICATION_INVALID" });
  const verification = await prisma.contactVerification.findUnique({ where: { tokenHash: tokenHash(normalized) }, include: { tenant: { select: { slug: true } } } });
  const state = classifyContactVerification(verification);
  if (state === "invalid") throw new PublicRequestError("El enlace de verificación no es válido. Pedí uno nuevo con tu email.", { code: "VERIFICATION_INVALID" });
  const identity = { tenantSlug: verification.tenant?.slug ?? null, email: verification.email };
  // Idempotente: abrir el mismo enlace dos veces (o el doble efecto de StrictMode) no es un error.
  if (state === "already_verified") return { verified: true, alreadyVerified: true, ...identity };
  if (state === "expired") throw new PublicRequestError("El enlace de verificación venció. Pedí uno nuevo con tu email.", { code: "VERIFICATION_EXPIRED" });
  await prisma.$transaction([
    prisma.contactVerification.update({ where: { id: verification.id }, data: { verifiedAt: new Date() } }),
    prisma.tenantUser.update({ where: { tenantId_email: { tenantId: verification.tenantId, email: verification.email } }, data: { status: "ACTIVE" } }),
  ]);
  return { verified: true, alreadyVerified: false, ...identity };
}

export function getBillingAvailability() {
  const available = isMercadoPagoBillingConfigured();
  return { available, provider: "MERCADOPAGO", pricingCurrency: "USD", chargeCurrency: "ARS", exchangeRate: "BNA_BILLETE_VENDEDOR", reason: available ? null : "Falta configurar MP_BILLING_ACCESS_TOKEN." };
}
