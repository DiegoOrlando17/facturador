import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND } from "@/config/brand";

type LocationState = { from?: { pathname?: string } };

// El backend responde con este mensaje (code EMAIL_NOT_VERIFIED) solo si la
// contraseña es correcta y la cuenta todavía no verificó el email.
function isUnverifiedMessage(message: string) {
  return /no verificaste tu email/i.test(message);
}

export function ClientLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { isBootstrapping, login, sessionNotice, user } = useTenantAuth();
  const initialSlug = params.get("empresa") ?? "";
  const initialEmail = params.get("email") ?? "";
  const [tenantSlug, setTenantSlug] = useState(initialSlug);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/portal-cliente";

  if (isBootstrapping) return null;
  if (user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setNeedsVerification(false);
    setIsSubmitting(true);
    const result = await login({ tenantSlug: tenantSlug.trim().toLowerCase(), email: email.trim(), password, remember });
    setIsSubmitting(false);
    if (!result.ok) {
      const message = result.message ?? "No pudimos iniciar sesión. Probá de nuevo.";
      setErrorMessage(message);
      setNeedsVerification(isUnverifiedMessage(message));
      return;
    }
    navigate(redirectTo, { replace: true });
  }

  return (
    <main className="login-page client-login-page">
      <section className="login-content">
        <div className="login-brand-row">
          <BrandMark size="lg" subtitle="Portal del cliente" />
        </div>
        <section className="login-hero">
          <h1>
            Tu facturación y tus pagos, <strong>en un solo lugar</strong>
          </h1>
          <p>Consultá la actividad fiscal de tu empresa con acceso seguro y separado del panel administrativo.</p>
        </section>
      </section>
      <section className="login-card-wrapper">
        <div className="login-card">
          <div className="login-card-heading">
            <h2>Ingresar</h2>
            <p>Usá el identificador de tu empresa, tu email y tu contraseña.</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Identificador de empresa</span>
              <input
                required
                name="empresa"
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.target.value)}
                placeholder="mi-empresa"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus={Boolean(initialSlug && initialEmail)}
              />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Recordar esta sesión</span>
            </label>
            {sessionNotice && !errorMessage ? (
              <p className="login-status-message" role="status">
                {sessionNotice}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <button className="primary-button primary-button--full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando…" : "Ingresar al portal"}
            </button>
          </form>
          {needsVerification ? <ResendVerificationForm initialEmail={email.trim()} /> : null}
          <p className="login-help-line">
            ¿Todavía no tenés cuenta?{" "}
            <Link className="public-inline-link" to="/registro">
              Creá tu cuenta
            </Link>
          </p>
        </div>
      </section>
      <footer className="login-legal">
        <span>&copy; 2026 {BRAND.name}</span>
        <Link to="/terminos">Términos y condiciones</Link>
        <Link to="/privacidad">Política de privacidad</Link>
        <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
      </footer>
    </main>
  );
}
