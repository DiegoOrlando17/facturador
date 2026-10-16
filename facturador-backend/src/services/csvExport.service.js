import { formatToLocalTime } from "../utils/date.js";

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";

  const normalized = value instanceof Date
    ? value.toISOString()
    : String(value);

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }

  return normalized;
}

function buildCsv(headers, rows) {
  const lines = [
    headers.map((header) => escapeCsvValue(header)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

export function buildPaymentsCsv(items, { includeTenant = false } = {}) {
  const headers = [
    ...(includeTenant ? ["tenant_id", "tenant_slug", "tenant_name"] : []),
    "payment_id",
    "provider",
    "provider_payment_id",
    "status",
    "amount",
    "currency",
    "customer",
    "customer_doc_type",
    "customer_doc_number",
    "payment_method_id",
    "date_approved",
    "cbte_nro",
    "cbte_tipo",
    "pto_vta",
    "cae",
    "cae_vto",
    "pdf_path",
    "drive_file_link",
    "sheets_row",
    "error",
    "created_at",
    "updated_at",
  ];

  const rows = items.map((payment) => [
    ...(includeTenant ? [
      payment.tenant?.id ?? payment.tenantId ?? "",
      payment.tenant?.slug ?? "",
      payment.tenant?.name ?? "",
    ] : []),
    payment.id,
    payment.provider,
    payment.provider_payment_id,
    payment.status,
    payment.amount,
    payment.currency,
    payment.customer,
    payment.customer_doc_type,
    payment.customer_doc_number,
    payment.payment_method_id,
    payment.date_approved ? formatToLocalTime(payment.date_approved) : "",
    payment.cbte_nro,
    payment.cbte_tipo,
    payment.pto_vta,
    payment.cae,
    payment.cae_vto,
    payment.pdf_path,
    payment.drive_file_link,
    payment.sheets_row,
    payment.error,
    payment.createdAt,
    payment.updatedAt,
  ]);

  return buildCsv(headers, rows);
}

// CSV del portal: para abrir directo en Excel en Argentina (";" como separador,
// coma decimal, BOM UTF-8), con encabezados y estados en castellano.

const PORTAL_PAYMENT_STATUS = {
  pending: "Venta recibida",
  processing: "En proceso",
  afip_pending: "Esperando ARCA",
  pdf_pending: "Facturada",
  drive_pending: "Facturada",
  sheets_pending: "Facturada",
  complete: "Facturada",
  failed: "Con error",
};

const PORTAL_PAYMENT_METHODS = {
  account_money: "Dinero en cuenta",
  debit_card: "Tarjeta de débito",
  credit_card: "Tarjeta de crédito",
  visa: "Visa",
  debvisa: "Visa Débito",
  master: "Mastercard",
  debmaster: "Mastercard Débito",
  maestro: "Maestro",
  amex: "American Express",
  cabal: "Cabal",
  debcabal: "Cabal Débito",
  naranja: "Naranja X",
  cvu: "Transferencia (CVU)",
  qr: "QR",
};

const portalDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires",
});

function escapePortalCsvValue(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value);
  return /[";\n\r]/.test(normalized) ? `"${normalized.replace(/"/g, "\"\"")}"` : normalized;
}

function formatPortalAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2).replace(".", ",") : "";
}

function formatPortalDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : portalDateFormatter.format(date).replace(",", "");
}

export function buildPortalPaymentsCsv(items) {
  const headers = ["Fecha", "Operación Mercado Pago", "Medio de pago", "Importe", "Moneda", "Cliente", "Tipo de documento", "Documento", "Estado", "Comprobante", "CAE", "Vencimiento CAE", "Detalle del error"];
  const rows = items.map((payment) => [
    formatPortalDate(payment.date_approved ?? payment.createdAt),
    payment.provider_payment_id,
    PORTAL_PAYMENT_METHODS[String(payment.payment_method_id || "").toLowerCase()] ?? payment.payment_method_id ?? "",
    formatPortalAmount(payment.amount),
    payment.currency || "ARS",
    payment.customer || "Consumidor final",
    payment.customer_doc_type,
    payment.customer_doc_number,
    PORTAL_PAYMENT_STATUS[payment.status] ?? payment.status,
    payment.cbte_nro,
    payment.cae,
    payment.cae_vto,
    payment.error,
  ]);
  const lines = [headers, ...rows].map((row) => row.map(escapePortalCsvValue).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
