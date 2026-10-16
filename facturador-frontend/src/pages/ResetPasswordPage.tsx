import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { PasswordField } from "@/components/ui/Field";
import { Stamp } from "@/components/ui/Ticket";
import { apiRequest, getApiErrorMessage, isApiError } from "@/lib/api";

type ConfirmResponse = { reset: boolean; tenantSlug: string | null; email: string };

/** Errores del enlace en sí: hay que pedir uno nuevo, no reintentar. */
const LINK_ERRORS = new Set(["RESET_INVALID", "RESET_USED", "RESET_EXPIRED"]);

function buildLoginUrl(tenantSlug?: string | null, email?: string) {
  const params = new URLSearchParams();
  if (tenantSlug) params.set("empresa", tenantSlug);
  if (email) params.set("email", email);
  const query = params.toString();
  return query ? `/portal-cliente/login?${query}` : "/portal-cliente/login";
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState(token ? "" : "El enlace está incompleto. Abrilo de nuevo desde el email o pedí uno nuevo.");
  const [done, setDone] = useState<ConfirmResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      setDone(await apiRequest<ConfirmResponse>("/public/password-reset/confirm", { method: "POST", body: { token, password } }));
    } catch (cause) {
      const message = getApiErrorMessage(cause, "No pudimos cambiar la contraseña. Probá de nuevo en unos minutos.");
      if (isApiError(cause) && cause.code && LINK_ERRORS.has(cause.code)) setLinkError(message);
      else setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (done) {
    return (
      <AuthLayout subtitle="Portal del cliente" eyebrow="Contraseña actualizada" title="Listo, ya podés ingresar">
        <div className="auth-actions">
          <Stamp label="LISTO" size="sm" />
        </div>
        <p role="status">Guardamos tu contraseña nueva. Usala la próxima vez que ingreses al portal.</p>
        <ButtonLink to={buildLoginUrl(done.tenantSlug, done.email)} variant="primary" size="lg" fullWidth>
          Ingresar al portal
        </ButtonLink>
      </AuthLayout>
    );
  }

  if (linkError) {
    return (
      <AuthLayout subtitle="Portal del cliente" title="Este enlace no sirve">
        <Callout tone="danger" role="alert">
          {linkError}
        </Callout>
        <ButtonLink to="/recuperar-contrasena" variant="primary" size="lg" fullWidth>
          Pedir un enlace nuevo
        </ButtonLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      subtitle="Portal del cliente"
      title="Elegí una contraseña nueva"
      description="Mínimo 8 caracteres. Después ingresás con ella."
      footer={
        <p>
          ¿No la querés cambiar?{" "}
          <Link className="auth-link" to="/portal-cliente/login">
            Volvé a ingresar
          </Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <PasswordField
          label="Contraseña nueva"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setMismatch(false);
          }}
        />
        <PasswordField
          label="Repetí la contraseña"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={confirmation}
          error={mismatch ? "Las contraseñas no coinciden." : undefined}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setMismatch(false);
          }}
        />
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        <Button type="submit" variant="primary" size="lg" fullWidth loading={isSaving} loadingLabel="Guardando…">
          Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  );
}
