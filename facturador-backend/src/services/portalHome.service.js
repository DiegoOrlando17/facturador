import { db } from "../models/db.js";
import { buildAttentionItems, buildMonthWindows, percentChange, summarizeIssued } from "../domain/portalHome.js";
import { hasRequiredIntegrationCredentials } from "../domain/integrationReadiness.js";
import { getTenantIntegrationState } from "./tenantInvoice.service.js";

function issuedInWindow(tenantId, window) {
  return db.invoice.groupBy({
    by: ["type"],
    where: { tenantId, status: "ISSUED", issuedAt: { gte: window.from, lte: window.to } },
    _sum: { amount: true },
    _count: { _all: true },
  });
}

/**
 * Inicio del portal: resumen del mes, bandeja "Qué hacer ahora" y estado de
 * la conexión con Mercado Pago. Todas las consultas filtran por tenant.
 */
export async function getTenantPortalHome(tenantId, now = new Date()) {
  const windows = buildMonthWindows(now);
  const [currentRows, previousRows, pendingConfirmation, failedInvoices, lastFailed, profile, subscription, mercadoPago, checkpoint, lastIssued] = await Promise.all([
    issuedInWindow(tenantId, windows.current),
    issuedInWindow(tenantId, windows.previous),
    db.invoice.count({ where: { tenantId, type: "INVOICE", status: "PENDING_CONFIRMATION" } }),
    db.invoice.count({ where: { tenantId, type: "INVOICE", status: "FAILED" } }),
    db.invoice.findFirst({ where: { tenantId, type: "INVOICE", status: "FAILED" }, orderBy: { updatedAt: "desc" }, select: { error: true } }),
    db.tenantProfile.findUnique({ where: { tenantId }, select: { approvalStatus: true, reviewNotes: true } }),
    db.subscription.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" }, select: { status: true, plan: { select: { name: true } } } }),
    getTenantIntegrationState(tenantId, "MERCADOPAGO"),
    db.integrationCheckpoint.findUnique({ where: { tenantId_provider: { tenantId, provider: "MERCADOPAGO" } }, select: { updatedAt: true } }),
    db.invoice.findFirst({ where: { tenantId, type: "INVOICE", status: "ISSUED" }, orderBy: { issuedAt: "desc" }, select: { issuedAt: true } }),
  ]);

  const current = summarizeIssued(currentRows);
  const previous = summarizeIssued(previousRows);
  const mercadoPagoConnected = mercadoPago.enabled && hasRequiredIntegrationCredentials("MERCADOPAGO", mercadoPago.config);
  const profileStatus = profile?.approvalStatus ?? "DRAFT";

  return {
    month: {
      key: windows.monthKey,
      previousKey: windows.previousMonthKey,
      currency: "ARS",
      ...current,
      previousNet: previous.net,
      changePercent: percentChange(current.net, previous.net),
    },
    attention: buildAttentionItems({
      pendingConfirmation,
      failedInvoices,
      lastFailedError: lastFailed?.error ?? null,
      profileStatus,
      profileNotes: profile?.reviewNotes ?? null,
      subscriptionStatus: subscription?.status ?? null,
      mercadoPagoConnected,
    }),
    profileStatus,
    subscription: subscription ? { status: subscription.status, planName: subscription.plan?.name ?? null } : null,
    connection: {
      mercadoPagoConnected,
      invoiceMode: String(mercadoPago.config?.INVOICE_MODE || "automatic").toLowerCase(),
      lastSyncAt: checkpoint?.updatedAt ?? null,
      lastIssuedAt: lastIssued?.issuedAt ?? null,
    },
  };
}
