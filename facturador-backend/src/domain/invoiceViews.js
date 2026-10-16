/**
 * Vistas del listado de facturas del portal. Siempre listan facturas (las notas
 * de crédito viajan anidadas bajo la factura que anulan).
 *   all      todas
 *   pending  esperan confirmación del cliente
 *   issued   emitidas y vigentes (sin nota de crédito emitida)
 *   failed   ARCA las rechazó
 *   voided   anuladas con nota de crédito emitida
 */
export const INVOICE_VIEWS = Object.freeze(["all", "pending", "issued", "failed", "voided"]);

export function normalizeInvoiceView(value) {
  const view = String(value || "all").trim().toLowerCase();
  return INVOICE_VIEWS.includes(view) ? view : "all";
}

export function buildInvoiceViewWhere(tenantId, view) {
  const base = { tenantId, type: "INVOICE" };
  switch (normalizeInvoiceView(view)) {
    case "pending":
      return { ...base, status: "PENDING_CONFIRMATION" };
    case "issued":
      return { ...base, status: "ISSUED", creditNotes: { none: { status: "ISSUED" } } };
    case "failed":
      return { ...base, status: "FAILED" };
    case "voided":
      return { ...base, creditNotes: { some: { status: "ISSUED" } } };
    default:
      return base;
  }
}
