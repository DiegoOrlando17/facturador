import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoogleOAuthState,
  parseGoogleOAuthState,
} from "../src/services/tenantGoogle.service.js";

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
