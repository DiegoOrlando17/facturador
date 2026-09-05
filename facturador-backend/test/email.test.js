import test from "node:test";
import assert from "node:assert/strict";
import { buildVerificationEmail } from "../src/services/email.service.js";

test("el email de verificacion incluye alternativa texto y enlace", () => { const email = buildVerificationEmail({ businessName: "Acme", verificationUrl: "https://app.example/verificar-email?token=abc" }); assert.match(email.text, /token=abc/); assert.match(email.html, /Verificar email/); });
test("el email escapa contenido controlado por el usuario", () => { const email = buildVerificationEmail({ businessName: "<script>alert(1)</script>", verificationUrl: "https://example.com/?x=\"bad\"" }); assert.doesNotMatch(email.html, /<script>/); assert.match(email.html, /&lt;script&gt;/); assert.match(email.html, /&quot;bad&quot;/); });
