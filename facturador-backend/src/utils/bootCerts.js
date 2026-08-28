import fs from "fs";
import os from "os";
import path from "path";
import { config } from "../config/index.js";

function writeBase64File(filename, value) {
  const targetPath = path.join(os.tmpdir(), filename);
  fs.writeFileSync(targetPath, Buffer.from(value, "base64"), { mode: 0o600 });
  return targetPath;
}

export function writeFilesFromEnv() {
  if (config.AFIP.CERT_B64) {
    config.AFIP.CERT = writeBase64File("certificado.crt", config.AFIP.CERT_B64);
  }
  if (config.AFIP.KEY_B64) {
    config.AFIP.KEY = writeBase64File("clave.key", config.AFIP.KEY_B64);
  }
  if (config.AFIP.TRA_B64) {
    config.AFIP.TRA = writeBase64File("tra.xml", config.AFIP.TRA_B64);
  }
  if (config.AFIP.TRACMS_B64) {
    config.AFIP.TRACMS = writeBase64File("tra.cms", config.AFIP.TRACMS_B64);
  }
  if (config.AFIP.TA_B64) {
    config.AFIP.TA = writeBase64File("TA-wsfe.json", config.AFIP.TA_B64);
  }
}
