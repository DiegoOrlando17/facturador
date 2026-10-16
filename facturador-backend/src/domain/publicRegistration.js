const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Error pensado para mostrarse tal cual al usuario final del sitio publico.
 * Los mensajes no mencionan nombres de campos internos.
 */
export class PublicRequestError extends Error {
  constructor(message, { code = "INVALID_REQUEST", status = 400 } = {}) {
    super(message);
    this.name = "PublicRequestError";
    this.code = code;
    this.status = status;
  }
}

export function normalizePublicRegistration(body = {}) {
  const businessName = String(body.businessName || "").trim();
  const slug = String(body.slug || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const planCode = String(body.planCode || "").trim().toUpperCase();
  const acceptedTerms = body.acceptedTerms === true;

  if (businessName.length < 2 || businessName.length > 120) {
    throw new PublicRequestError("El nombre comercial tiene que tener entre 2 y 120 caracteres.", { code: "INVALID_BUSINESS_NAME" });
  }
  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 50) {
    throw new PublicRequestError("El identificador de empresa tiene que tener entre 3 y 50 caracteres: letras minúsculas, números y guiones (sin guiones al principio ni al final).", { code: "INVALID_SLUG" });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 160) {
    throw new PublicRequestError("Revisá el email: no parece válido.", { code: "INVALID_EMAIL" });
  }
  if (password.length < 8 || password.length > 128) {
    throw new PublicRequestError("La contraseña tiene que tener entre 8 y 128 caracteres.", { code: "INVALID_PASSWORD" });
  }
  if (!/^TIER_[1-4]$/.test(planCode)) {
    throw new PublicRequestError("Elegí uno de los planes disponibles.", { code: "INVALID_PLAN" });
  }
  if (!acceptedTerms) {
    throw new PublicRequestError("Para crear la cuenta tenés que aceptar los términos y la política de privacidad.", { code: "TERMS_NOT_ACCEPTED" });
  }

  return { businessName, slug, email, password, planCode };
}

/**
 * Estado de un enlace de verificacion de contacto:
 * invalid | already_verified | expired | pending.
 */
export function classifyContactVerification(verification, now = new Date()) {
  if (!verification) return "invalid";
  if (verification.verifiedAt) return "already_verified";
  if (verification.expiresAt <= now) return "expired";
  return "pending";
}

/**
 * El token de verificacion solo se devuelve en la respuesta HTTP cuando se
 * habilita explicitamente para desarrollo local. Nunca depende de NODE_ENV.
 */
export function shouldExposeDevVerification(env = process.env) {
  return env.EXPOSE_DEV_VERIFICATION === "true";
}
