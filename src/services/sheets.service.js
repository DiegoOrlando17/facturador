import logger from "../utils/logger.js";

import { google } from "googleapis";

function columnName(columnNumber) {
  let value = columnNumber;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function normalizeStoredRowRange(rowRange, valueCount) {
  const separatorIndex = String(rowRange).lastIndexOf("!");
  if (separatorIndex < 0) return rowRange;

  const sheetPrefix = String(rowRange).slice(0, separatorIndex);
  const cellRange = String(rowRange).slice(separatorIndex + 1);
  const match = cellRange.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/i);
  if (!match || match[1] !== match[2]) return rowRange;

  return `${sheetPrefix}!A${match[1]}:${columnName(valueCount)}${match[1]}`;
}

/**
 * @param {unknown[]} values
 * @param {{ accessToken?: string, spreadsheetId?: string, sheetName?: string }} [opts]
 * @returns {Promise<{ row: string | null } | null>}
 */
export async function appendRow(values, opts = {}) {
  try {
    const accessToken = opts.accessToken;
    const spreadsheetId = opts.spreadsheetId;
    const sheetName = opts.sheetName ?? "Hoja1";
    if (!accessToken || !spreadsheetId) {
      return null;
    }

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

/**
 * Actualiza una fila conocida o agrega una nueva.
 * @param {unknown[]} values
 * @param {{ accessToken: string, spreadsheetId: string, sheetName?: string, row?: string | null }} opts
 */
export async function upsertRow(values, opts = {}) {
  if (!opts.row) return appendRow(values, opts);

  try {
    const { accessToken, spreadsheetId } = opts;
    if (!accessToken || !spreadsheetId) return null;

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: normalizeStoredRowRange(opts.row, values.length),
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });

    return { row: response?.data?.updatedRange ?? opts.row };
  } catch (error) {
    logger.error("Error en el upsertRow: " + error);
    return null;
  }
}
