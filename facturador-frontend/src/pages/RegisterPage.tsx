import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type Plan = { code: string; name: string; price: number | null; currency: string };

type Result = {
  tenantSlug: string;
  email: string;
  verificationRequired: boolean;
  emailSent: boolean;
  billingStatus: string;
  verificationToken?: string;
};

const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 50;

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Deriva el identificador a partir del nombre comercial ("Panadería Luna" → "panaderia-luna"). */
function slugFromName(value: string) {
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** Sanea lo que escribe la persona sin impedirle tipear un guion al final mientras escribe. */
function sanitizeTypedSlug(value: string) {
  return stripAccents(value.toLowerCase())
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

function buildLoginUrl(slug: string, email: string) {
  const params = new URLSearchParams({ empresa: slug, email });
  return `/portal-cliente/login?${params.toString()}`;
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    slug: "",
    email: "",
    password: "",
    planCode: params.get("plan") || "TIER_1",
    acceptedTerms: false,
  });

  useEffect(() => {
    void apiRequest<{ items: Plan[] }>("/public/plans")
      .then((value) => setPlans(value.items))
      .catch(() => setError("No pudimos cargar los planes. Recargá la página para intentar de nuevo."));
  }, []);

  function handleBusinessNameChange(value: string) {
    setForm((current) => ({
      ...current,
      businessName: value,
      slug: slugTouched ? current.slug : slugFromName(value),
    }));
  }

  function handleSlugChange(value: string) {
    const sanitized = sanitizeTypedSlug(value);
    setSlugTouched(sanitized.length > 0);
    setForm((current) => ({ ...current, slug: sanitized }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const slug = form.slug.replace(/-+$/g, "");
    try {
      setResult(await apiRequest<Result>("/public/register", { method: "POST", body: { ...form, slug } }));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No pudimos crear la cuenta. Probá de nuevo en unos minutos."));
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const devToken = import.meta.env.DEV ? result.verificationToken : undefined;
    return (
      <main className="public-form-page">
        <section className="public-form-card">
          <span className="eyebrow">Cuenta creada</span>
          <h1>Verificá tu email para ingresar</h1>
          <p>
            Creamos el espacio de tu empresa con el identificador <strong>{result.tenantSlug}</strong>. Lo vas a usar
            junto con tu email para ingresar al portal.
          </p>
          <p>La suscripción queda pendiente hasta que conectes el medio de cobro.</p>
          {result.verificationRequired ? (
            <>
              <p role="status">
                {result.emailSent
                  ? `Te mandamos un enlace de verificación a ${result.email}. Abrilo para activar tu cuenta.`
                  : "No pudimos enviarte el email de verificación. Pedí uno nuevo desde acá abajo."}
              </p>
              {devToken ? (
                <div className="dev-only-note">
                  <p>Modo desarrollo: podés verificar sin abrir el email.</p>
                  <Link className="primary-button" to={`/verificar-email?token=${encodeURIComponent(devToken)}`}>
                    Verificar email (solo desarrollo)
                  </Link>
                </div>
              ) : null}
              <ResendVerificationForm
                initialEmail={result.email}
                title="¿No te llegó el email?"
                description="Revisá la carpeta de spam o pedí un enlace nuevo."
              />
            </>
          ) : null}
          <Link className="secondary-button" to={buildLoginUrl(result.tenantSlug, result.email)}>
            Ir a ingresar
          </Link>
        </section>
      </main>
    );
  }

  const slugPreview = form.slug.replace(/-+$/g, "");

  return (
    <main className="public-form-page">
      <form className="public-form-card" onSubmit={(event) => void submit(event)}>
        <Link className="public-back-link" to="/">
          ← Volver
        </Link>
        <span className="eyebrow">Alta autoservicio</span>
        <h1>Creá el espacio de tu empresa</h1>
        <label className="field">
          <span>Nombre comercial</span>
          <input
            required
            minLength={2}
            maxLength={120}
            autoComplete="organization"
            value={form.businessName}
            onChange={(event) => handleBusinessNameChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Identificador de empresa</span>
          <input
            required
            minLength={SLUG_MIN_LENGTH}
            maxLength={SLUG_MAX_LENGTH}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Usá al menos 3 caracteres: letras minúsculas, números y guiones."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="register-slug-help"
            value={form.slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            onBlur={() => setForm((current) => ({ ...current, slug: current.slug.replace(/-+$/g, "") }))}
          />
          <small id="register-slug-help" className="field-help">
            {slugPreview.length >= SLUG_MIN_LENGTH ? (
              <>
                Lo vas a usar para ingresar: <strong>{slugPreview}</strong>
              </>
            ) : (
              "Lo vas a usar para ingresar. Mínimo 3 caracteres: letras minúsculas, números y guiones."
            )}
          </small>
        </label>
        <label className="field">
          <span>Email del responsable</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            required
            minLength={8}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            aria-describedby="register-password-help"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <small id="register-password-help" className="field-help">
            Mínimo 8 caracteres.
          </small>
        </label>
        <label className="field">
          <span>Plan</span>
          <select value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })}>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name}
                {plan.price == null ? " · precio a confirmar" : ` · ${plan.currency} ${plan.price}`}
              </option>
            ))}
          </select>
        </label>
        <label className="public-consent">
          <input
            required
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })}
          />
          <span>
            Acepto los{" "}
            <Link to="/terminos" target="_blank" rel="noopener">
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link to="/privacidad" target="_blank" rel="noopener">
              política de privacidad
            </Link>
            .
          </span>
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Creando cuenta..." : "Crear cuenta"}
        </button>
        <p>
          ¿Ya tenés cuenta?{" "}
          <Link className="public-inline-link" to="/portal-cliente/login">
            Ingresá al portal
          </Link>
        </p>
      </form>
    </main>
  );
}
