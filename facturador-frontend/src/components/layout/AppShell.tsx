import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { useApiResource } from "@/hooks/useApiResource";
import { getAdminInitials, getAdminRoleName } from "@/lib/adminPermissions";

type AlertsCountResponse = {
  total: number;
};

const ONBOARDING_TAB = "onboarding";

export function AppShell({ children }: { children: ReactNode }) {
  const { logout, user, token } = useAuth();
  const location = useLocation();
  const [lastDashboardUpdate, setLastDashboardUpdate] = useState<Date | null>(null);
  const displayName = user?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "";
  const fullName = user?.name?.trim() || user?.email || "";
  const initials = getAdminInitials(user?.name, user?.email);
  const roleName = getAdminRoleName(user?.role);
  const showTopbar = location.pathname === "/admin";
  const isClientsSection = location.pathname === "/admin/tenants";
  const isOnboardingTab = isClientsSection && new URLSearchParams(location.search).get("tab") === ONBOARDING_TAB;
  const isClientsActive = location.pathname.startsWith("/admin/tenants") && !isOnboardingTab;

  const { data: alerts, reload: reloadAlerts } = useApiResource<AlertsCountResponse>("/admin/alerts", {
    enabled: Boolean(token),
    fallbackErrorMessage: "No se pudo consultar la cantidad de alertas.",
  });
  const alertsCount = alerts?.total ?? 0;
  const isFirstPath = useRef(true);

  useEffect(() => {
    if (isFirstPath.current) {
      isFirstPath.current = false;
      return;
    }

    void reloadAlerts();
  }, [location.pathname, reloadAlerts]);

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
        <Link to="/admin" className="brand-lockup">
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
          <span className="app-nav__group">Operación diaria</span>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="home" />
            <span>Inicio</span>
          </NavLink>
          <Link
            to="/admin/tenants"
            className={`app-nav__link${isClientsActive ? " app-nav__link--active" : ""}`}
            aria-current={isClientsActive ? "page" : undefined}
          >
            <AppIcon name="clients" />
            <span>Clientes</span>
          </Link>
          <Link
            to={`/admin/tenants?tab=${ONBOARDING_TAB}`}
            className={`app-nav__link${isOnboardingTab ? " app-nav__link--active" : ""}`}
            aria-current={isOnboardingTab ? "page" : undefined}
          >
            <AppIcon name="onboarding" />
            <span>Altas</span>
          </Link>
          <NavLink
            to="/admin/billing"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="invoice" />
            <span>Facturación</span>
          </NavLink>
          <NavLink
            to="/admin/integrations"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="integrations" />
            <span>Integraciones</span>
          </NavLink>
          <NavLink
            to="/admin/alerts"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="bell" />
            <span>Alertas</span>
            {alertsCount > 0 ? (
              <small
                className="app-nav__badge phase1-nav-badge"
                aria-label={`${alertsCount} ${alertsCount === 1 ? "alerta activa" : "alertas activas"}`}
              >
                {alertsCount > 99 ? "99+" : alertsCount}
              </small>
            ) : null}
          </NavLink>
          <span className="app-nav__group">Administración interna</span>
          <NavLink
            to="/admin/audit"
            className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
          >
            <AppIcon name="shield" />
            <span>Auditoría</span>
          </NavLink>
          {user?.role === "SUPERADMIN" ? (
            <>
              <NavLink
                to="/admin/settings"
                className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
              >
                <AppIcon name="settings" />
                <span>Configuración</span>
              </NavLink>
              <NavLink
                to="/admin/admins"
                className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
              >
                <AppIcon name="admins" />
                <span>Admins</span>
              </NavLink>
            </>
          ) : null}
        </nav>

        <Link to="/admin/account" className="sidebar-user-card phase1-user-card" aria-label={`Mi cuenta: ${fullName}`}>
          <span className="sidebar-user-card__avatar" aria-hidden="true">{initials}</span>
          <div>
            <strong>{fullName || "Mi cuenta"}</strong>
            <small>{roleName}</small>
          </div>
        </Link>
        <button type="button" className="sidebar-logout-button" onClick={logout}>
          <AppIcon name="logout" />
          <span>Cerrar sesión</span>
        </button>
      </aside>

      <div className="app-main">
        <header className={`app-topbar${showTopbar ? "" : " app-topbar--section-hidden"}`}>
          <div>
            <strong className="topbar-greeting">{displayName ? `Hola, ${displayName}` : "Hola"}</strong>
            <span>Panel interno de Facturador</span>
          </div>
          <div className="app-topbar__actions">
            <span className="topbar-sync">
              Última actualización: {lastUpdatedLabel}
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
