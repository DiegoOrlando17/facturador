import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { TextField } from "@/components/ui/Field";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type RequestResponse = { accepted: boolean; emailSent?: boolean; resetToken?: string };

/** Pedido de enlace para restablecer la contraseña del portal del cliente. */
export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [tenantSlug, setTenantSlug] = useState(params.get("empresa") ?? "");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setError("");
    try {
      const response = await apiRequest<RequestResponse>("/public/password-reset/request", {
        method: "POST",
        body: { email: email.trim(), tenantSlug: tenantSlug.trim().toLowerCase() || undefined },
      });
      if (response?.emailSent === false) {
        setError("No pudimos enviar el email en este momento. Probá de nuevo en unos minutos.");
      } else {
        setSentTo(email.trim());
      }
      setDevToken(import.meta.env.DEV && response?.resetToken ? response.resetToken : null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No pudimos enviar el enlace. Probá de nuevo en unos minutos."));
    } finally {
      setIsSending(false);
    }
  }

  const footer = (
    <p>
      ¿Te acordaste?{" "}
      <Link className="auth-link" to="/portal-cliente/login">
        Volvé a ingresar
      </Link>
    </p>
  );

  if (sentTo) {
    return (
      <AuthLayout subtitle="Portal del cliente" eyebrow="Revisá tu email" title="Te mandamos un enlace" footer={footer}>
        <p role="status">
          Si {sentTo} tiene acceso al portal, en unos minutos te llega un email con un enlace para elegir una contraseña
          nueva. Vence en 1 hora y sirve una sola vez.
        </p>
        <p>Si no lo ves, revisá la carpeta de spam. Tu contraseña actual sigue funcionando hasta que la cambies.</p>
        {devToken ? (
          <ButtonLink to={`/restablecer-contrasena?token=${encodeURIComponent(devToken)}`} variant="primary">
            Elegir contraseña (solo desarrollo)
          </ButtonLink>
        ) : null}
        <Button variant="secondary" onClick={() => setSentTo("")}>
          Usar otro email
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      subtitle="Portal del cliente"
      title="Recuperar contraseña"
      description="Te mandamos un enlace para que elijas una nueva."
      backTo="/portal-cliente/login"
      footer={footer}
    >
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="usuario@empresa.com"
        />
        <TextField
          label="Identificador de empresa"
          optional
          hint="Si tenés acceso a más de una empresa, indicá cuál. Si no, dejalo vacío."
          value={tenantSlug}
          onChange={(event) => setTenantSlug(event.target.value)}
          placeholder="mi-empresa"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        {devToken ? (
          <ButtonLink to={`/restablecer-contrasena?token=${encodeURIComponent(devToken)}`} variant="secondary">
            Elegir contraseña (solo desarrollo)
          </ButtonLink>
        ) : null}
        <Button type="submit" variant="primary" size="lg" fullWidth loading={isSending} loadingLabel="Enviando…">
          Enviarme el enlace
        </Button>
      </form>
    </AuthLayout>
  );
}
