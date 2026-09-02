export function resolveInvoiceSchedule(issueAt, now = new Date()) {
  if (!issueAt) return { scheduledAt: null, delay: 0 };
  const scheduledAt = new Date(issueAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) throw new Error("issueAt debe ser una fecha futura valida");
  const delay = scheduledAt.getTime() - now.getTime();
  if (delay > 30 * 24 * 60 * 60 * 1000) throw new Error("La emision no puede programarse a mas de 30 dias");
  return { scheduledAt, delay };
}

export function normalizeManualInvoiceInput(body = {}) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount debe ser mayor a cero");
  return {
    amount,
    currency: String(body.currency || "ARS").trim().toUpperCase(),
    customer: String(body.customer || "").trim() || null,
    customerDocType: String(body.customerDocType || "").trim().toUpperCase() || null,
    customerDocNumber: String(body.customerDocNumber || "").replace(/\D/g, "") || null,
  };
}
