import { PublicRequestError } from "./publicRegistration.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Pedido de recuperación: el email es obligatorio; el identificador de empresa, opcional. */
export function normalizePasswordResetRequest(body = {}) {
  const email = String(body.email || "").trim().toLowerCase();
  const tenantSlug = String(body.tenantSlug || "").trim().toLowerCase() || null;
  if (!EMAIL_PATTERN.test(email) || email.length > 160) {
    throw new PublicRequestError("Revisá el email: no parece válido.", { code: "INVALID_EMAIL" });
  }
  return { email, tenantSlug };
}

export function normalizePasswordResetConfirm(body = {}) {
  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token) {
    throw new PublicRequestError("El enlace está incompleto. Abrilo de nuevo desde el email o pedí uno nuevo.", { code: "RESET_INVALID" });
  }
  if (password.length < 8 || password.length > 128) {
    throw new PublicRequestError("La contraseña tiene que tener entre 8 y 128 caracteres.", { code: "INVALID_PASSWORD" });
  }
  return { token, password };
}

/**
 * Estado de un enlace de recuperación: invalid | used | expired | pending.
 * Un enlace de un usuario que ya no está activo se trata como inválido.
 */
export function classifyPasswordReset(reset, now = new Date()) {
  if (!reset || reset.tenantUser?.status !== "ACTIVE") return "invalid";
  if (reset.usedAt) return "used";
  if (reset.expiresAt <= now) return "expired";
  return "pending";
}
