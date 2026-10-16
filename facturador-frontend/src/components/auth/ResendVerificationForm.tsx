import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { TextField } from "@/components/ui/Field";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type ResendResponse = {
  accepted?: boolean;
  emailSent?: boolean;
  verificationToken?: string;
};

type ResendVerificationFormProps = {
  initialEmail?: string;
  title?: string;
  description?: string;
};

/**
 * Pide un nuevo enlace de verificación. La respuesta del backend es la misma
 * exista o no la cuenta, así que el mensaje de éxito es deliberadamente neutro.
 */
export function ResendVerificationForm({
  initialEmail = "",
  title = "Pedí un nuevo enlace de verificación",
  description = "Ingresá el email con el que creaste la cuenta y te mandamos un enlace nuevo.",
}: ResendVerificationFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setError("");
    setSentTo("");
    try {
      const response = await apiRequest<ResendResponse>("/public/resend-verification", {
        method: "POST",
        body: { email },
      });
      if (response?.emailSent === false) {
        setError("No pudimos enviar el email en este momento. Probá de nuevo en unos minutos.");
      } else {
        setSentTo(email.trim());
      }
      setDevToken(import.meta.env.DEV && response?.verificationToken ? response.verificationToken : null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No pudimos reenviar el enlace. Probá de nuevo en unos minutos."));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="auth-resend" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="usuario@empresa.com"
        />
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        {sentTo ? (
          <Callout tone="success" role="status">
            Si hay una cuenta pendiente de verificación para {sentTo}, te mandamos un enlace nuevo. Revisá también la carpeta
            de spam.
          </Callout>
        ) : null}
        <div className="auth-actions">
          <Button type="submit" variant="secondary" loading={isSending} loadingLabel="Enviando…">
            Reenviar verificación
          </Button>
          {devToken ? (
            <ButtonLink to={`/verificar-email?token=${encodeURIComponent(devToken)}`} variant="primary">
              Verificar ahora (solo desarrollo)
            </ButtonLink>
          ) : null}
        </div>
      </form>
    </section>
  );
}
