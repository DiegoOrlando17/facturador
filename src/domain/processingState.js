export const PAYMENT_TRANSITIONS = Object.freeze({
  pending: new Set(["processing", "failed"]),
  processing: new Set(["processing", "afip_pending", "pdf_pending", "drive_pending", "sheets_pending", "complete", "failed"]),
  afip_pending: new Set(["processing", "failed"]),
  pdf_pending: new Set(["drive_pending", "sheets_pending", "complete", "failed"]),
  drive_pending: new Set(["drive_pending", "sheets_pending", "complete", "failed"]),
  sheets_pending: new Set(["drive_pending", "sheets_pending", "complete", "failed"]),
  complete: new Set(["complete"]),
  failed: new Set(["pending"]),
});

export const INVOICE_TRANSITIONS = Object.freeze({
  DRAFT: new Set(["PENDING_CONFIRMATION", "QUEUED"]),
  PENDING_CONFIRMATION: new Set(["DRAFT", "QUEUED"]),
  QUEUED: new Set(["ISSUING", "FAILED"]),
  ISSUING: new Set(["ISSUED", "FAILED"]),
  ISSUED: new Set([]),
  FAILED: new Set(["QUEUED", "ISSUING"]),
});

function assertTransition(map, entity, from, to) {
  if (!map[from]) {
    throw new Error(`Estado ${entity} desconocido: ${from}`);
  }
  if (!map[to]) {
    throw new Error(`Estado ${entity} desconocido: ${to}`);
  }
  if (!map[from].has(to)) {
    throw new Error(`Transicion ${entity} invalida: ${from} -> ${to}`);
  }
}

export function assertPaymentTransition(from, to) {
  assertTransition(PAYMENT_TRANSITIONS, "Payment", from, to);
}

export function assertInvoiceTransition(from, to) {
  assertTransition(INVOICE_TRANSITIONS, "Invoice", from, to);
}

export function stateConflict(message) {
  const error = new Error(message);
  error.code = "STATE_CONFLICT";
  return error;
}
