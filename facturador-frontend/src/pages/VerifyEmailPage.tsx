import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verificando tu email...");
  useEffect(() => {
    const token = params.get("token");
    if (!token) { setState("error"); setMessage("El enlace no contiene un token de verificacion."); return; }
    void apiRequest("/public/verify-contact", { method: "POST", body: { token } })
      .then(() => { setState("success"); setMessage("Tu email fue verificado. Ya puedes ingresar y adherir el medio de pago."); })
      .catch((error) => { setState("error"); setMessage(getApiErrorMessage(error, "El enlace es invalido o vencio.")); });
  }, [params]);
  return <main className="public-form-page"><section className="public-form-card"><span className="eyebrow">Verificacion de contacto</span><h1>{state === "loading" ? "Un momento..." : state === "success" ? "Email verificado" : "No pudimos verificarlo"}</h1><p className={state === "error" ? "form-error" : undefined}>{message}</p>{state === "success" ? <Link className="primary-button" to="/portal-cliente/login">Ingresar al portal</Link> : <Link className="secondary-button" to="/registro">Volver al registro</Link>}</section></main>;
}
