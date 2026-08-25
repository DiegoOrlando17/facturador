import type { ReactNode } from "react";
import { useAuth } from "@/app/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__card">
          <span className="eyebrow">Facturador</span>
          <strong>Recuperando sesion...</strong>
          <p>Estamos validando tu acceso con la API admin.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
