import test from "node:test";
import assert from "node:assert/strict";
import {
  isMaskedSecretValue,
  mergeMaskedIntegrationSecrets,
} from "../src/services/tenantConfig.service.js";
import { maskSecrets } from "../src/utils/crypto.js";

const storedAfip = {
  CUIT: "20123456789",
  PTO_VTA: 3,
  CBTE_TIPO: 11,
  CERT_B64: "LS0tLS1CRUdJTi1DRVJULWFiY2Q=",
  KEY_B64: "LS0tLS1CRUdJTi1LRVktd3h5eg==",
};

test("detecta valores enmascarados", () => {
  assert.equal(isMaskedSecretValue("***abcd"), true);
  assert.equal(isMaskedSecretValue("abcd***"), false);
  assert.equal(isMaskedSecretValue(""), false);
  assert.equal(isMaskedSecretValue(123), false);
});

test("un secreto enmascarado que coincide conserva el valor real guardado", () => {
  const stored = { ACCESS_TOKEN: "APP_USR-real-token-9876", POS_ID: "POS1" };
  const submitted = { ...maskSecrets(stored), POS_ID: "POS2" };

  const merged = mergeMaskedIntegrationSecrets(stored, submitted);

  assert.deepEqual(merged, { ACCESS_TOKEN: "APP_USR-real-token-9876", POS_ID: "POS2" });
});

test("los secretos omitidos o vacíos conservan el valor guardado", () => {
  const merged = mergeMaskedIntegrationSecrets(storedAfip, {
    CUIT: "20123456789",
    PTO_VTA: 4,
    CBTE_TIPO: 11,
    KEY_B64: "",
  });

  assert.equal(merged.CERT_B64, storedAfip.CERT_B64);
  assert.equal(merged.KEY_B64, storedAfip.KEY_B64);
  assert.equal(merged.PTO_VTA, 4);
});

test("un secreto nuevo reemplaza al guardado", () => {
  const merged = mergeMaskedIntegrationSecrets(storedAfip, {
    ...maskSecrets(storedAfip),
    CERT_B64: "bnVldm8tY2VydGlmaWNhZG8=",
  });

  assert.equal(merged.CERT_B64, "bnVldm8tY2VydGlmaWNhZG8=");
  assert.equal(merged.KEY_B64, storedAfip.KEY_B64);
});

test("rechaza un valor enmascarado que no coincide con lo guardado", () => {
  assert.throws(
    () => mergeMaskedIntegrationSecrets(storedAfip, { CERT_B64: "***zzzz" }),
    /CERT_B64: el valor enmascarado no coincide/,
  );
});

test("rechaza un valor enmascarado cuando no hay nada guardado", () => {
  assert.throws(
    () => mergeMaskedIntegrationSecrets({}, { ACCESS_TOKEN: "***1234", POS_ID: "POS1" }),
    /ACCESS_TOKEN/,
  );
});

test("no agrega claves no secretas que el admin omitió", () => {
  const merged = mergeMaskedIntegrationSecrets(
    { ACCESS_TOKEN: "token-real", POS_ID: "POS1", RUNS_PER_DAY: 4, POLLING_MODE: "scheduled" },
    { ACCESS_TOKEN: "***real", POS_ID: "POS1", POLLING_MODE: "realtime", POLLING_INTERVAL_MS: 5000 },
  );

  assert.deepEqual(merged, {
    ACCESS_TOKEN: "token-real",
    POS_ID: "POS1",
    POLLING_MODE: "realtime",
    POLLING_INTERVAL_MS: 5000,
  });
});

test("tolera configuraciones inválidas sin romper", () => {
  assert.deepEqual(mergeMaskedIntegrationSecrets(null, undefined), {});
  assert.deepEqual(mergeMaskedIntegrationSecrets(undefined, { POS_ID: "A" }), { POS_ID: "A" });
});
