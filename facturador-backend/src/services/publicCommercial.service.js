import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { resolvePlanPolicy } from "../domain/planPolicy.js";
import { normalizePublicRegistration } from "../domain/publicRegistration.js";
import { hashPassword } from "../utils/password.js";
import { isMercadoPagoBillingConfigured } from "./mercadoPagoBilling.service.js";

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

export async function registerPublicTenant(payload, { exposeVerificationToken = process.env.NODE_ENV !== "production" } = {}) {
  const data = normalizePublicRegistration(payload);
  const plan = await prisma.plan.findUnique({ where: { code: data.planCode } });
  if (!plan || plan.status !== "ACTIVE") throw new Error("El plan seleccionado no esta disponible");
  const passwordHash = await hashPassword(data.password);
  const token = crypto.randomBytes(32).toString("base64url");

  const result = await prisma.$transaction(async (tx) => {
    const existingTenant = await tx.tenant.findUnique({ where: { slug: data.slug } });
    if (existingTenant) throw new Error("El identificador de empresa ya esta en uso");
    const existingUser = await tx.tenantUser.findFirst({ where: { email: data.email } });
    if (existingUser) throw new Error("El email ya esta registrado");

    const tenant = await tx.tenant.create({ data: { name: data.businessName, slug: data.slug, status: "ACTIVE" } });
    await tx.tenantProfile.create({ data: { tenantId: tenant.id, tradeName: data.businessName, contactEmail: data.email, responsibleEmail: data.email } });
    await tx.tenantUser.create({ data: { tenantId: tenant.id, email: data.email, role: "owner", passwordHash, status: "DISABLED" } });
    await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "PAST_DUE", billingProvider: "MERCADOPAGO" } });
    await tx.contactVerification.create({ data: { tenantId: tenant.id, email: data.email, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) } });
    return tenant;
  });

  return { tenantSlug: result.slug, email: data.email, verificationRequired: true, billingStatus: "provider_pending", ...(exposeVerificationToken ? { verificationToken: token } : {}) };
}

export async function verifyPublicContact(token) {
  const normalized = String(token || "").trim();
  if (!normalized) throw new Error("token es obligatorio");
  const verification = await prisma.contactVerification.findUnique({ where: { tokenHash: tokenHash(normalized) } });
  if (!verification || verification.verifiedAt || verification.expiresAt <= new Date()) throw new Error("El enlace de verificacion es invalido o vencio");
  await prisma.$transaction([
    prisma.contactVerification.update({ where: { id: verification.id }, data: { verifiedAt: new Date() } }),
    prisma.tenantUser.update({ where: { tenantId_email: { tenantId: verification.tenantId, email: verification.email } }, data: { status: "ACTIVE" } }),
  ]);
  return { verified: true };
}

export function getBillingAvailability() {
  const available = isMercadoPagoBillingConfigured();
  return { available, provider: "MERCADOPAGO", pricingCurrency: "USD", chargeCurrency: "ARS", exchangeRate: "BNA_BILLETE_VENDEDOR", reason: available ? null : "Falta configurar MP_BILLING_ACCESS_TOKEN." };
}
