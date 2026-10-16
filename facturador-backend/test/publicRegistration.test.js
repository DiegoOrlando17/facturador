import test from "node:test";
import assert from "node:assert/strict";
import { classifyContactVerification, normalizePublicRegistration, PublicRequestError, shouldExposeDevVerification } from "../src/domain/publicRegistration.js";

test("normaliza un registro publico valido", () => {
  assert.deepEqual(normalizePublicRegistration({ businessName: " Mi negocio ", slug: "Mi-Negocio", email: "OWNER@EXAMPLE.COM", password: "password-segura", planCode: "tier_2", acceptedTerms: true }), { businessName: "Mi negocio", slug: "mi-negocio", email: "owner@example.com", password: "password-segura", planCode: "TIER_2" });
});

test("rechaza registro sin consentimiento", () => {
  assert.throws(() => normalizePublicRegistration({ businessName: "Mi negocio", slug: "mi-negocio", email: "owner@example.com", password: "password-segura", planCode: "TIER_1" }), /aceptar/);
});

test("los errores de registro son legibles y no mencionan campos internos", () => {
  const base = { businessName: "Mi negocio", slug: "mi-negocio", email: "owner@example.com", password: "password-segura", planCode: "TIER_1", acceptedTerms: true };
  const cases = [
    { ...base, businessName: "x" },
    { ...base, slug: "p" },
    { ...base, slug: "-mal-" },
    { ...base, email: "no-es-email" },
    { ...base, password: "corta" },
    { ...base, planCode: "GOLD" },
  ];
  for (const payload of cases) {
    assert.throws(() => normalizePublicRegistration(payload), (error) => {
      assert.ok(error instanceof PublicRequestError);
      assert.equal(error.status, 400);
      assert.doesNotMatch(error.message, /businessName|slug|password|planCode|tenant/);
      return true;
    });
  }
});

test("el token de verificacion solo se expone con EXPOSE_DEV_VERIFICATION=true", () => {
  assert.equal(shouldExposeDevVerification({ EXPOSE_DEV_VERIFICATION: "true" }), true);
  assert.equal(shouldExposeDevVerification({}), false);
  assert.equal(shouldExposeDevVerification({ EXPOSE_DEV_VERIFICATION: "1" }), false);
  assert.equal(shouldExposeDevVerification({ NODE_ENV: "development" }), false);
});

test("clasifica el estado del enlace de verificacion", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  assert.equal(classifyContactVerification(null, now), "invalid");
  assert.equal(classifyContactVerification({ verifiedAt: new Date("2026-10-14T00:00:00Z"), expiresAt: new Date("2026-10-13T00:00:00Z") }, now), "already_verified");
  assert.equal(classifyContactVerification({ verifiedAt: null, expiresAt: new Date("2026-10-15T11:59:59Z") }, now), "expired");
  assert.equal(classifyContactVerification({ verifiedAt: null, expiresAt: new Date("2026-10-16T00:00:00Z") }, now), "pending");
});

test("registro y reenvio usan contadores de rate limit separados", async () => {
  const { createRateLimit } = await import("../src/routes/public.routes.js");
  const register = createRateLimit({ max: 2 });
  const resend = createRateLimit({ max: 2 });
  const req = { ip: "10.0.0.1" };
  const run = (limiter) => {
    let status = 200;
    let nextCalled = false;
    const res = { status(code) { status = code; return this; }, json() { return this; } };
    limiter(req, res, () => { nextCalled = true; });
    return nextCalled ? 200 : status;
  };
  assert.equal(run(register), 200);
  assert.equal(run(register), 200);
  assert.equal(run(register), 429);
  assert.equal(run(resend), 200);
});
