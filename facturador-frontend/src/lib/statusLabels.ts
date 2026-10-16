/**
 * Fuente única de etiquetas y tonos para los estados que devuelve el backend.
 * Ninguna pantalla debería mostrar un enum crudo ni hacer `.replace(/_/g, " ")`.
 *
 * Tonos (ver docs/VOZ_Y_GLOSARIO.md):
 *  - success: terminó bien, no requiere nada.
 *  - warning: requiere una acción pronto (o algo quedó a medio camino).
 *  - danger:  algo falló y bloquea.
 *  - info:    en curso, sin acción requerida.
 *  - neutral: inactivo o sin datos.
 *
 * Uso: `getStatus("payment", payment.status)` devuelve `{ label, tone, description? }`.
 * En JSX: `<StatusBadge kind="payment" value={payment.status} />`.
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type StatusPresentation = {
  label: string;
  tone: StatusTone;
  /** Frase corta que explica el estado (para tooltips, detalle o ayudas). */
  description?: string;
};

type StatusMap = Record<string, StatusPresentation>;

/* -------------------------------------------------------------------------- */
/* Pagos / ventas (Payment.status)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Semántica según el backend (docs/ai/PROCESSING_STATES.md y workers):
 * `X_pending` significa "falta X". Los tres de postproceso (pdf, drive, sheets)
 * solo existen con la factura YA emitida en ARCA (CAE obtenido): la etiqueta
 * dice lo que falta y la descripción aclara que el comprobante es válido.
 * Todos los `*_pending` y `failed` cuentan como "requiere atención" en el
 * backend (domain/paymentAttention.js), por eso van en tono warning/danger.
 */
export const PAYMENT_STATUS: StatusMap = {
  pending: {
    label: "Por facturar",
    tone: "info",
    description: "Detectamos el cobro en Mercado Pago. Todavía no se emitió el comprobante.",
  },
  processing: {
    label: "Procesando",
    tone: "info",
    description: "Se está emitiendo el comprobante o guardando sus copias.",
  },
  afip_pending: {
    label: "Esperando a ARCA",
    tone: "warning",
    description: "La emisión en ARCA no terminó. Se reintenta sola; si sigue así, revisá el certificado y el punto de venta.",
  },
  pdf_pending: {
    label: "Falta el PDF",
    tone: "warning",
    description: "La factura ya está emitida en ARCA (CAE obtenido). Falta generar el PDF.",
  },
  drive_pending: {
    label: "Falta guardar en Drive",
    tone: "warning",
    description: "La factura ya está emitida en ARCA (CAE obtenido). Falta guardar el PDF en Google Drive.",
  },
  sheets_pending: {
    label: "Falta la planilla",
    tone: "warning",
    description: "La factura ya está emitida en ARCA (CAE obtenido). Falta registrarla en la planilla de Google.",
  },
  complete: {
    label: "Facturado",
    tone: "success",
    description: "Comprobante emitido y entregado.",
  },
  failed: {
    label: "Con error",
    tone: "danger",
    description: "El proceso se detuvo y necesita revisión.",
  },
  cancelled: { label: "Cancelado", tone: "neutral" },
  canceled: { label: "Cancelado", tone: "neutral" },
};

/** Estados de pago que el backend considera "requiere atención". */
export const PAYMENT_ATTENTION_STATUSES = ["afip_pending", "pdf_pending", "drive_pending", "sheets_pending", "failed"] as const;

/** Estados de pago que implican factura ya emitida en ARCA (CAE obtenido). */
export const PAYMENT_ISSUED_STATUSES = ["pdf_pending", "drive_pending", "sheets_pending", "complete"] as const;

export function isPaymentInvoiceIssued(status: string | null | undefined) {
  return Boolean(status && (PAYMENT_ISSUED_STATUSES as readonly string[]).includes(status.toLowerCase()));
}

export function paymentNeedsAttention(status: string | null | undefined, error?: string | null) {
  if (!status) return false;
  const value = status.toLowerCase();
  return (PAYMENT_ATTENTION_STATUSES as readonly string[]).includes(value) || (value === "processing" && Boolean(error));
}

/** Eventos del historial de un pago (PaymentEvent.type). */
export const PAYMENT_EVENT: StatusMap = {
  payment_detected: { label: "Venta detectada en Mercado Pago", tone: "info" },
  payment_updated: { label: "Venta actualizada", tone: "neutral" },
  invoice_requested: { label: "Emisión solicitada a ARCA", tone: "info" },
  afip_ok: { label: "Comprobante emitido en ARCA", tone: "success" },
  pdf_ok: { label: "PDF generado", tone: "success" },
  drive_ok: { label: "Guardado en Google Drive", tone: "success" },
  sheets_ok: { label: "Registrado en la planilla", tone: "success" },
  retry_scheduled: { label: "Reintento programado", tone: "warning" },
  retried: { label: "Reintento", tone: "info" },
  failed: { label: "Error", tone: "danger" },
  note_added: { label: "Nota", tone: "neutral" },
};

/* -------------------------------------------------------------------------- */
/* Comprobantes (Invoice)                                                     */
/* -------------------------------------------------------------------------- */

export const INVOICE_STATUS: StatusMap = {
  DRAFT: { label: "Borrador", tone: "neutral", description: "Todavía no se envió a emitir." },
  PENDING_CONFIRMATION: {
    label: "Pendiente de confirmar",
    tone: "warning",
    description: "Revisala y confirmala para que se emita en ARCA.",
  },
  QUEUED: { label: "Programada", tone: "info", description: "Lista para emitirse en ARCA." },
  ISSUING: { label: "Emitiendo", tone: "info", description: "ARCA está procesando el comprobante." },
  ISSUED: { label: "Emitida", tone: "success", description: "ARCA autorizó el comprobante y asignó el CAE." },
  FAILED: { label: "Con error", tone: "danger", description: "ARCA no autorizó el comprobante. Se puede reintentar." },
  // El backend todavía no tiene este estado (la anulación es una nota de crédito);
  // queda listo para cuando la factura anulada se marque como tal.
  CANCELED: { label: "Anulada", tone: "danger", description: "Se anuló con una nota de crédito." },
};

export const INVOICE_SOURCE: StatusMap = {
  AUTOMATIC: { label: "Automática", tone: "neutral", description: "Venta de Mercado Pago facturada sola." },
  CONFIRMATION: { label: "Con confirmación", tone: "neutral", description: "Venta de Mercado Pago que se emite cuando la confirmás." },
  MANUAL: { label: "Manual", tone: "neutral", description: "Cargada a mano desde el portal." },
  OCR: { label: "Desde documento", tone: "neutral", description: "Generada a partir de un documento." },
};

export const INVOICE_TYPE: StatusMap = {
  INVOICE: { label: "Factura", tone: "neutral" },
  CREDIT_NOTE: { label: "Nota de crédito", tone: "neutral" },
};

export const INVOICE_EVENT: StatusMap = {
  CREATED: { label: "Comprobante creado", tone: "neutral" },
  STATUS_CHANGED: { label: "Cambio de estado", tone: "neutral" },
  ISSUANCE_REQUESTED: { label: "Emisión solicitada a ARCA", tone: "info" },
  ISSUED: { label: "Emitido en ARCA", tone: "success" },
  FAILED: { label: "Error de emisión", tone: "danger" },
  RETRY_SCHEDULED: { label: "Reintento programado", tone: "warning" },
  RETRIED: { label: "Reintento", tone: "info" },
  DOCUMENT_CREATED: { label: "Documento generado", tone: "success" },
  NOTE_ADDED: { label: "Nota", tone: "neutral" },
};

/* -------------------------------------------------------------------------- */
/* Puesta en marcha y datos fiscales                                          */
/* -------------------------------------------------------------------------- */

/** Solicitudes de puesta en marcha (onboarding submissions). */
export const ONBOARDING_STATUS: StatusMap = {
  pending: { label: "En revisión", tone: "warning", description: "Estamos revisando los datos enviados." },
  approved: { label: "Aprobada", tone: "success" },
  rejected: { label: "Requiere cambios", tone: "danger", description: "Hay datos para corregir antes de seguir." },
};

/** Estado operativo calculado de una empresa (lista de clientes del admin). */
export const TENANT_READINESS: StatusMap = {
  ready: { label: "Listo para facturar", tone: "success" },
  with_warnings: { label: "Con advertencias", tone: "warning" },
  missing_profile: { label: "Faltan datos fiscales", tone: "warning" },
  profile_review: { label: "Datos fiscales en revisión", tone: "info" },
  missing_plan: { label: "Sin plan", tone: "warning" },
  missing_arca: { label: "Falta conectar ARCA", tone: "warning" },
  missing_mp: { label: "Falta conectar Mercado Pago", tone: "warning" },
  integration_error: { label: "Error en integraciones", tone: "danger" },
  suspended: { label: "Suspendida", tone: "danger" },
};

/** TenantFiscalProfile.approvalStatus */
export const FISCAL_PROFILE_STATUS: StatusMap = {
  DRAFT: { label: "Sin enviar", tone: "neutral", description: "Los datos fiscales todavía no se enviaron a revisión." },
  PENDING: { label: "En revisión", tone: "warning", description: "Los datos fiscales esperan aprobación." },
  APPROVED: { label: "Aprobados", tone: "success" },
  REJECTED: { label: "Requieren cambios", tone: "danger" },
};

/* -------------------------------------------------------------------------- */
/* Suscripción                                                                */
/* -------------------------------------------------------------------------- */

/** Subscription.status */
export const SUBSCRIPTION_STATUS: StatusMap = {
  ACTIVE: { label: "Al día", tone: "success" },
  PAST_DUE: { label: "Pago pendiente", tone: "warning", description: "No pudimos cobrar la última cuota del plan." },
  CANCELED: { label: "Cancelada", tone: "danger", description: "La suscripción no está activa." },
};

/**
 * Subscription.billingStatusRaw (estado de la suscripción en Mercado Pago).
 * Valores: los de preapproval de MP, `provider_pending` (alta sin adhesión) o
 * `payment:<estado>` cuando falla un cobro (ver getStatus).
 */
export const BILLING_STATUS: StatusMap = {
  authorized: { label: "Débito automático activo", tone: "success" },
  paused: { label: "Débito automático pausado", tone: "neutral" },
  pending: { label: "Esperando la adhesión de la tarjeta", tone: "warning" },
  cancelled: { label: "Débito automático cancelado", tone: "neutral" },
  canceled: { label: "Débito automático cancelado", tone: "neutral" },
  provider_pending: { label: "Falta adherir el medio de pago", tone: "warning" },
};

/* -------------------------------------------------------------------------- */
/* Empresas, usuarios e integraciones                                         */
/* -------------------------------------------------------------------------- */

export const TENANT_STATUS: StatusMap = {
  ACTIVE: { label: "Activa", tone: "success" },
  DISABLED: { label: "Suspendida", tone: "danger" },
};

/** AdminUser.status y TenantUser.status */
export const USER_STATUS: StatusMap = {
  ACTIVE: { label: "Activo", tone: "success" },
  DISABLED: { label: "Desactivado", tone: "neutral" },
};

/**
 * Salud de integraciones: valores globales del dashboard
 * (healthy/attention/setup_pending/unknown) y por integración de una empresa
 * (configured/missing_config/disabled).
 */
export const INTEGRATION_HEALTH: StatusMap = {
  healthy: { label: "Operativo", tone: "success" },
  attention: { label: "Con problemas", tone: "danger" },
  setup_pending: { label: "Sin configurar", tone: "warning" },
  unknown: { label: "Sin datos", tone: "neutral" },
  configured: { label: "Configurada", tone: "success" },
  missing_config: { label: "Falta configurar", tone: "warning" },
  disabled: { label: "Desactivada", tone: "neutral" },
};

export const ADMIN_ROLE: StatusMap = {
  SUPERADMIN: { label: "Superadministrador", tone: "info" },
  OPERATOR: { label: "Operador", tone: "neutral" },
  VIEWER: { label: "Solo lectura", tone: "neutral" },
};

export const TENANT_USER_ROLE: StatusMap = {
  owner: { label: "Dueño", tone: "info" },
  admin: { label: "Administrador", tone: "neutral" },
  approver: { label: "Aprobador", tone: "neutral" },
  viewer: { label: "Solo lectura", tone: "neutral" },
};

/** TenantAuditLog.action */
export const AUDIT_ACTION: StatusMap = {
  tenant_profile_approved: { label: "Datos fiscales aprobados", tone: "success" },
  tenant_profile_rejected: { label: "Datos fiscales rechazados", tone: "danger" },
  tenant_onboarding_approved: { label: "Puesta en marcha aprobada", tone: "success" },
  tenant_onboarding_rejected: { label: "Puesta en marcha con cambios pedidos", tone: "warning" },
  tenant_note_created: { label: "Nota agregada", tone: "neutral" },
  payment_reprocess_requested: { label: "Reproceso solicitado", tone: "info" },
  payment_google_delivery_requested: { label: "Reenvío a Google solicitado", tone: "info" },
  operational_alert_claimed: { label: "Alerta tomada", tone: "info" },
  operational_alert_released: { label: "Alerta liberada", tone: "neutral" },
  manual_invoice_created: { label: "Factura manual creada", tone: "info" },
  invoice_confirmed: { label: "Factura confirmada", tone: "success" },
  invoice_scheduled: { label: "Emisión programada", tone: "info" },
  invoice_credit_note_requested: { label: "Anulación con nota de crédito", tone: "warning" },
};

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

export const STATUS_KINDS = {
  payment: PAYMENT_STATUS,
  paymentEvent: PAYMENT_EVENT,
  invoice: INVOICE_STATUS,
  invoiceSource: INVOICE_SOURCE,
  invoiceType: INVOICE_TYPE,
  invoiceEvent: INVOICE_EVENT,
  onboarding: ONBOARDING_STATUS,
  tenantReadiness: TENANT_READINESS,
  fiscalProfile: FISCAL_PROFILE_STATUS,
  subscription: SUBSCRIPTION_STATUS,
  billing: BILLING_STATUS,
  tenant: TENANT_STATUS,
  userStatus: USER_STATUS,
  integrationHealth: INTEGRATION_HEALTH,
  adminRole: ADMIN_ROLE,
  tenantUserRole: TENANT_USER_ROLE,
  auditAction: AUDIT_ACTION,
} satisfies Record<string, StatusMap>;

export type StatusKind = keyof typeof STATUS_KINDS;

/** Lo que se muestra cuando el backend manda un valor que no conocemos. */
const FALLBACKS: Record<StatusKind, StatusPresentation> = {
  payment: { label: "En proceso", tone: "info" },
  paymentEvent: { label: "Actividad", tone: "neutral" },
  invoice: { label: "En proceso", tone: "info" },
  invoiceSource: { label: "Otro origen", tone: "neutral" },
  invoiceType: { label: "Comprobante", tone: "neutral" },
  invoiceEvent: { label: "Actividad", tone: "neutral" },
  onboarding: { label: "En revisión", tone: "neutral" },
  tenantReadiness: { label: "Sin datos", tone: "neutral" },
  fiscalProfile: { label: "Sin datos", tone: "neutral" },
  subscription: { label: "Sin datos", tone: "neutral" },
  billing: { label: "Débito automático en revisión", tone: "info" },
  tenant: { label: "Sin datos", tone: "neutral" },
  userStatus: { label: "Sin datos", tone: "neutral" },
  integrationHealth: { label: "Sin datos", tone: "neutral" },
  adminRole: { label: "Sin rol", tone: "neutral" },
  tenantUserRole: { label: "Sin rol", tone: "neutral" },
  auditAction: { label: "Otra acción", tone: "neutral" },
};

const EMPTY: StatusPresentation = { label: "Sin estado", tone: "neutral" };

function lookup(map: StatusMap, value: string) {
  return map[value] ?? map[value.toLowerCase()] ?? map[value.toUpperCase()];
}

/** Etiqueta, tono y descripción de un estado. Nunca devuelve el enum crudo. */
export function getStatus(kind: StatusKind, value: string | null | undefined): StatusPresentation {
  if (value === null || value === undefined || String(value).trim() === "") return EMPTY;
  const raw = String(value).trim();
  const found = lookup(STATUS_KINDS[kind], raw);
  if (found) return found;

  if (kind === "billing" && raw.toLowerCase().startsWith("payment:")) {
    return { label: "Último cobro rechazado", tone: "danger", description: "Mercado Pago no pudo cobrar la cuota. Revisá el medio de pago." };
  }
  return FALLBACKS[kind];
}

export function getStatusLabel(kind: StatusKind, value: string | null | undefined) {
  return getStatus(kind, value).label;
}

export function getStatusTone(kind: StatusKind, value: string | null | undefined) {
  return getStatus(kind, value).tone;
}

/* Compatibilidad con lib/portalStatusLabels.ts ----------------------------- */

export function getPaymentStatusLabel(status: string | null | undefined) {
  return getStatusLabel("payment", status);
}

export function getPaymentEventLabel(type: string | null | undefined) {
  if (!type) return "Actividad";
  return getStatusLabel("paymentEvent", type);
}

/** Pluraliza con el conteo: plural(1, "venta", "ventas") → "1 venta". */
export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
