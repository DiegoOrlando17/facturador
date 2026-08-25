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
