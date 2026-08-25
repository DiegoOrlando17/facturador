import crypto from "crypto";

const SCRYPT_KEYLEN = 64;
const PASSWORD_PREFIX = "scrypt";

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (error, derivedKey) => {
      if (error) return reject(error);
      return resolve(derivedKey);
    });
  });
}

export async function hashPassword(password) {
  const normalized = String(password || "");
  if (normalized.length < 8) {
    throw new Error("La password debe tener al menos 8 caracteres");
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(normalized, salt);
  return `${PASSWORD_PREFIX}:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password, storedHash) {
  const normalized = String(storedHash || "");
  const [prefix, saltB64, hashB64] = normalized.split(":");

  if (prefix !== PASSWORD_PREFIX || !saltB64 || !hashB64) {
    throw new Error("Formato de passwordHash invalido");
  }

  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scryptAsync(String(password || ""), salt);

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
