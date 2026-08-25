import { updatePayment } from "../models/Payment.js";
import { formatToLocalTime } from "../utils/date.js";
import { logPaymentEvent } from "./paymentEvent.service.js";
import { upsertRow } from "./sheets.service.js";
import { getTenantSheetsContext } from "./tenantGoogle.service.js";

function buildPaymentSheetRow(payment, { status, error = null } = {}) {
  return [
    payment.provider_payment_id?.toString() ?? "",
    payment.cbte_nro ?? "",
    payment.date_approved ? formatToLocalTime(payment.date_approved) : "",
    payment.amount ?? "",
    payment.customer || "Consumidor Final",
    payment.cae ?? "",
    payment.cae_vto ?? "",
    status,
    payment.drive_file_link ?? "",
    error ?? "",
  ];
}

export async function syncPaymentToSheets(tenantId, payment, { status, error = null } = {}) {
  const sheetsContext = await getTenantSheetsContext(tenantId);
  if (!sheetsContext) return { synced: false, reason: "not_enabled_or_incomplete" };

  const result = await upsertRow(buildPaymentSheetRow(payment, { status, error }), {
    accessToken: sheetsContext.accessToken,
    spreadsheetId: sheetsContext.sheetsId,
    sheetName: sheetsContext.sheetName,
    row: payment.sheets_row,
  });

  if (!result) return { synced: false, reason: "write_failed" };

  payment.sheets_row = result.row;
  await updatePayment(tenantId, payment.id, { sheets_row: result.row });
  await logPaymentEvent(tenantId, payment.id, "sheets_ok", `Estado ${status} sincronizado en Sheets`, {
    row: result.row,
    status,
  });

  return { synced: true, row: result.row };
}
