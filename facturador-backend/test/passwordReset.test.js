import test from "node:test";
import assert from "node:assert/strict";
import { classifyPasswordReset, normalizePasswordResetConfirm, normalizePasswordResetRequest } from "../src/domain/passwordReset.js";
import { PublicRequestError } from "../src/domain/publicRegistration.js";
import { buildPasswordResetEmail } from "../src/services/email.service.js";

test("normaliza el pedido de recuperacion con empresa opcional", () => {
  assert.deepEqual(normalizePasswordResetRequest({ email: " OWNER@Example.com " }), { email: "owner@example.com", tenantSlug: null });
  assert.deepEqual(normalizePasswordResetRequest({ email: "owner@example.com", tenantSlug: " Mi-Empresa " }), { email: "owner@example.com", tenantSlug: "mi-empresa" });
});

test("rechaza pedidos y confirmaciones invalidas con errores publicos", () => {
  const cases = [
    () => normalizePasswordResetRequest({ email: "no-es-email" }),
    () => normalizePasswordResetConfirm({ token: "", password: "password-segura" }),
    () => normalizePasswordResetConfirm({ token: "abc", password: "corta" }),
  ];
  for (const run of cases) {
    assert.throws(run, (error) => {
      assert.ok(error instanceof PublicRequestError);
      assert.equal(error.status, 400);
      assert.doesNotMatch(error.message, /token|password|tenant/);
      return true;
    });
  }
});

test("clasifica el estado del enlace de recuperacion", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const future = new Date("2026-10-16T13:00:00Z");
  const past = new Date("2026-10-16T11:00:00Z");
  const active = { status: "ACTIVE" };
  assert.equal(classifyPasswordReset(null, now), "invalid");
  assert.equal(classifyPasswordReset({ expiresAt: future, usedAt: null, tenantUser: { status: "DISABLED" } }, now), "invalid");
  assert.equal(classifyPasswordReset({ expiresAt: future, usedAt: past, tenantUser: active }, now), "used");
  assert.equal(classifyPasswordReset({ expiresAt: past, usedAt: null, tenantUser: active }, now), "expired");
  assert.equal(classifyPasswordReset({ expiresAt: future, usedAt: null, tenantUser: active }, now), "pending");
});

test("el email de recuperacion incluye enlace, empresa y escapa el contenido", () => {
  const email = buildPasswordResetEmail({ businessName: "<b>Acme</b>", tenantSlug: "acme", resetUrl: "https://app.example/restablecer-contrasena?token=abc" });
  assert.match(email.text, /token=abc/);
  assert.match(email.text, /acme/);
  assert.doesNotMatch(email.html, /<b>Acme/);
  assert.match(email.html, /&lt;b&gt;Acme/);
});
