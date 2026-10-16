import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config/index.js";
import {
  createMpCredentialsGuard,
  DEFAULT_MP_API_URL,
  fetchLastPayment,
  fetchNewPayments,
  getMissingMpCredentials,
  MP_MISSING_CREDENTIALS_MESSAGE,
  normalizeMpConfig,
  requireMpCredentials,
} from "../src/services/mercadopago.service.js";
import {
  AFIP_ENDPOINTS,
  AFIP_MISSING_CREDENTIALS_MESSAGE,
  createInvoiceAFIP,
  getLastInvoiceAFIP,
  getMissingAfipCredentials,
  normalizeAfipConfig,
  resolveAfipEnvironment,
} from "../src/services/afip.service.js";

const LEGACY_CONFIG_KEYS = ["CUIT", "DEFAULT_TENANT_SLUG"];
const LEGACY_MP_KEYS = ["ACCESS_TOKEN", "PUBLIC_KEY", "POS_ID", "POLLING_INTERVAL"];
const LEGACY_AFIP_KEYS = [
  "CUIT", "PTO_VTA", "CBTE_TIPO", "ALIC_IVA", "CERT", "KEY", "TA", "TRA", "TRACMS",
  "CERT_B64", "KEY_B64", "TA_B64", "TRA_B64", "TRACMS_B64",
];

function silentLogger() {
  const warnings = [];
  return { warnings, warn: (message) => warnings.push(message) };
}

test("config ya no expone credenciales legacy de clientes", () => {
  for (const key of LEGACY_CONFIG_KEYS) assert.equal(Object.hasOwn(config, key), false, key);
  for (const key of LEGACY_MP_KEYS) assert.equal(Object.hasOwn(config.MP, key), false, `MP.${key}`);
  for (const key of LEGACY_AFIP_KEYS) assert.equal(Object.hasOwn(config.AFIP, key), false, `AFIP.${key}`);
  assert.ok(config.MP.API_URL, "MP_API_URL de plataforma con default");
});

test("normalizeMpConfig no completa credenciales desde la plataforma", () => {
  const platform = { API_URL: "https://mp.example", ACCESS_TOKEN: "env-token", POS_ID: "env-pos" };
  const cfg = normalizeMpConfig({}, platform);

  assert.equal(cfg.ACCESS_TOKEN, null);
  assert.equal(cfg.POS_ID, null);
  assert.equal(cfg.API_URL, "https://mp.example");
  assert.equal(cfg.POLLING_INTERVAL_MS, 5000);
});

test("normalizeMpConfig usa solo las credenciales del tenant y el default de API_URL", () => {
  const cfg = normalizeMpConfig({ ACCESS_TOKEN: " tenant-token ", POS_ID: 123 }, {});
  assert.equal(cfg.ACCESS_TOKEN, "tenant-token");
  assert.equal(cfg.POS_ID, "123");
  assert.equal(cfg.API_URL, DEFAULT_MP_API_URL);

  const own = normalizeMpConfig({ ACCESS_TOKEN: "t", POS_ID: "p", API_URL: "https://tenant.example" }, { API_URL: "https://mp.example" });
  assert.equal(own.API_URL, "https://tenant.example");
});

test("un tenant sin ACCESS_TOKEN o POS_ID falla con un error claro", () => {
  assert.deepEqual(getMissingMpCredentials({}), ["ACCESS_TOKEN", "POS_ID"]);
  assert.deepEqual(getMissingMpCredentials({ ACCESS_TOKEN: "t", POS_ID: "  " }), ["POS_ID"]);
  assert.deepEqual(getMissingMpCredentials({ ACCESS_TOKEN: "t", POS_ID: "p" }), []);

  assert.throws(
    () => requireMpCredentials({ POS_ID: "p" }),
    (error) => error.code === "MP_MISSING_CREDENTIALS"
      && error.message.startsWith(MP_MISSING_CREDENTIALS_MESSAGE)
      && error.message.includes("ACCESS_TOKEN"),
  );
});

test("las consultas a Mercado Pago rechazan antes de llamar a la API si faltan credenciales", async () => {
  await assert.rejects(() => fetchLastPayment({}), { code: "MP_MISSING_CREDENTIALS" });
  await assert.rejects(() => fetchNewPayments(null, { ACCESS_TOKEN: "t" }), { code: "MP_MISSING_CREDENTIALS" });
});

test("el guard del worker saltea al tenant sin credenciales, avisa una vez y no frena a los demas", () => {
  const log = silentLogger();
  const shouldSkip = createMpCredentialsGuard({ log, action: "el polling" });
  const tenants = [
    { tenantId: 1n, config: {} },
    { tenantId: 2n, config: { ACCESS_TOKEN: "t2", POS_ID: "p2" } },
  ];

  const processed = [];
  for (let loop = 0; loop < 3; loop += 1) {
    for (const row of tenants) {
      if (shouldSkip(row.tenantId, row.config)) continue;
      processed.push(row.tenantId);
    }
  }

  assert.deepEqual(processed, [2n, 2n, 2n]);
  assert.equal(log.warnings.length, 1);
  assert.match(log.warnings[0], /no tiene credenciales/);
  assert.doesNotMatch(log.warnings[0], /t2|p2/);

  tenants[0].config = { ACCESS_TOKEN: "t1", POS_ID: "p1" };
  assert.equal(shouldSkip(1n, tenants[0].config), false);
});

test("normalizeAfipConfig no completa CUIT, punto de venta ni certificado desde el .env", () => {
  const cfg = normalizeAfipConfig({}, { WSAA_URL: "https://wsaa.platform", WSFE_URL: "https://wsfe.platform" });

  assert.equal(cfg.CUIT, "");
  assert.equal(cfg.PTO_VTA, null);
  assert.equal(cfg.CBTE_TIPO, null);
  assert.equal(cfg.CERT_PATH, null);
  assert.equal(cfg.KEY_PATH, null);
  assert.equal(cfg.ALIC_IVA, 21);
  assert.equal(cfg.WSAA_URL, "https://wsaa.platform");
  assert.deepEqual(
    getMissingAfipCredentials({}).filter((field) => !field.endsWith("_URL")),
    ["CUIT", "PTO_VTA", "CBTE_TIPO", "CERT/KEY"],
  );
});

test("URLs ARCA: URLs del tenant > ENV del tenant > default de plataforma", () => {
  const platform = { WSAA_URL: "https://wsaa.platform", WSFE_URL: "https://wsfe.platform" };

  assert.equal(normalizeAfipConfig({ ENV: "prod" }, platform).WSFE_URL, AFIP_ENDPOINTS.produccion.WSFE_URL);
  assert.equal(normalizeAfipConfig({ ENV: "homologacion" }, platform).WSAA_URL, AFIP_ENDPOINTS.homologacion.WSAA_URL);
  assert.equal(normalizeAfipConfig({ ENV: "prod", WSFE_URL: "https://own" }, platform).WSFE_URL, "https://own");
  assert.equal(normalizeAfipConfig({ ENV: "desconocido" }, platform).WSFE_URL, "https://wsfe.platform");
  assert.equal(resolveAfipEnvironment("homologation"), "homologacion");
  assert.equal(resolveAfipEnvironment(""), null);
});

test("ARCA sin credenciales del tenant devuelve un error claro sin llamar al servicio", async () => {
  const partial = { CUIT: "20123456789", PTO_VTA: 1, CBTE_TIPO: 6 };

  const response = await createInvoiceAFIP(1n, 100, partial);
  assert.ok(response.error.startsWith(AFIP_MISSING_CREDENTIALS_MESSAGE));
  assert.match(response.error, /CERT\/KEY/);

  assert.equal(await getLastInvoiceAFIP({}, 1, 6), null);
});

test("ARCA acepta certificado y clave guardados con los nombres anteriores CERT/PRIVATE_KEY", () => {
  const pemCert = "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----";
  const pemKey = "-----BEGIN PRIVATE KEY-----\nBBBB\n-----END PRIVATE KEY-----";
  const fromPem = normalizeAfipConfig({ CUIT: "20111111112", PTO_VTA: 1, CBTE_TIPO: 11, ENV: "homologacion", CERT: pemCert, PRIVATE_KEY: pemKey });
  assert.equal(Buffer.from(fromPem.CERT_B64, "base64").toString("utf8"), pemCert);
  assert.equal(Buffer.from(fromPem.KEY_B64, "base64").toString("utf8"), pemKey);
  assert.deepEqual(getMissingAfipCredentials({ CUIT: "20111111112", PTO_VTA: 1, CBTE_TIPO: 11, ENV: "homologacion", CERT: pemCert, PRIVATE_KEY: pemKey }), []);

  const fromB64 = normalizeAfipConfig({ CERT: "Q0VSVA==", PRIVATE_KEY: "S0VZ" });
  assert.equal(fromB64.CERT_B64, "Q0VSVA==");
  assert.equal(fromB64.KEY_B64, "S0VZ");

  const preferNew = normalizeAfipConfig({ CERT_B64: "TkVX", CERT: pemCert, KEY_B64: "TkVXS0VZ", PRIVATE_KEY: pemKey });
  assert.equal(preferNew.CERT_B64, "TkVX");
  assert.equal(preferNew.KEY_B64, "TkVXS0VZ");
});
