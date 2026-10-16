// Etiquetas del portal cliente para estados de pago y eventos.
// Provisorio hasta unificar en lib/statusLabels.ts (fase 2 de la auditoría).

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pago recibido",
  processing: "En proceso",
  afip_pending: "Pendiente ARCA",
  pdf_pending: "Pendiente PDF",
  drive_pending: "Pendiente Drive",
  sheets_pending: "Pendiente Sheets",
  complete: "Facturado",
  failed: "Con error",
};

export function getPaymentStatusLabel(status: string | null | undefined) {
  if (!status) return "Sin estado";
  return PAYMENT_STATUS_LABELS[status.toLowerCase()] ?? "En proceso";
}

const PAYMENT_EVENT_LABELS: Record<string, string> = {
  payment_detected: "Venta detectada en Mercado Pago",
  payment_updated: "Venta actualizada",
  invoice_requested: "Emisión solicitada a ARCA",
  afip_ok: "Comprobante emitido en ARCA",
  pdf_ok: "PDF generado",
  drive_ok: "Guardado en Google Drive",
  sheets_ok: "Registrado en Google Sheets",
  retry_scheduled: "Reintento programado",
  retried: "Reintento",
  failed: "Error",
  note_added: "Nota",
};

export function getPaymentEventLabel(type: string | null | undefined) {
  if (!type) return "Actividad";
  return PAYMENT_EVENT_LABELS[type.toLowerCase()] ?? "Actividad";
}
