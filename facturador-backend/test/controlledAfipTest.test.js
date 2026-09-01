import test from "node:test";
import assert from "node:assert/strict";
import { buildControlledAfipError, CONTROLLED_AFIP_ERROR } from "../src/domain/controlledAfipTest.js";

const homologation = {
  ENV: "homologation",
  WSAA_URL: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  WSFE_URL: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
};

test("la falla ARCA controlada solo responde para el pago sintetico", () => {
  assert.deepEqual(
    buildControlledAfipError(
      { testFault: "afip_error_once" },
      { payment_method_id: "test_flow" },
      homologation
    ),
    { error: CONTROLLED_AFIP_ERROR }
  );
});

test("la falla controlada no se activa sin flag", () => {
  assert.equal(buildControlledAfipError({}, { payment_method_id: "test_flow" }, homologation), null);
});

test("la falla controlada rechaza pagos reales y configuracion productiva", () => {
  assert.throws(
    () => buildControlledAfipError(
      { testFault: "afip_error_once" },
      { payment_method_id: "credit_card" },
      homologation
    ),
    /solo admite pagos test_flow/
  );
  assert.throws(
    () => buildControlledAfipError(
      { testFault: "afip_error_once" },
      { payment_method_id: "test_flow" },
      { ...homologation, ENV: "production" }
    ),
    /solo admite pagos test_flow/
  );
});
