import logger from "../utils/logger.js";

import { google } from "googleapis";
import { getAccessToken } from "./google-auth.js";
import { config } from "../config/index.js";

/**
 * @param {unknown[]} values
 * @param {{ accessToken?: string, spreadsheetId?: string, sheetName?: string }} [opts]
 * @returns {Promise<{ row: string | null } | null>}
 */
export async function appendRow(values, opts = {}) {
  try {
    const accessToken = opts.accessToken ?? (await getAccessToken());
    if (!accessToken) {
      return null;
    }

    const spreadsheetId = opts.spreadsheetId ?? config.GOOGLE.SHEETS_ID;
    const sheetName = opts.sheetName ?? config.GOOGLE.SHEET_NAME ?? "Hoja1";

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: "v4", auth });
    const range = `${sheetName}!A1`;

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [values],
      },
    });

    const updatedRange = response?.data?.updates?.updatedRange ?? null;
    return { row: updatedRange };
  }
  catch (err) {
    logger.error("Error en el appendRow: " + err);
    return null;
  }
}
