import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleOAuthState,
  mergeGoogleTenantIntegrationConfig,
  parseGoogleOAuthState,
  validateGoogleOAuthSettings,
} from "../src/services/tenantGoogle.service.js";
import { buildGoogleTokenRequest } from "../src/services/integrationTest.service.js";

test("el state Google conserva tenant y flujo firmados", () => {
  const state = buildGoogleOAuthState({
    tenantSlug: "fiebre",
    flowId: "flow-123",
    driveFolderId: "drive-folder",
    sheetsId: "sheet-id",
    sheetName: "Facturas",
  });

  const payload = parseGoogleOAuthState(state);
  assert.equal(payload.tenantSlug, "fiebre");
  assert.equal(payload.flowId, "flow-123");
  assert.equal(payload.driveFolderId, "drive-folder");
  assert.equal(payload.sheetsId, "sheet-id");
  assert.equal(payload.sheetName, "Facturas");
});

test("el state Google rechaza modificaciones", () => {
  const state = buildGoogleOAuthState({ tenantSlug: "fiebre", flowId: "flow-123" });
  const [payload, signature] = state.split(".");
  const tampered = `${payload.slice(0, -1)}A.${signature}`;

  assert.throws(() => parseGoogleOAuthState(tampered), /firma invalida/);
});

test("OAuth por tenant exige un redirect URI explicito", () => {
  assert.throws(() => validateGoogleOAuthSettings({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://old-tunnel.example/google/oauth/callback",
    redirectUriExplicit: false,
  }), /GOOGLE_REDIRECT_URI debe definirse explicitamente/);
});

test("OAuth por tenant acepta el callback local canonico", () => {
  assert.doesNotThrow(() => validateGoogleOAuthSettings({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://localhost:5000/google/oauth/callback",
    redirectUriExplicit: true,
  }));
});

test("Drive descarta tokens enviados y conserva el token cifrado del tenant", () => {
  const config = mergeGoogleTenantIntegrationConfig(
    "DRIVE",
    { REFRESH_TOKEN: "stored-token", SCOPES: ["drive"] },
    { REFRESH_TOKEN: "injected-token", CLIENT_SECRET: "injected-secret", DRIVE_FOLDER_ID: "folder" }
  );

  assert.deepEqual(config, {
    DRIVE_FOLDER_ID: "folder",
    REFRESH_TOKEN: "stored-token",
    SCOPES: ["drive"],
    TOKEN_TYPE: undefined,
  });
});

test("Sheets descarta credenciales manuales y conserva su destino", () => {
  const config = mergeGoogleTenantIntegrationConfig(
    "SHEETS",
    { REFRESH_TOKEN: "stored-token", TOKEN_TYPE: "Bearer" },
    { CLIENT_ID: "injected-client", SHEETS_ID: "sheet", SHEET_NAME: "Facturas" }
  );

  assert.equal(config.REFRESH_TOKEN, "stored-token");
  assert.equal(config.SHEETS_ID, "sheet");
  assert.equal(config.SHEET_NAME, "Facturas");
  assert.equal("CLIENT_ID" in config, false);
});

test("la prueba Google ignora credenciales enviadas por el tenant", () => {
  const tokenRequest = buildGoogleTokenRequest(
    {
      CLIENT_ID: "tenant-client-id",
      CLIENT_SECRET: "tenant-client-secret",
      REFRESH_TOKEN: "tenant-refresh-token",
    },
    {
      CLIENT_ID: "app-client-id",
      CLIENT_SECRET: "app-client-secret",
    }
  );

  assert.deepEqual(tokenRequest, {
    client_id: "app-client-id",
    client_secret: "app-client-secret",
    refresh_token: "tenant-refresh-token",
    grant_type: "refresh_token",
  });
});
