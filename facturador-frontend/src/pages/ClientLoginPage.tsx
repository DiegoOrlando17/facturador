import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { AuthAside, AuthLayout, AuthPoints } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { PasswordField, TextField } from "@/components/ui/Field";

type LocationState = { from?: { pathname?: string } };

// El backend responde con este mensaje (code EMAIL_NOT_VERIFIED) solo si la
// contraseña es correcta y la cuenta todavía no verificó el email.
function isUnverifiedMessage(message: string) {
  return /no verificaste tu email/i.test(message);
}

const POINTS = [
  { title: "Tus comprobantes", text: "Cada factura con su CAE y su PDF, para descargar cuando quieras." },
  { title: "Tus cobros", text: "Qué venta ya se facturó y cuál está esperando." },
  { title: "Tu puesta en marcha", text: "Datos fiscales e integraciones, paso a paso." },
];

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

  const forgotParams = new URLSearchParams();
  if (tenantSlug.trim()) forgotParams.set("empresa", tenantSlug.trim().toLowerCase());
  if (email.trim()) forgotParams.set("email", email.trim());
  const forgotQuery = forgotParams.toString();

  return (
    <AuthLayout
      subtitle="Portal del cliente"
      title="Ingresar"
      description="Usá el identificador de tu empresa, tu email y tu contraseña."
      aside={
        <AuthAside
          headline={
            <>
              Tu facturación y tus cobros, <strong>en un solo lugar.</strong>
            </>
          }
          lead="Mirá qué se facturó, descargá los comprobantes y seguí la puesta en marcha de tu empresa."
        >
          <AuthPoints items={POINTS} />
        </AuthAside>
      }
      footer={
        <p>
          ¿Todavía no tenés cuenta?{" "}
          <Link className="auth-link" to="/registro">
            Creá tu cuenta
          </Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <TextField
          label="Identificador de empresa"
          hint="Lo elegiste al crear la cuenta. Ejemplo: kiosco-don-luis."
          required
          name="empresa"
          value={tenantSlug}
          onChange={(event) => setTenantSlug(event.target.value)}
          placeholder="mi-empresa"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="usuario@empresa.com"
          autoComplete="username"
        />
        <PasswordField
          label="Contraseña"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus={Boolean(initialSlug && initialEmail)}
        />
        <div className="auth-form__row">
          <label className="auth-check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Recordar esta sesión</span>
          </label>
          <Link className="auth-link" to={`/recuperar-contrasena${forgotQuery ? `?${forgotQuery}` : ""}`}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {errorMessage ? (
          <Callout tone="danger" role="alert">
            {errorMessage}
          </Callout>
        ) : sessionNotice ? (
          <Callout tone="info" role="status">
            {sessionNotice}
          </Callout>
        ) : null}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting} loadingLabel="Ingresando…">
          Ingresar al portal
        </Button>
      </form>
      {needsVerification ? <ResendVerificationForm initialEmail={email.trim()} /> : null}
    </AuthLayout>
  );
}
