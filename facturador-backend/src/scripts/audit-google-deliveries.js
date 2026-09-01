import { google } from "googleapis";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { db } from "../models/db.js";
import { auditGoogleDeliveries } from "../services/googleDeliveryAudit.service.js";
import { getGoogleInvoiceContext, getTenantSheetsContext } from "../services/tenantGoogle.service.js";
import { resolveTenantIdBySlug } from "../services/tenantConfig.service.js";

async function listDriveFiles(auth, folderId) {
  const drive = google.drive({ version: "v3", auth });
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${String(folderId).replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name)",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

async function readSheetIds(auth, spreadsheetId, sheetName) {
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });
  return response.data.values || [];
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("tenant", { type: "string", demandOption: true, describe: "Slug del tenant" })
    .strict()
    .parse();
  const tenantSlug = String(argv.tenant).trim();
  const tenantId = await resolveTenantIdBySlug(tenantSlug);

  const driveContext = await getGoogleInvoiceContext(tenantId);
  const sheetsContext = await getTenantSheetsContext(tenantId);
  if (!driveContext || !sheetsContext) {
    throw new Error("El tenant no tiene Drive y Sheets habilitados/configurados completamente");
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: driveContext.accessToken });

  const [payments, driveFiles, sheetValues] = await Promise.all([
    db.payment.findMany({
      where: { tenantId },
      select: {
        provider_payment_id: true,
        sheets_row: true,
        invoice: {
          select: {
            documents: {
              where: { type: "PDF", storageProvider: "GOOGLE_DRIVE", status: "AVAILABLE" },
              select: { externalId: true, fileName: true },
            },
          },
        },
      },
    }),
    listDriveFiles(auth, driveContext.driveFolderId),
    readSheetIds(auth, sheetsContext.sheetsId, sheetsContext.sheetName),
  ]);

  const report = auditGoogleDeliveries({
    payments: payments.map((payment) => ({
      providerPaymentId: payment.provider_payment_id,
      sheetsRow: payment.sheets_row,
      driveDocuments: payment.invoice?.documents || [],
    })),
    driveFiles,
    sheetValues,
  });

  console.log(JSON.stringify({ tenant: tenantSlug, readOnly: true, ...report }, null, 2));
  if (!report.ok) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, readOnly: true, error: error?.message || String(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
