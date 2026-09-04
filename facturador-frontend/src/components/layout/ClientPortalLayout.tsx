import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

const navigation: Array<{ label: string; icon: AppIconName; to?: string }> = [
  { label: "Inicio", icon: "home", to: "/portal-cliente" },
  { label: "Pagos y facturas", icon: "payments", to: "/portal-cliente/pagos" },
  { label: "Comprobantes", icon: "invoice", to: "/portal-cliente/comprobantes" },
  { label: "Reportes", icon: "reports", to: "/portal-cliente/reportes" },
  { label: "Datos fiscales", icon: "tax", to: "/portal-cliente/perfil-fiscal" },
  { label: "Integraciones", icon: "integrations", to: "/portal-cliente/integraciones" },
  { label: "Onboarding", icon: "onboarding", to: "/portal-cliente/onboarding" },
  { label: "Plan y suscripcion", icon: "invoice", to: "/portal-cliente/suscripcion" },
];

export function ClientPortalLayout() {
  const navigate = useNavigate();
  const { logout, user } = useTenantAuth();
  const initials = (user?.tenant?.name || user?.email || "FC").slice(0, 2).toUpperCase();

  return (
    <div className="client-portal-page">
      <aside className="client-sidebar">
        <div className="brand-lockup">
          <span className="app-logo"><AppIcon name="invoice" /></span>
          <div><strong>Facturador</strong><p>Portal del cliente</p></div>
        </div>
        <nav className="app-nav" aria-label="Portal cliente">
          {navigation.map((item) => item.to ? (
            <NavLink key={item.label} to={item.to} end={item.to === "/portal-cliente"} className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}>
              <AppIcon name={item.icon} /><span>{item.label}</span>
            </NavLink>
          ) : (
            <button key={item.label} type="button" className="app-nav__link client-nav-link--pending" disabled title="Disponible en un proximo corte">
              <AppIcon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user-card">
          <span className="sidebar-user-card__avatar">{initials}</span>
          <div><strong>{user?.tenant?.name ?? "Empresa"}</strong><small>{user?.email}</small></div>
        </div>
        <button type="button" className="sidebar-logout-button" onClick={() => { logout(); navigate("/portal-cliente/login", { replace: true }); }}>
          <AppIcon name="logout" /><span>Cerrar sesion</span>
        </button>
      </aside>
      <Outlet />
    </div>
  );
}
