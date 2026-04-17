import crypto from "crypto";
import { config } from "../config/index.js";

const ENC_PREFIX = "enc:v1";

function getKey() {
  return crypto
    .createHash("sha256")
    .update(String(config.SECRETS.MASTER_KEY || "default-master-key"))
    .digest();
}

export function encryptJson(value) {
  const plaintext = JSON.stringify(value ?? {});
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENC_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptJson(payload) {
  if (!payload) return {};

  if (!String(payload).startsWith(`${ENC_PREFIX}:`)) {
    return JSON.parse(payload);
  }

  const [, , ivB64, tagB64, cipherB64] = String(payload).split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, "base64url")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

export function maskSecrets(value) {
  if (Array.isArray(value)) {
    return value.map(maskSecrets);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const secretish = /token|secret|key|password|sign|cert/i;
  return Object.fromEntries(
    Object.entries(value).map(([key, current]) => {
      if (secretish.test(key) && typeof current === "string" && current.length > 0) {
        const suffix = current.slice(-4);
        return [key, `***${suffix}`];
      }
      return [key, maskSecrets(current)];
    })
  );
}
