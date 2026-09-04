import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/index.js";
import { calculateArsAmount, mapMercadoPagoSubscriptionStatus } from "../domain/billingSubscription.js";
import { getBnaUsdSellingRate } from "./bnaExchangeRate.service.js";
import { clearTenantSubscriptionPolicyCache } from "./subscriptionPolicy.service.js";

const prisma = new PrismaClient();
function client() {
  if (!config.BILLING.MP_ACCESS_TOKEN) throw new Error("Mercado Pago Suscripciones no esta configurado");
  return axios.create({ baseURL: config.BILLING.MP_API_URL, timeout: 15000, headers: { Authorization: `Bearer ${config.BILLING.MP_ACCESS_TOKEN}`, "Content-Type": "application/json" } });
}

export async function createMercadoPagoCheckout(tenantId) {
  const subscription = await prisma.subscription.findFirst({ where: { tenantId }, include: { plan: true, tenant: { include: { users: { where: { role: "owner" }, take: 1 } } } }, orderBy: { createdAt: "desc" } });
  if (!subscription?.plan?.price || subscription.plan.currency !== "USD") throw new Error("La suscripcion no tiene un precio USD valido");
  if (subscription.billingRef && subscription.billingProvider === "MERCADOPAGO") {
    const { data } = await client().get(`/preapproval/${encodeURIComponent(subscription.billingRef)}`);
    return { checkoutUrl: data.init_point, subscriptionId: data.id, status: data.status };
  }
  const quote = await getBnaUsdSellingRate();
  const amount = calculateArsAmount(subscription.plan.price, quote.rate);
  const payerEmail = subscription.tenant.users[0]?.email;
  if (!payerEmail) throw new Error("El tenant no tiene un owner para asociar al cobro");
  const { data } = await client().post("/preapproval", { reason: `Facturador - ${subscription.plan.name}`, external_reference: `tenant:${tenantId}:subscription:${subscription.id}`, payer_email: payerEmail, auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: amount, currency_id: "ARS" }, back_url: config.BILLING.BACK_URL, status: "pending" }, { headers: { "X-Idempotency-Key": `facturador-subscription-${subscription.id}` } });
  await prisma.subscription.update({ where: { id: subscription.id }, data: { billingProvider: "MERCADOPAGO", billingRef: String(data.id), billingStatusRaw: String(data.status), billingAmount: amount, billingCurrency: "ARS", exchangeRate: quote.rate, exchangeRateSource: quote.source, exchangeRateAt: quote.quotedAt, status: mapMercadoPagoSubscriptionStatus(data.status) } });
  clearTenantSubscriptionPolicyCache(tenantId);
  return { checkoutUrl: data.init_point, subscriptionId: data.id, status: data.status, amount, currency: "ARS", exchangeRate: quote.rate };
}

async function syncPreapproval(preapproval) {
  const row = await prisma.subscription.findFirst({ where: { billingProvider: "MERCADOPAGO", billingRef: String(preapproval.id) } });
  if (!row) return { ignored: true };
  const status = mapMercadoPagoSubscriptionStatus(preapproval.status);
  await prisma.subscription.update({ where: { id: row.id }, data: { status, billingStatusRaw: String(preapproval.status) } });
  clearTenantSubscriptionPolicyCache(row.tenantId);
  return { updated: true, tenantId: String(row.tenantId), status };
}

async function updateNextCycleAmount(row) {
  const subscription = await prisma.subscription.findUnique({ where: { id: row.id }, include: { plan: true } });
  if (!subscription?.plan?.price || subscription.plan.currency !== "USD") return null;
  const quote = await getBnaUsdSellingRate();
  const amount = calculateArsAmount(subscription.plan.price, quote.rate);
  await client().put(`/preapproval/${encodeURIComponent(row.billingRef)}`, { auto_recurring: { transaction_amount: amount, currency_id: "ARS" } });
  await prisma.subscription.update({ where: { id: row.id }, data: { billingAmount: amount, billingCurrency: "ARS", exchangeRate: quote.rate, exchangeRateSource: quote.source, exchangeRateAt: quote.quotedAt } });
  return { amount, exchangeRate: quote.rate };
}

export async function processMercadoPagoBillingNotification(topic, resourceId) {
  const normalizedTopic = String(topic || "").toLowerCase();
  const id = String(resourceId || "").trim();
  if (!id) throw new Error("Notificacion sin resource ID");
  if (normalizedTopic === "subscription_preapproval" || normalizedTopic === "preapproval") {
    const { data } = await client().get(`/preapproval/${encodeURIComponent(id)}`);
    return syncPreapproval(data);
  }
  if (normalizedTopic === "subscription_authorized_payment" || normalizedTopic === "authorized_payment") {
    const { data: payment } = await client().get(`/authorized_payments/${encodeURIComponent(id)}`);
    const preapprovalId = payment.preapproval_id || payment.subscription_id;
    if (!preapprovalId) return { ignored: true };
    const { data } = await client().get(`/preapproval/${encodeURIComponent(preapprovalId)}`);
    const result = await syncPreapproval(data);
    if (String(payment.status || "").toLowerCase() === "approved" && result.updated) {
      const row = await prisma.subscription.findFirst({ where: { billingProvider: "MERCADOPAGO", billingRef: String(preapprovalId) } });
      if (row) result.nextCycle = await updateNextCycleAmount(row);
    } else if (result.updated) {
      const row = await prisma.subscription.findFirst({ where: { billingProvider: "MERCADOPAGO", billingRef: String(preapprovalId) } });
      if (row) {
        await prisma.subscription.update({ where: { id: row.id }, data: { status: "PAST_DUE", billingStatusRaw: `payment:${String(payment.status || "unknown")}` } });
        clearTenantSubscriptionPolicyCache(row.tenantId);
        result.status = "PAST_DUE";
      }
    }
    return result;
  }
  return { ignored: true };
}

export function isMercadoPagoBillingConfigured() { return Boolean(config.BILLING.MP_ACCESS_TOKEN); }

export async function getTenantBillingSubscription(tenantId) {
  const row = await prisma.subscription.findFirst({ where: { tenantId }, include: { plan: true }, orderBy: { createdAt: "desc" } });
  if (!row) return null;
  return { id: String(row.id), status: row.status, billingStatus: row.billingStatusRaw, billingProvider: row.billingProvider, amount: row.billingAmount, currency: row.billingCurrency, exchangeRate: row.exchangeRate, exchangeRateSource: row.exchangeRateSource, exchangeRateAt: row.exchangeRateAt, plan: { code: row.plan.code, name: row.plan.name, price: row.plan.price, currency: row.plan.currency } };
}

export async function changeMercadoPagoSubscriptionStatus(tenantId, action) {
  const row = await prisma.subscription.findFirst({ where: { tenantId, billingProvider: "MERCADOPAGO" }, orderBy: { createdAt: "desc" } });
  if (!row?.billingRef) throw new Error("No existe una suscripcion de Mercado Pago vinculada");
  const statuses = { pause: "paused", resume: "authorized", cancel: "cancelled" };
  const target = statuses[action];
  if (!target) throw new Error("Accion de suscripcion invalida");
  if (action === "resume" && row.billingStatusRaw !== "paused") throw new Error("Solo una suscripcion pausada puede reactivarse");
  if (row.status === "CANCELED") throw new Error("Una suscripcion cancelada no puede reactivarse");
  const { data } = await client().put(`/preapproval/${encodeURIComponent(row.billingRef)}`, { status: target });
  await syncPreapproval(data);
  return getTenantBillingSubscription(tenantId);
}
