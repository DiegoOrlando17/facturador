import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublicRegistration } from "../src/domain/publicRegistration.js";

test("normaliza un registro publico valido", () => {
  assert.deepEqual(normalizePublicRegistration({ businessName: " Mi negocio ", slug: "Mi-Negocio", email: "OWNER@EXAMPLE.COM", password: "password-segura", planCode: "tier_2", acceptedTerms: true }), { businessName: "Mi negocio", slug: "mi-negocio", email: "owner@example.com", password: "password-segura", planCode: "TIER_2" });
});

test("rechaza registro sin consentimiento", () => {
  assert.throws(() => normalizePublicRegistration({ businessName: "Mi negocio", slug: "mi-negocio", email: "owner@example.com", password: "password-segura", planCode: "TIER_1" }), /aceptar/);
});
