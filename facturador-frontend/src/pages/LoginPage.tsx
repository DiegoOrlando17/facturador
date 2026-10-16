import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { AuthAside, AuthLayout, AuthPoints } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { PasswordField, TextField } from "@/components/ui/Field";
import { BRAND } from "@/config/brand";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

const POINTS = [
  { title: "Ventas y facturas", text: "Seguí los cobros y los comprobantes de cada empresa." },
  { title: "Datos fiscales", text: "Revisá y aprobá la información antes de habilitar." },
  { title: "Estado operativo", text: "Pendientes, integraciones y errores, a tiempo." },
];

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
  const redirectTo = state?.from?.pathname ?? "/admin";

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

    const result = await login({ email: email.trim(), password, remember });

    if (!result.ok) {
      setErrorMessage(result.message ?? "No pudimos iniciar sesión. Probá de nuevo.");
      setIsSubmitting(false);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <AuthLayout
      subtitle="Panel interno"
      title="Iniciar sesión"
      description="Ingresá con tu email del equipo interno."
      aside={
        <AuthAside
          headline={
            <>
              Cada empresa, sus ventas y sus <strong>comprobantes</strong>, en un solo lugar.
            </>
          }
          lead="Revisá la puesta en marcha, las integraciones y lo que necesita atención en cada empresa que factura con nosotros."
        >
          <AuthPoints items={POINTS} />
        </AuthAside>
      }
      footer={
        <>
          <p>¿Olvidaste tu contraseña? Pedile a un superadmin que te asigne una nueva desde Administradores.</p>
          <p>
            ¿Otro problema para ingresar? Escribinos a{" "}
            <a className="auth-link" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>
            .
          </p>
        </>
      }
    >
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="usuario@empresa.com"
        />
        <PasswordField label="Contraseña" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <label className="auth-check">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>Recordar esta sesión en este navegador</span>
        </label>

        {errorMessage ? (
          <Callout tone="danger" role="alert">
            {errorMessage}
          </Callout>
        ) : authNotice ? (
          <Callout tone="success" role="status">
            {authNotice}
          </Callout>
        ) : null}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting} loadingLabel="Ingresando…">
          Ingresar al panel
        </Button>
      </form>
    </AuthLayout>
  );
}
