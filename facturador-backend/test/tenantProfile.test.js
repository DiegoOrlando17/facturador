import test from "node:test";
import assert from "node:assert/strict";
import { validateTenantProfileInput } from "../src/services/tenantPortal.service.js";

test("perfil tenant acepta CUIT y emails validos", () => {
  assert.doesNotThrow(() => validateTenantProfileInput({
    cuit: "30-71902252-5",
    contactEmail: "fiscal@empresa.com",
    responsibleEmail: "responsable@empresa.com.ar",
  }));
});

test("perfil tenant rechaza CUIT incompleto", () => {
  assert.throws(() => validateTenantProfileInput({ cuit: "307190" }), /11 digitos/);
});

test("perfil tenant rechaza emails invalidos", () => {
  assert.throws(() => validateTenantProfileInput({ contactEmail: "correo-invalido" }), /formato valido/);
});
