import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";

export function TenantProtectedLayout() {
  const location = useLocation();
  const { isBootstrapping, user } = useTenantAuth();

  if (isBootstrapping) {
    return (
      <div className="auth-gate">
        <div className="auth-gate__card">
          <span className="eyebrow">Portal del cliente</span>
          <strong>Recuperando sesion...</strong>
          <p>Estamos validando tu acceso.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal-cliente/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
