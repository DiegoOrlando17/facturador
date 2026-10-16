import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
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

  return (
    <main className="public-form-page">
      <section className="public-form-card">
        <span className="eyebrow">Verificación de email</span>
        {state.status === "loading" ? (
          <>
            <h1>Un momento...</h1>
            <p role="status">Estamos verificando tu email.</p>
          </>
        ) : null}

        {state.status === "success" ? (
          <>
            <h1>{state.alreadyVerified ? "Tu email ya estaba verificado" : "Email verificado"}</h1>
            <p role="status">
              {state.alreadyVerified
                ? "No hace falta hacer nada más: ya podés ingresar al portal."
                : "Listo, tu cuenta quedó activa. Ingresá al portal para completar tus datos y conectar el medio de cobro."}
            </p>
            {state.tenantSlug ? (
              <p>
                Para ingresar usá el identificador de empresa <strong>{state.tenantSlug}</strong>
                {state.email ? (
                  <>
                    {" "}
                    y el email <strong>{state.email}</strong>
                  </>
                ) : null}
                .
              </p>
            ) : null}
            <Link className="primary-button" to={buildLoginUrl(state.tenantSlug, state.email)}>
              Ingresar al portal
            </Link>
          </>
        ) : null}

        {state.status === "error" ? (
          <>
            <h1>No pudimos verificar tu email</h1>
            <p className="form-error" role="alert">
              {state.message}
            </p>
            <ResendVerificationForm />
            <p>
              ¿Ya verificaste tu email?{" "}
              <Link className="public-inline-link" to="/portal-cliente/login">
                Ingresá al portal
              </Link>
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
