import { DateTime } from "luxon";
import { REPORT_TIMEZONE } from "./reportPeriods.js";

/**
 * Ventanas del resumen mensual en hora argentina: el mes en curso hasta ahora y
 * el mes anterior hasta el mismo punto ("a esta altura"), recortado a su último día.
 */
export function buildMonthWindows(now = new Date(), timezone = REPORT_TIMEZONE) {
  const current = DateTime.fromJSDate(now).setZone(timezone);
  const monthStart = current.startOf("month");
  const previousStart = monthStart.minus({ months: 1 });
  const elapsed = current.diff(monthStart);
  const previousCutoff = DateTime.min(previousStart.plus(elapsed), monthStart);
  return {
    current: { from: monthStart.toJSDate(), to: current.toJSDate() },
    previous: { from: previousStart.toJSDate(), to: previousCutoff.toJSDate() },
    monthKey: monthStart.toFormat("yyyy-MM"),
    previousMonthKey: previousStart.toFormat("yyyy-MM"),
  };
}

/** Facturado neto de una ventana: facturas emitidas menos notas de crédito emitidas. */
export function summarizeIssued(rows = []) {
  let invoiced = 0;
  let credited = 0;
  let invoiceCount = 0;
  for (const row of rows) {
    const amount = Number(row?._sum?.amount ?? 0) || 0;
    const count = Number(row?._count?._all ?? 0) || 0;
    if (row.type === "CREDIT_NOTE") credited += amount;
    else {
      invoiced += amount;
      invoiceCount += count;
    }
  }
  const net = Math.round((invoiced - credited) * 100) / 100;
  return { net, invoiced, credited, invoiceCount, averageTicket: invoiceCount ? Math.round((invoiced / invoiceCount) * 100) / 100 : null };
}

/** Variación porcentual redondeada; null si no hay base de comparación. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Bandeja "Qué hacer ahora": cosas que el cliente tiene que resolver, de más a
 * menos urgente. Cada ítem lleva un código estable; el texto lo arma el portal.
 */
export function buildAttentionItems({ pendingConfirmation = 0, failedInvoices = 0, lastFailedError = null, profileStatus = "DRAFT", profileNotes = null, subscriptionStatus = null, mercadoPagoConnected = false } = {}) {
  const items = [];
  if (subscriptionStatus === "PAST_DUE" || subscriptionStatus === "CANCELED") {
    items.push({ code: "subscription_unpaid", tone: "danger", count: null, detail: subscriptionStatus });
  }
  if (failedInvoices > 0) items.push({ code: "invoices_failed", tone: "danger", count: failedInvoices, detail: lastFailedError });
  if (profileStatus === "REJECTED") items.push({ code: "profile_rejected", tone: "danger", count: null, detail: profileNotes });
  if (pendingConfirmation > 0) items.push({ code: "invoices_pending_confirmation", tone: "warning", count: pendingConfirmation, detail: null });
  if (profileStatus === "DRAFT" || !profileStatus) items.push({ code: "profile_incomplete", tone: "warning", count: null, detail: null });
  if (!mercadoPagoConnected) items.push({ code: "mercadopago_not_connected", tone: "warning", count: null, detail: null });
  if (profileStatus === "PENDING") items.push({ code: "profile_in_review", tone: "info", count: null, detail: null });
  return items;
}
