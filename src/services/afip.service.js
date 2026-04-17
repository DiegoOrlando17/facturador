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

/**
 * Combina JSON de TenantIntegration (AFIP) con defaults del proceso (.env).
 * @param {Record<string, unknown>} afipCfg
 */
export function normalizeAfipConfig(afipCfg = {}) {
  const cuit = String(afipCfg.CUIT ?? config.CUIT ?? "").replace(/\D/g, "");
  const ptoVta = Number(afipCfg.PTO_VTA ?? config.AFIP.PTO_VTA);
  const cbteTipo = Number(afipCfg.CBTE_TIPO ?? config.AFIP.CBTE_TIPO);
  const alicIva = Number(afipCfg.ALIC_IVA ?? config.AFIP.ALIC_IVA ?? 21);
  const wsaaUrl = afipCfg.WSAA_URL || config.AFIP.WSAA_URL;
  const wsfeUrl = afipCfg.WSFE_URL || config.AFIP.WSFE_URL;
  return {
    ...afipCfg,
    CUIT: cuit,
    PTO_VTA: ptoVta,
    CBTE_TIPO: cbteTipo,
    ALIC_IVA: alicIva,
    WSAA_URL: wsaaUrl,
    WSFE_URL: wsfeUrl,
    CERT_PATH: afipCfg.CERT_PATH ?? config.AFIP.CERT,
    KEY_PATH: afipCfg.KEY_PATH ?? config.AFIP.KEY,
    CERT_B64: afipCfg.CERT_B64,
    KEY_B64: afipCfg.KEY_B64,
  };
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
  if (!merged.CUIT) {
    logger.error("getLastInvoiceAFIP: CUIT vacío tras normalizar config");
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

export async function createInvoiceAFIP(cbteNro, paymentTotal, afipCfg) {
  try {
    const merged = normalizeAfipConfig(afipCfg);
    if (!merged.CUIT) {
      return { error: "CUIT AFIP vacío o inválido" };
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
