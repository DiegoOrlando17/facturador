import path from "path";
import fs from "fs";
import os from "os";
import axios from "axios";
import logger from "../utils/logger.js";

import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { parseStringPromise } from "xml2js";
import { config } from "../config/index.js";
import { caeDueToDMY } from "../utils/date.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** TA en memoria por CUIT (y URLs de WS, por si difieren). */
const taCache = new Map();

/** Paths de cert/key materializados (p. ej. desde base64). */
const certKeyPathCache = new Map();

export const AFIP_MISSING_CREDENTIALS_MESSAGE = "La integración de ARCA del cliente no tiene credenciales";

/** Endpoints oficiales por ambiente, usados cuando el tenant define ENV. */
export const AFIP_ENDPOINTS = Object.freeze({
  homologacion: Object.freeze({
    WSAA_URL: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    WSFE_URL: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  }),
  produccion: Object.freeze({
    WSAA_URL: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    WSFE_URL: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  }),
});

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function positiveNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** "prod"/"production"/"produccion" -> produccion; "homo"/"homologacion"/"test"/"dev" -> homologacion. */
export function resolveAfipEnvironment(value) {
  const env = String(value ?? "").trim().toLowerCase();
  if (!env) return null;
  if (["prod", "production", "produccion", "producción"].includes(env)) return "produccion";
  if (["homo", "homologacion", "homologación", "homologation", "test", "testing", "dev", "sandbox"].includes(env)) return "homologacion";
  return null;
}

/**
 * Normaliza el JSON de TenantIntegration (AFIP). CUIT, punto de venta, tipo de
 * comprobante y certificado/clave salen SOLO del tenant: no hay fallback al .env.
 * URLs: WSAA_URL/WSFE_URL del tenant > ambiente ENV del tenant > default de plataforma.
 * @param {Record<string, unknown>} afipCfg
 */
export function normalizeAfipConfig(afipCfg = {}, platformConfig = config.AFIP) {
  const cfg = afipCfg && typeof afipCfg === "object" ? afipCfg : {};
  const cuit = String(cfg.CUIT ?? "").replace(/\D/g, "");
  const envEndpoints = AFIP_ENDPOINTS[resolveAfipEnvironment(cfg.ENV)] ?? null;
  const wsaaUrl = cleanString(cfg.WSAA_URL) || envEndpoints?.WSAA_URL || cleanString(platformConfig?.WSAA_URL);
  const wsfeUrl = cleanString(cfg.WSFE_URL) || envEndpoints?.WSFE_URL || cleanString(platformConfig?.WSFE_URL);
  return {
    ...cfg,
    CUIT: cuit,
    PTO_VTA: positiveNumberOrNull(cfg.PTO_VTA),
    CBTE_TIPO: positiveNumberOrNull(cfg.CBTE_TIPO),
    ALIC_IVA: Number(cfg.ALIC_IVA ?? 21),
    WSAA_URL: wsaaUrl || null,
    WSFE_URL: wsfeUrl || null,
    CERT_PATH: cleanString(cfg.CERT_PATH),
    KEY_PATH: cleanString(cfg.KEY_PATH),
    CERT_B64: cleanString(cfg.CERT_B64) || legacyPemToBase64(cfg.CERT),
    KEY_B64: cleanString(cfg.KEY_B64) || legacyPemToBase64(cfg.PRIVATE_KEY ?? cfg.KEY),
  };
}

/**
 * Integraciones cargadas antes de CERT_B64/KEY_B64 guardaron el certificado y la
 * clave como CERT/PRIVATE_KEY, en texto PEM o en base64. Se normalizan a base64.
 */
function legacyPemToBase64(value) {
  const text = cleanString(value);
  if (!text) return null;
  if (text.includes("-----BEGIN")) return Buffer.from(text, "utf8").toString("base64");
  return text;
}

/** Campos AFIP faltantes para emitir/consultar en nombre del tenant. */
export function getMissingAfipCredentials(afipCfg = {}) {
  const cfg = normalizeAfipConfig(afipCfg);
  const missing = [];
  if (!cfg.CUIT) missing.push("CUIT");
  if (!cfg.PTO_VTA) missing.push("PTO_VTA");
  if (!cfg.CBTE_TIPO) missing.push("CBTE_TIPO");
  const hasB64Pair = Boolean(cfg.CERT_B64 && cfg.KEY_B64);
  const hasPathPair = Boolean(cfg.CERT_PATH && cfg.KEY_PATH);
  if (!hasB64Pair && !hasPathPair) missing.push("CERT/KEY");
  if (!cfg.WSAA_URL) missing.push("WSAA_URL");
  if (!cfg.WSFE_URL) missing.push("WSFE_URL");
  return missing;
}

export function buildMissingAfipCredentialsError(missing) {
  const error = new Error(`${AFIP_MISSING_CREDENTIALS_MESSAGE} (falta ${missing.join(", ")})`);
  error.code = "AFIP_MISSING_CREDENTIALS";
  error.missingFields = [...missing];
  return error;
}

function taCacheKey(merged) {
  return `${merged.CUIT}|${merged.WSAA_URL}|${merged.WSFE_URL}`;
}

function getTraPaths(merged) {
  const cuit = merged.CUIT || "unknown";
  const base = path.join(os.tmpdir(), "afip-tra", cuit);
  fs.mkdirSync(base, { recursive: true });
  return {
    traPath: path.join(base, "TRA.xml"),
    traCmsPath: path.join(base, "TRA.cms"),
  };
}

function resolveCertKeyPaths(merged) {
  const cuit = merged.CUIT || "unknown";
  if (merged.CERT_B64 && merged.KEY_B64) {
    if (!certKeyPathCache.has(cuit)) {
      const base = path.join(os.tmpdir(), "afip-certs", cuit);
      fs.mkdirSync(base, { recursive: true });
      const certPath = path.join(base, "cert.crt");
      const keyPath = path.join(base, "key.key");
      fs.writeFileSync(certPath, Buffer.from(merged.CERT_B64, "base64"));
      fs.writeFileSync(keyPath, Buffer.from(merged.KEY_B64, "base64"));
      certKeyPathCache.set(cuit, { certPath, keyPath });
    }
    return certKeyPathCache.get(cuit);
  }
  if (!merged.CERT_PATH || !merged.KEY_PATH) {
    throw buildMissingAfipCredentialsError(["CERT/KEY"]);
  }
  const certPath = path.isAbsolute(merged.CERT_PATH)
    ? merged.CERT_PATH
    : path.resolve(__dirname, "../../", merged.CERT_PATH);
  const keyPath = path.isAbsolute(merged.KEY_PATH)
    ? merged.KEY_PATH
    : path.resolve(__dirname, "../../", merged.KEY_PATH);
  return { certPath, keyPath };
}

function generarTRA(merged, traPath) {
  const now = new Date();
  const genTime = new Date(now.getTime() - 600000).toISOString();
  const expTime = new Date(now.getTime() + 600000).toISOString();

  const tra = `<?xml version="1.0" encoding="UTF-8"?>
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
        <generationTime>${genTime}</generationTime>
        <expirationTime>${expTime}</expirationTime>
      </header>
      <service>wsfe</service>
    </loginTicketRequest>`;

  fs.writeFileSync(traPath, tra);
  return traPath;
}

function firmarTRA(merged) {
  const { traPath, traCmsPath } = getTraPaths(merged);
  generarTRA(merged, traPath);
  const { certPath, keyPath } = resolveCertKeyPaths(merged);
  execSync(
    `openssl cms -sign -in ${traPath} -signer ${certPath} -inkey ${keyPath} -out ${traCmsPath} -outform DER -nodetach -nosmimecap -noattr -md sha1`
  );
  const cmsDer = fs.readFileSync(traCmsPath);
  return cmsDer.toString("base64");
}

async function pedirTA(cmsB64, merged) {
  const soapEnvelope = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
    <soapenv:Header/>
    <soapenv:Body>
      <wsaa:loginCms>
        <wsaa:in0>${cmsB64}</wsaa:in0>
      </wsaa:loginCms>
    </soapenv:Body>
  </soapenv:Envelope>`;

  const response = await axios.post(merged.WSAA_URL, soapEnvelope, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    timeout: 30000,
  });

  const data = response.data;

  const parsedSoap = await parseStringPromise(data, { explicitArray: false });
  let cmsReturn =
    parsedSoap["soapenv:Envelope"]["soapenv:Body"]["loginCmsResponse"]["loginCmsReturn"];

  cmsReturn = cmsReturn.replace("<![CDATA[", "").replace("]]>", "");

  const parsedTA = await parseStringPromise(cmsReturn, { explicitArray: false });
  const ta = {
    token: parsedTA.loginTicketResponse.credentials.token,
    sign: parsedTA.loginTicketResponse.credentials.sign,
    generationTime: parsedTA.loginTicketResponse.header.generationTime,
    expirationTime: parsedTA.loginTicketResponse.header.expirationTime,
    destination: parsedTA.loginTicketResponse.header.destination,
  };

  logger.info(`✅ TA obtenido para CUIT ${merged.CUIT}`);
  return ta;
}

async function getTA(merged) {
  const key = taCacheKey(merged);
  const cached = taCache.get(key);
  if (cached && new Date(cached.expirationTime) > new Date()) {
    return cached;
  }

  logger.info("⚠️ TA ausente o vencido, generando uno nuevo...");
  const cmsB64 = firmarTRA(merged);
  const ta = await pedirTA(cmsB64, merged);
  taCache.set(key, ta);
  return ta;
}

export async function getLastInvoiceAFIP(afipCfg, PtoVta, CbteTipo) {
  const merged = normalizeAfipConfig(afipCfg);
  // PtoVta/CbteTipo llegan por parametro; del tenant se exigen CUIT, cert/clave y URLs.
  const missing = getMissingAfipCredentials(afipCfg).filter((field) => !["PTO_VTA", "CBTE_TIPO"].includes(field));
  if (missing.length > 0) {
    logger.error(`getLastInvoiceAFIP: ${buildMissingAfipCredentialsError(missing).message}`);
    return null;
  }
  try {
    const ta = await getTA(merged);

    const soapEnvelope = `
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soap:Header/>
    <soap:Body>
      <ar:FECompUltimoAutorizado>
        <ar:Auth>
          <ar:Token>${ta.token}</ar:Token>
          <ar:Sign>${ta.sign}</ar:Sign>
          <ar:Cuit>${merged.CUIT}</ar:Cuit>
        </ar:Auth>
        <ar:PtoVta>${PtoVta}</ar:PtoVta>
        <ar:CbteTipo>${CbteTipo}</ar:CbteTipo>
      </ar:FECompUltimoAutorizado>
    </soap:Body>
  </soap:Envelope>`;

    const response = await axios.post(merged.WSFE_URL, soapEnvelope, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
      },
    });

    const data = response.data;
    const parsed = await parseStringPromise(data, { explicitArray: false });
    const result =
      parsed["soap:Envelope"]["soap:Body"]["FECompUltimoAutorizadoResponse"]["FECompUltimoAutorizadoResult"];

    return Number(result?.CbteNro);
  } catch (err) {
    logger.error("No se pudo obtener el ultimo comprobante de AFIP. " + err);
    return null;
  }
}

function formatNroCbte(nroComprobante, ptoVta) {
  if (!nroComprobante) return "";
  const pv = Number(ptoVta);
  return `${pv.toString().padStart(5, "0")}-${nroComprobante.toString().padStart(8, "0")}`;
}

export function buildAssociatedVoucherXml(associatedInvoice) {
  if (!associatedInvoice) return "";
  return `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${Number(associatedInvoice.cbteTipo)}</ar:Tipo><ar:PtoVta>${Number(associatedInvoice.ptoVta)}</ar:PtoVta><ar:Nro>${Number(associatedInvoice.cbteNro)}</ar:Nro></ar:CbteAsoc></ar:CbtesAsoc>`;
}

export async function createInvoiceAFIP(cbteNro, paymentTotal, afipCfg, { associatedInvoice = null } = {}) {
  try {
    const merged = normalizeAfipConfig(afipCfg);
    const missing = getMissingAfipCredentials(afipCfg);
    if (missing.length > 0) {
      const message = buildMissingAfipCredentialsError(missing).message;
      logger.error(`createInvoiceAFIP: ${message}`);
      return { error: message };
    }

    const ta = await getTA(merged);
    const total = Number(paymentTotal).toFixed(2);
    const mult = 1 + merged.ALIC_IVA / 100;
    const neto = (Number(total) / mult).toFixed(2);
    const iva = (Number(total) - Number(neto)).toFixed(2);

    const soapEnvelope = `
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soap:Header/>
    <soap:Body>
      <ar:FECAESolicitar>
        <ar:Auth>
          <ar:Token>${ta.token}</ar:Token>
          <ar:Sign>${ta.sign}</ar:Sign>
          <ar:Cuit>${merged.CUIT}</ar:Cuit>
        </ar:Auth>
        <ar:FeCAEReq>
          <ar:FeCabReq>
            <ar:CantReg>1</ar:CantReg>
            <ar:PtoVta>${merged.PTO_VTA}</ar:PtoVta>
            <ar:CbteTipo>${merged.CBTE_TIPO}</ar:CbteTipo>
          </ar:FeCabReq>
          <ar:FeDetReq>
            <ar:FECAEDetRequest>
              <ar:Concepto>1</ar:Concepto>
              <ar:DocTipo>99</ar:DocTipo>
              <ar:DocNro>0</ar:DocNro>
              <ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>
              <ar:CbteDesde>${cbteNro}</ar:CbteDesde>
              <ar:CbteHasta>${cbteNro}</ar:CbteHasta>
              <ar:CbteFch>${new Date().toISOString().slice(0, 10).replace(/-/g, "")}</ar:CbteFch>
              <ar:ImpTotal>${total}</ar:ImpTotal>
              <ar:ImpTotConc>0.00</ar:ImpTotConc>
              <ar:ImpNeto>${neto}</ar:ImpNeto>
              <ar:ImpOpEx>0.00</ar:ImpOpEx>
              <ar:ImpIVA>${iva}</ar:ImpIVA>
              <ar:ImpTrib>0.00</ar:ImpTrib>
              <ar:MonId>PES</ar:MonId>
              <ar:MonCotiz>1.00</ar:MonCotiz>
              ${buildAssociatedVoucherXml(associatedInvoice)}
              <ar:Iva>
                <ar:AlicIva>
                    <ar:Id>5</ar:Id>
                    <ar:BaseImp>${neto}</ar:BaseImp>
                    <ar:Importe>${iva}</ar:Importe>
                </ar:AlicIva>
            </ar:Iva>
            </ar:FECAEDetRequest>
          </ar:FeDetReq>
        </ar:FeCAEReq>
      </ar:FECAESolicitar>
    </soap:Body>
  </soap:Envelope>`;

    const response = await axios.post(merged.WSFE_URL, soapEnvelope, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
      },
    });

    const data = response.data;
    const parsed = await parseStringPromise(data, { explicitArray: false });
    const result = parsed["soap:Envelope"]["soap:Body"]["FECAESolicitarResponse"]["FECAESolicitarResult"];
    const detalle = result.FeDetResp.FECAEDetResponse;
    if (detalle.Resultado === "R") {
      const errMsg = result.Errors?.Err?.Msg ?? result.Errors?.Err ?? "Error AFIP";
      const errStr = Array.isArray(errMsg)
        ? errMsg.map((e) => e.Msg ?? e).join("; ")
        : String(errMsg?.Msg ?? errMsg);
      logger.error("Error obteniendo el CAE. " + errStr);
      return { error: errStr };
    }
    const cae = detalle.CAE;
    const nroComprobante = formatNroCbte(detalle.CbteDesde, merged.PTO_VTA);
    const fechaVtoCae = caeDueToDMY(detalle.CAEFchVto);

    return { cae, nroComprobante, fechaVtoCae, error: null };
  } catch (err) {
    logger.error("Error obteniendo el CAE. " + err);
    return { error: err.toString() };
  }
}
