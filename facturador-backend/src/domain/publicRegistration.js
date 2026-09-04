const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizePublicRegistration(body = {}) {
  const businessName = String(body.businessName || "").trim();
  const slug = String(body.slug || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const planCode = String(body.planCode || "").trim().toUpperCase();
  const acceptedTerms = body.acceptedTerms === true;

  if (businessName.length < 2 || businessName.length > 120) throw new Error("businessName debe tener entre 2 y 120 caracteres");
  if (!SLUG_PATTERN.test(slug) || slug.length < 3 || slug.length > 50) throw new Error("slug debe tener entre 3 y 50 caracteres y usar letras, numeros o guiones");
  if (!EMAIL_PATTERN.test(email) || email.length > 160) throw new Error("email invalido");
  if (password.length < 8 || password.length > 128) throw new Error("password debe tener entre 8 y 128 caracteres");
  if (!/^TIER_[1-4]$/.test(planCode)) throw new Error("planCode invalido");
  if (!acceptedTerms) throw new Error("Debes aceptar los terminos y la politica de privacidad");

  return { businessName, slug, email, password, planCode };
}
