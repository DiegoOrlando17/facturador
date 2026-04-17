import axios from "axios";
import crypto from "crypto";
import { google } from "googleapis";
import { config } from "../config/index.js";
import { getAccessToken } from "./google-auth.js";
import {
  resolveTenantIdBySlug,
  tryGetTenantIntegrationConfig,
  upsertTenantIntegrationConfig,
  listEnabledTenantsByIntegration,
} from "./tenantConfig.service.js";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
];

/** @type {Map<string, { accessToken: string, expiresAt: number }>} */
const tenantAccessTokenCache = new Map();

function createOAuthClient() {
  return new google.auth.OAuth2(
    config.GOOGLE.CLIENT_ID,
    config.GOOGLE.CLIENT_SECRET,
    config.GOOGLE.REDIRECT_URI
  );
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signState(payload) {
  return crypto
    .createHmac("sha256", config.GOOGLE.STATE_SECRET)
    .update(payload)
    .digest("base64url");
}

function parseScopes(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(" ").filter(Boolean);
  return GOOGLE_SCOPES;
}

export function buildGoogleOAuthState({
  tenantSlug,
  driveFolderId = null,
  sheetsId = null,
  sheetName = null,
}) {
  const payload = JSON.stringify({
    tenantSlug,
    driveFolderId,
    sheetsId,
    sheetName,
    issuedAt: Date.now(),
  });

  const encodedPayload = encodeBase64Url(payload);
  const signature = signState(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseGoogleOAuthState(state) {
  if (!state || !state.includes(".")) {
    throw new Error("State Google invalido");
  }

  const [encodedPayload, signature] = state.split(".");
  const expectedSignature = signState(encodedPayload);
  if (signature !== expectedSignature) {
    throw new Error("State Google con firma invalida");
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload));
  const maxAgeMs = 15 * 60 * 1000;
  if (!payload.issuedAt || Date.now() - payload.issuedAt > maxAgeMs) {
    throw new Error("State Google vencido");
  }

  return payload;
}

async function getAccessTokenFromRefreshCached(tenantId, { clientId, clientSecret, refreshToken }) {
  const cached = tenantAccessTokenCache.get(String(tenantId));
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.accessToken;
  }

  const response = await axios.post("https://oauth2.googleapis.com/token", null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
  });

  const expiresIn = (response.data.expires_in ?? 3600) * 1000;
  tenantAccessTokenCache.set(String(tenantId), {
    accessToken: response.data.access_token,
    expiresAt: Date.now() + expiresIn,
  });
  return response.data.access_token;
}

export function buildTenantGoogleAuthUrl({ tenantSlug, driveFolderId = null, sheetsId = null, sheetName = null }) {
  const oAuth2Client = createOAuthClient();
  const state = buildGoogleOAuthState({ tenantSlug, driveFolderId, sheetsId, sheetName });

  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
  });
}

export async function connectTenantGoogleFromCallback({ code, state }) {
  const payload = parseGoogleOAuthState(state);
  const tenantId = await resolveTenantIdBySlug(payload.tenantSlug);

  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  const scopes = parseScopes(tokens.scope);

  const driveExisting = await tryGetTenantIntegrationConfig(tenantId, "DRIVE");
  const sheetsExisting = await tryGetTenantIntegrationConfig(tenantId, "SHEETS");

  const sharedGoogleConfig = {
    CLIENT_ID: config.GOOGLE.CLIENT_ID,
    CLIENT_SECRET: config.GOOGLE.CLIENT_SECRET,
    REFRESH_TOKEN: tokens.refresh_token
      ?? driveExisting?.REFRESH_TOKEN
      ?? sheetsExisting?.REFRESH_TOKEN
      ?? null,
    SCOPES: scopes,
    TOKEN_TYPE: tokens.token_type ?? "Bearer",
  };

  await upsertTenantIntegrationConfig(tenantId, "DRIVE", {
    ...sharedGoogleConfig,
    DRIVE_FOLDER_ID:
      payload.driveFolderId
      ?? driveExisting?.DRIVE_FOLDER_ID
      ?? config.GOOGLE.DRIVE_FOLDER_ID
      ?? null,
  });

  await upsertTenantIntegrationConfig(tenantId, "SHEETS", {
    ...sharedGoogleConfig,
    SHEETS_ID:
      payload.sheetsId
      ?? sheetsExisting?.SHEETS_ID
      ?? config.GOOGLE.SHEETS_ID
      ?? null,
    SHEET_NAME:
      payload.sheetName
      ?? sheetsExisting?.SHEET_NAME
      ?? config.GOOGLE.SHEET_NAME
      ?? "Hoja1",
  });

  tenantAccessTokenCache.delete(String(tenantId));

  return {
    tenantId,
    tenantSlug: payload.tenantSlug,
    scopes,
  };
}

/**
 * Drive + Sheets: usa integración DRIVE/SHEETS del tenant si hay REFRESH_TOKEN;
 * si no, el token/archivo global del proceso (.env) como hasta ahora.
 */
export async function getGoogleInvoiceContext(tenantId) {
  const drive = await tryGetTenantIntegrationConfig(tenantId, "DRIVE");
  const sheets = await tryGetTenantIntegrationConfig(tenantId, "SHEETS");

  const refreshToken =
    drive?.REFRESH_TOKEN ?? sheets?.REFRESH_TOKEN ?? drive?.refresh_token ?? sheets?.refresh_token;
  const clientId = drive?.CLIENT_ID ?? sheets?.CLIENT_ID ?? config.GOOGLE.CLIENT_ID;
  const clientSecret = drive?.CLIENT_SECRET ?? sheets?.CLIENT_SECRET ?? config.GOOGLE.CLIENT_SECRET;

  const driveFolderId =
    drive?.DRIVE_FOLDER_ID ?? drive?.driveFolderId ?? config.GOOGLE.DRIVE_FOLDER_ID;
  const sheetsId =
    sheets?.SHEETS_ID ?? sheets?.spreadsheetId ?? drive?.SHEETS_ID ?? config.GOOGLE.SHEETS_ID;
  const sheetName =
    sheets?.SHEET_NAME ?? sheets?.sheetName ?? drive?.SHEET_NAME ?? config.GOOGLE.SHEET_NAME ?? "Hoja1";
  const scopes = parseScopes(drive?.SCOPES ?? sheets?.SCOPES);

  if (!refreshToken) {
    const accessToken = await getAccessToken();
    return { accessToken, driveFolderId, sheetsId, sheetName, scopes };
  }

  const accessToken = await getAccessTokenFromRefreshCached(tenantId, {
    clientId,
    clientSecret,
    refreshToken,
  });

  return { accessToken, driveFolderId, sheetsId, sheetName, scopes };
}

export async function keepGoogleConnectionsAlive() {
  const rows = [
    ...(await listEnabledTenantsByIntegration("DRIVE")),
    ...(await listEnabledTenantsByIntegration("SHEETS")),
  ];

  const seen = new Set();
  for (const row of rows) {
    const tenantKey = String(row.tenantId);
    if (seen.has(tenantKey)) continue;
    seen.add(tenantKey);
    await getGoogleInvoiceContext(row.tenantId);
  }
}
