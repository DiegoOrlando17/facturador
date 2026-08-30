export const PAYMENT_ATTENTION_STATUSES = Object.freeze([
  "afip_pending",
  "pdf_pending",
  "drive_pending",
  "sheets_pending",
  "failed",
]);

export function buildPaymentAttentionWhere() {
  return {
    OR: [
      { status: { in: [...PAYMENT_ATTENTION_STATUSES] } },
      { status: "processing", error: { not: null } },
    ],
  };
}

export function isPaymentAttentionState(status, error = null) {
  return PAYMENT_ATTENTION_STATUSES.includes(status) || (status === "processing" && Boolean(error));
}
