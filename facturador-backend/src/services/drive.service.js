import fs from "fs";
import { google } from "googleapis";
import logger from "../utils/logger.js";

/**
 * @param {string} pdfPath
 * @param {string} filename
 * @param {{ accessToken: string, folderId: string }} opts
 */
export async function uploadToDrive(pdfPath, filename, opts = {}) {
  try {
    const { accessToken, folderId } = opts;
    if (!accessToken || !folderId) return null;

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: "application/pdf",
        body: fs.createReadStream(pdfPath),
      },
      fields: "id, webViewLink",
    });

    return response.data;
  } catch (error) {
    logger.error("Error en el uploadToDrive: " + error);
    return null;
  }
}
