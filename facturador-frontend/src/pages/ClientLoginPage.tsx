import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";

type LocationState = { from?: { pathname?: string } };

export function ClientLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isBootstrapping, login, user } = useTenantAuth();
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/portal-cliente";

  if (isBootstrapping) return null;
  if (user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    const result = await login({ tenantSlug, email, password, remember });
    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message ?? "No se pudo iniciar sesion.");
      return;
    }
    navigate(redirectTo, { replace: true });
  }

  return (
    <main className="login-page client-login-page">
      <section className="login-content">
        <div className="login-brand-row">
          <span className="login-logo"><AppIcon name="invoice" /></span>
          <div><strong>Facturador</strong><span>Portal del cliente</span></div>
        </div>
        <section className="login-hero">
          <h1>Tu facturacion y tus pagos, <strong>en un solo lugar</strong></h1>
          <p>Consulta la actividad fiscal de tu empresa con acceso seguro y separado del panel administrativo.</p>
        </section>
      </section>
      <section className="login-card-wrapper">
        <div className="login-card">
          <div className="login-card-heading"><h2>Ingresar</h2><p>Usa los datos provistos para tu empresa.</p></div>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field"><span>Empresa</span><input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} placeholder="identificador-de-empresa" autoComplete="organization" /></label>
            <label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@empresa.com" autoComplete="email" /></label>
            <label className="field"><span>Contrasena</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
            <label className="checkbox-field"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Recordar esta sesion</span></label>
            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            <button className="primary-button primary-button--full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Ingresando..." : "Ingresar al portal"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
