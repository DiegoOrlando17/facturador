import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Spinner } from "@/components/ui/Spinner";
import { Stamp, Ticket, TicketRow, TicketRows } from "@/components/ui/Ticket";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type VerifyResponse = {
  verified: boolean;
  alreadyVerified?: boolean;
  tenantSlug?: string | null;
  email?: string;
};

type VerifyState =
  | { status: "loading" }
  | { status: "success"; alreadyVerified: boolean; tenantSlug?: string | null; email?: string }
  | { status: "error"; message: string };

// Comparte la misma promesa por token: en StrictMode el efecto corre dos veces y
// no queremos que la segunda llamada choque con el enlace ya consumido.
const pendingVerifications = new Map<string, Promise<VerifyResponse>>();

function verifyToken(token: string) {
  let request = pendingVerifications.get(token);
  if (!request) {
    request = apiRequest<VerifyResponse>("/public/verify-contact", { method: "POST", body: { token } });
    pendingVerifications.set(token, request);
    request.catch(() => pendingVerifications.delete(token));
  }
  return request;
}

function buildLoginUrl(tenantSlug?: string | null, email?: string) {
  const params = new URLSearchParams();
  if (tenantSlug) params.set("empresa", tenantSlug);
  if (email) params.set("email", email);
  const query = params.toString();
  return query ? `/portal-cliente/login?${query}` : "/portal-cliente/login";
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<VerifyState>({ status: "loading" });
  const activeToken = useRef<string | null>(null);

  useEffect(() => {
    activeToken.current = token;
    if (!token) {
      setState({
        status: "error",
        message: "El enlace está incompleto. Abrilo de nuevo desde el email o pedí uno nuevo.",
      });
      return;
    }
    setState({ status: "loading" });
    verifyToken(token)
      .then((response) => {
        if (activeToken.current !== token) return;
        setState({
          status: "success",
          alreadyVerified: Boolean(response?.alreadyVerified),
          tenantSlug: response?.tenantSlug,
          email: response?.email,
        });
      })
      .catch((error) => {
        if (activeToken.current !== token) return;
        setState({
          status: "error",
          message: getApiErrorMessage(error, "El enlace no es válido o venció. Pedí uno nuevo con tu email."),
        });
      });
  }, [token]);

  if (state.status === "loading") {
    return (
      <AuthLayout subtitle="Portal del cliente" eyebrow="Verificación de email" title="Un momento…">
        <p role="status" className="auth-actions">
          <Spinner size="sm" label={null} />
          Estamos verificando tu email.
        </p>
      </AuthLayout>
    );
  }

  if (state.status === "error") {
    return (
      <AuthLayout
        subtitle="Portal del cliente"
        eyebrow="Verificación de email"
        title="No pudimos verificar tu email"
        footer={
          <p>
            ¿Ya verificaste tu email?{" "}
            <Link className="auth-link" to="/portal-cliente/login">
              Ingresá al portal
            </Link>
          </p>
        }
      >
        <Callout tone="danger" role="alert">
          {state.message}
        </Callout>
        <ResendVerificationForm />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      subtitle="Portal del cliente"
      eyebrow="Verificación de email"
      title={state.alreadyVerified ? "Tu email ya estaba verificado" : "Email verificado"}
    >
      <p role="status">
        {state.alreadyVerified
          ? "No hace falta hacer nada más: ya podés ingresar al portal."
          : "Listo, tu cuenta quedó activa. Ingresá al portal para completar tus datos y conectar el medio de cobro."}
      </p>
      {state.tenantSlug ? (
        <Ticket as="div" className="auth-credentials" eyebrow="Tus datos para ingresar" stamp={<Stamp label="OK" size="sm" />}>
          <TicketRows>
            <TicketRow label="Empresa" value={state.tenantSlug} mono />
            {state.email ? <TicketRow label="Email" value={state.email} mono /> : null}
          </TicketRows>
        </Ticket>
      ) : null}
      <ButtonLink to={buildLoginUrl(state.tenantSlug, state.email)} variant="primary" size="lg" fullWidth>
        Ingresar al portal
      </ButtonLink>
    </AuthLayout>
  );
}
