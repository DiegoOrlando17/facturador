import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { AppIcon } from "@/components/ui/AppIcon";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authNotice, clearAuthNotice, isAuthenticated, isBootstrapping, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as LocationState | null;
  const redirectTo = state?.from?.pathname ?? "/";

  if (isBootstrapping) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    clearAuthNotice();

    const result = await login({ email, password, remember });

    if (!result.ok) {
      setErrorMessage(result.message ?? "No se pudo iniciar sesion.");
      setIsSubmitting(false);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <main className="login-page">
      <div className="login-background-mark" aria-hidden="true" />
      <section className="login-content">
        <div className="login-brand-row">
          <span className="login-logo" aria-hidden="true">
            <svg viewBox="0 0 48 56" role="img">
              <path d="M12 4h22l10 10v34a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" />
              <path d="M34 4v12h10" />
              <path d="M17 28h10M17 38h7" />
              <circle cx="35" cy="36" r="9" />
              <path d="m31 36 3 3 6-7" />
            </svg>
          </span>
          <div>
            <strong>Facturador</strong>
            <span>Portal de gestion fiscal y cobranzas</span>
          </div>
        </div>

        <section className="login-hero">
          <h1>
            Gestiona tus facturas, pagos y <strong>datos fiscales</strong> en un solo lugar
          </h1>
          <p>
            Consulta comprobantes emitidos, estados de cuenta e integraciones activas desde un portal simple,
            seguro y siempre disponible.
          </p>

          <div className="login-feature-list">
            <article>
              <span className="login-feature-icon login-feature-icon--blue" aria-hidden="true">
                <AppIcon name="invoice" />
              </span>
              <strong>Pagos y facturas</strong>
              <p>Consulta cobros recibidos y comprobantes emitidos.</p>
            </article>
            <article>
              <span className="login-feature-icon login-feature-icon--green" aria-hidden="true">
                <AppIcon name="tax" />
              </span>
              <strong>Datos fiscales</strong>
              <p>Manten tu informacion actualizada para operar sin demoras.</p>
            </article>
            <article>
              <span className="login-feature-icon login-feature-icon--violet" aria-hidden="true">
                <AppIcon name="reports" />
              </span>
              <strong>Estado de cuenta</strong>
              <p>Revisa pendientes, integraciones y avances del servicio.</p>
            </article>
          </div>

          <div className="login-security-note">
            <span aria-hidden="true">
              <AppIcon name="shield" />
            </span>
            <p>Tus datos estan protegidos y se procesan de forma segura.</p>
          </div>
        </section>
      </section>

      <section className="login-card-wrapper">
        <div className="login-card">
          <div className="login-card-heading">
            <h2>Iniciar sesion</h2>
            <p>Accede a tu portal de gestion.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <div className="login-input-wrap">
                <AppIcon name="mail" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </div>
            </label>

            <label className="field">
              <span>Contrasena</span>
              <div className="login-input-wrap">
                <AppIcon name="lock" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                />
                <AppIcon name="help" />
              </div>
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>Recordar esta sesion en este navegador</span>
            </label>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            {!errorMessage && authNotice ? (
              <p className="login-status-message login-status-message--success">
                <span aria-hidden="true">
                  <AppIcon name="check-circle" />
                </span>
                {authNotice}
              </p>
            ) : null}

            <button type="submit" className="primary-button primary-button--full" disabled={isSubmitting}>
              <span>{isSubmitting ? "Ingresando..." : "Ingresar al portal"}</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </form>

          <div className="login-help-line">
            <span aria-hidden="true">
              <AppIcon name="help" />
            </span>
            <p>Necesitas ayuda para ingresar? <a href="mailto:soporte@dorlando.com">Contacta a soporte.</a></p>
          </div>
        </div>
      </section>

      <footer className="login-legal">
        <span>&copy; 2026 Facturador. Todos los derechos reservados.</span>
        <a href="/login">Terminos y condiciones</a>
        <a href="/login">Politica de privacidad</a>
      </footer>
    </main>
  );
}
