import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { AppIcon } from "@/components/ui/AppIcon";

export function AppShell({ children }: { children: ReactNode }) {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [lastDashboardUpdate, setLastDashboardUpdate] = useState<Date | null>(null);
  const displayName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Diego";
  const showTopbar = location.pathname === "/";

  useEffect(() => {
    function handleDashboardUpdated(event: Event) {
      const detail = (event as CustomEvent<{ updatedAt?: string }>).detail;
      const updatedAt = detail?.updatedAt ? new Date(detail.updatedAt) : new Date();

      setLastDashboardUpdate(updatedAt);
    }

    window.addEventListener("dashboard:updated", handleDashboardUpdated);

    return () => window.removeEventListener("dashboard:updated", handleDashboardUpdated);
  }, []);

  const lastUpdatedLabel = lastDashboardUpdate
    ? lastDashboardUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : "Sin actualizar";

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="brand-lockup">
          <span className="app-logo" aria-hidden="true">
            <svg viewBox="0 0 48 56">
              <path d="M12 4h22l10 10v34a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" />
              <path d="M34 4v12h10" />
              <path d="M17 28h10M17 38h7" />
              <circle cx="35" cy="36" r="9" />
              <path d="m31 36 3 3 6-7" />
            </svg>
          </span>
          <div>
            <strong>Facturador</strong>
            <p>Panel interno</p>
          </div>
        </Link>

        <nav className="app-nav" aria-label="Principal">
          <span className="app-nav__group">Operacion diaria</span>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="home" />
            <span>Inicio</span>
          </NavLink>
          <NavLink
            to="/tenants"
            className={({ isActive }) => `app-nav__link${isActive && !location.search.includes("attention=1") ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="clients" />
            <span>Clientes</span>
          </NavLink>
          <NavLink
            to="/tenants?attention=1"
            className={({ isActive }) => `app-nav__link${isActive && location.search.includes("attention=1") ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="onboarding" />
            <span>Altas</span>
          </NavLink>
          <NavLink
            to="/billing"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="invoice" />
            <span>Facturacion</span>
          </NavLink>
          <NavLink
            to="/integrations"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="integrations" />
            <span>Integraciones</span>
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="bell" />
            <span>Alertas</span>
            <small className="app-nav__badge">1</small>
          </NavLink>
          <span className="app-nav__group">Administracion interna</span>
          {user?.role === "SUPERADMIN" ? (
            <>
              <NavLink
                to="/settings"
                className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
              >
                <AppIcon name="settings" />
                <span>Configuracion</span>
              </NavLink>
              <NavLink
                to="/admins"
                className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
              >
                <AppIcon name="admins" />
                <span>Admins</span>
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="sidebar-user-card">
          <span className="sidebar-user-card__avatar">DO</span>
          <div>
            <strong>{user?.name || "Diego Orlando"}</strong>
            <small>Administrador</small>
          </div>
        </div>
        <button type="button" className="sidebar-logout-button" onClick={logout}>
          <AppIcon name="logout" />
          <span>Cerrar sesion</span>
        </button>
      </aside>

      <div className="app-main">
        <header className={`app-topbar${showTopbar ? "" : " app-topbar--section-hidden"}`}>
          <div>
            <strong className="topbar-greeting">{`Hola, ${displayName}`} <span aria-hidden="true">👋</span></strong>
            <span>Panel interno de Facturador</span>
          </div>
          <div className="app-topbar__actions">
            <span className="topbar-sync">
              Ultima actualizacion: {lastUpdatedLabel}
            </span>
            <button
              type="button"
              className="secondary-button topbar-refresh-button"
              onClick={() => window.dispatchEvent(new Event("dashboard:refresh"))}
            >
              <AppIcon name="refresh" />
              <span>Actualizar</span>
            </button>
            </div>
          </header>

        {children}
      </div>
    </div>
  );
}
