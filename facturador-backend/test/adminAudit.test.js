import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuditJson } from "../src/services/adminAudit.service.js";

test("la auditoria oculta secretos de forma recursiva", () => {
  const result = sanitizeAuditJson(JSON.stringify({
    status: "ACTIVE",
    config: { refreshToken: "token-real", client_secret: "secret-real" },
  }));

  assert.deepEqual(result, {
    status: "ACTIVE",
    config: { refreshToken: "[REDACTED]", client_secret: "[REDACTED]" },
  });
});

test("la auditoria no expone contenido historico que no sea JSON valido", () => {
  assert.deepEqual(sanitizeAuditJson("refresh_token=secret-real"), { unavailable: true });
});
