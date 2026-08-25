import crypto from "crypto";
import { config } from "../config/index.js";

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeBase64Url(value) {
  return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
}

function signPayload(encodedHeader, encodedPayload) {
  return crypto
    .createHmac("sha256", String(config.AUTH.ADMIN_TOKEN_SECRET))
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
}

export function createAdminToken(adminUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(adminUser.id),
    email: String(adminUser.email),
    role: String(adminUser.role),
    iat: now,
    exp: now + (config.AUTH.ADMIN_TOKEN_TTL_HOURS * 60 * 60),
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeBase64Url(header);
  const encodedPayload = encodeBase64Url(payload);
  const signature = signPayload(encodedHeader, encodedPayload);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAdminToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Token admin invalido");
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = signPayload(encodedHeader, encodedPayload);

  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");

  if (
    signatureBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Firma de token admin invalida");
  }

  const header = decodeBase64Url(encodedHeader);
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    throw new Error("Header de token admin invalido");
  }

  const payload = decodeBase64Url(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new Error("Token admin expirado");
  }

  return payload;
}
