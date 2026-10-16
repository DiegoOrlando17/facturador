import test from "node:test";
import assert from "node:assert/strict";
import { validateTenantProfileInput } from "../src/services/tenantPortal.service.js";

test("perfil tenant acepta CUIT y emails validos", () => {
  assert.doesNotThrow(() => validateTenantProfileInput({
    cuit: "30-71902252-5",
    ivaCondition: "monotributo",
    contactEmail: "fiscal@empresa.com",
    responsibleEmail: "responsable@empresa.com.ar",
  }));
});

test("perfil tenant rechaza CUIT incompleto o con digito verificador incorrecto", () => {
  assert.throws(() => validateTenantProfileInput({ cuit: "307190" }), /11 dígitos/);
  assert.throws(() => validateTenantProfileInput({ cuit: "30-71902252-4" }), /dígito verificador/);
});

test("perfil tenant rechaza emails invalidos", () => {
  assert.throws(() => validateTenantProfileInput({ contactEmail: "correo-invalido" }), /no parece válido/);
});

test("perfil tenant no acepta consumidor final como condicion del emisor", () => {
  assert.throws(() => validateTenantProfileInput({ ivaCondition: "consumidor_final" }), /condición frente al IVA/);
});
