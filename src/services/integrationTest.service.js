import axios from "axios";
import { getLastInvoiceAFIP, normalizeAfipConfig } from "./afip.service.js";
import { normalizeMpConfig } from "./mercadopago.service.js";
import { config } from "../config/index.js";

function summarizeMpPayment(payment) {
  if (!payment) return null;

  return {
    id: payment.id ? String(payment.id) : null,
    status: payment.status ?? null,
    date_approved: payment.date_approved ?? null,
    pos_id: payment.pos_id ?? null,
    operation_type: payment.operation_type ?? null,
    transaction_amount: payment.transaction_amount ?? null,
    currency_id: payment.currency_id ?? null,
    payment_method_id: payment.payment_method?.id ?? payment.payment_method_id ?? null,
    payer_email: payment.payer?.email ?? null,
  };
}

async function fetchLatestMercadopagoPayment(cfg, { posId = null } = {}) {
  const limit = 50;
  const maxPages = posId ? 20 : 1;
  let latestAny = null;
  let latestForPos = null;
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await axios.get(`${cfg.API_URL}/payments/search`, {
      headers: { Authorization: `Bearer ${cfg.ACCESS_TOKEN}` },
      params: {
        status: "approved",
        sort: "date_approved",
        criteria: "desc",
        limit,
        offset,
      },
      timeout: 30000,
    });

    const results = res.data.results || [];
    if (!latestAny && results.length > 0) {
      latestAny = results[0];
    }

    if (posId) {
      latestForPos = results.find((payment) =>
        payment.pos_id !== null && String(payment.pos_id) === String(posId)
      );
      if (latestForPos) break;
    }

    if (results.length < limit) break;
    offset += limit;
  }

  return { latestAny, latestForPos };
}

export async function testMercadopagoConnection(mpCfg = {}) {
  const cfg = normalizeMpConfig(mpCfg);
  if (!cfg.ACCESS_TOKEN) throw new Error("MERCADOPAGO.ACCESS_TOKEN es obligatorio");

  const requestedPosId = Object.prototype.hasOwnProperty.call(mpCfg, "POS_ID") && String(mpCfg.POS_ID || "").trim()
    ? String(mpCfg.POS_ID).trim()
    : null;
  const { latestAny, latestForPos } = await fetchLatestMercadopagoPayment(cfg, {
    posId: requestedPosId,
  });

  const matchedPayment = requestedPosId ? latestForPos : latestAny;
  const warnings = [];

  if (requestedPosId && !latestForPos) {
    warnings.push("El access token es valido, pero no se encontraron pagos aprobados para el POS_ID indicado.");
  }

  if (!latestAny) {
    warnings.push("El access token es valido, pero no se encontraron pagos aprobados.");
  }

  return {
    ok: true,
    provider: "MERCADOPAGO",
    connected: true,
    requestedPosId: requestedPosId ? String(requestedPosId) : null,
    posMatched: requestedPosId ? Boolean(latestForPos) : null,
    latestPayment: summarizeMpPayment(matchedPayment),
    latestAnyPayment: requestedPosId && !latestForPos ? summarizeMpPayment(latestAny) : null,
    warnings,
  };
}

export async function testAfipConnection(afipCfg = {}) {
  if (!String(afipCfg.CUIT || "").trim()) throw new Error("AFIP.CUIT es obligatorio");
  if (!afipCfg.PTO_VTA) throw new Error("AFIP.PTO_VTA es obligatorio");
  if (!afipCfg.CBTE_TIPO) throw new Error("AFIP.CBTE_TIPO es obligatorio");

  const cfg = normalizeAfipConfig(afipCfg);

  const lastCbteNro = await getLastInvoiceAFIP(cfg, cfg.PTO_VTA, cfg.CBTE_TIPO);
  if (lastCbteNro === null || lastCbteNro === undefined || Number.isNaN(Number(lastCbteNro))) {
    throw new Error("No se pudo consultar el ultimo comprobante autorizado en AFIP");
  }

  return {
    ok: true,
    provider: "AFIP",
    connected: true,
    cuit: cfg.CUIT,
    ptoVta: cfg.PTO_VTA,
    cbteTipo: cfg.CBTE_TIPO,
    lastCbteNro,
    nextCbteNro: Number(lastCbteNro) + 1,
    warnings: [],
  };
}

async function getGoogleAccessToken(googleCfg = {}) {
  const clientId = googleCfg.CLIENT_ID ?? config.GOOGLE.CLIENT_ID;
  const clientSecret = googleCfg.CLIENT_SECRET ?? config.GOOGLE.CLIENT_SECRET;
  const refreshToken = googleCfg.REFRESH_TOKEN;

  if (!refreshToken) throw new Error("GOOGLE.REFRESH_TOKEN es obligatorio");
  if (!clientId) throw new Error("GOOGLE.CLIENT_ID es obligatorio");
  if (!clientSecret) throw new Error("GOOGLE.CLIENT_SECRET es obligatorio");

  const response = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
    timeout: 30000,
  });

  return response.data.access_token;
}

export async function testDriveConnection(driveCfg = {}) {
  const accessToken = await getGoogleAccessToken(driveCfg);
  const folderId = driveCfg.DRIVE_FOLDER_ID ?? driveCfg.FOLDER_ID ?? null;

  if (folderId) {
    const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        fields: "id,name,mimeType",
        supportsAllDrives: true,
      },
      timeout: 30000,
    });

    return {
      ok: true,
      provider: "DRIVE",
      connected: true,
      checkedResource: "Carpeta Drive",
      folderName: response.data.name ?? null,
      warnings: [],
    };
  }

  const response = await axios.get("https://www.googleapis.com/drive/v3/files", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      pageSize: 1,
      fields: "files(id,name)",
      supportsAllDrives: true,
    },
    timeout: 30000,
  });

  return {
    ok: true,
    provider: "DRIVE",
    connected: true,
    checkedResource: "Listado de Drive",
    sampleFile: response.data.files?.[0]?.name ?? null,
    warnings: folderId ? [] : ["No se informo carpeta Drive; se probo acceso general."],
  };
}

export async function testSheetsConnection(sheetsCfg = {}) {
  const accessToken = await getGoogleAccessToken(sheetsCfg);
  const spreadsheetId = sheetsCfg.SHEETS_ID ?? sheetsCfg.SPREADSHEET_ID ?? sheetsCfg.SHEET_ID ?? null;

  if (!spreadsheetId) {
    return {
      ok: true,
      provider: "SHEETS",
      connected: true,
      checkedResource: "Token Google",
      warnings: ["No se informo Spreadsheet ID; se valido solamente el refresh token."],
    };
  }

  const response = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      fields: "spreadsheetId,properties(title)",
    },
    timeout: 30000,
  });

  return {
    ok: true,
    provider: "SHEETS",
    connected: true,
    checkedResource: "Google Sheets",
    spreadsheetTitle: response.data.properties?.title ?? null,
    warnings: [],
  };
}

export async function testIntegrationConnection(provider, config = {}) {
  const normalizedProvider = String(provider || "").trim().toUpperCase();

  if (normalizedProvider === "MERCADOPAGO") {
    return testMercadopagoConnection(config);
  }

  if (normalizedProvider === "AFIP") {
    return testAfipConnection(config);
  }

  if (normalizedProvider === "DRIVE") {
    return testDriveConnection(config);
  }

  if (normalizedProvider === "SHEETS") {
    return testSheetsConnection(config);
  }

  throw new Error(`Test de conexion no implementado para ${normalizedProvider}`);
}
