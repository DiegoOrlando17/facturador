import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { Shell, type ShellNavGroup } from "@/components/layout/Shell";
import { AppIcon } from "@/components/ui/AppIcon";
import { BRAND } from "@/config/brand";
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
  const isDashboard = location.pathname === "/admin";
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

  const groups: ShellNavGroup[] = [
    {
      label: "Operación diaria",
      items: [
        { label: "Inicio", icon: "home", to: "/admin", end: true },
        { label: "Clientes", icon: "clients", to: "/admin/tenants", isActive: isClientsActive },
        { label: "Altas", icon: "onboarding", to: `/admin/tenants?tab=${ONBOARDING_TAB}`, isActive: isOnboardingTab },
        { label: "Facturación", icon: "invoice", to: "/admin/billing" },
        { label: "Integraciones", icon: "integrations", to: "/admin/integrations" },
        {
          label: "Alertas",
          icon: "bell",
          to: "/admin/alerts",
          count: alertsCount,
          countLabel: `${alertsCount} ${alertsCount === 1 ? "alerta activa" : "alertas activas"}`,
        },
      ],
    },
    {
      label: "Administración interna",
      items: [
        { label: "Auditoría", icon: "shield", to: "/admin/audit" },
        ...(user?.role === "SUPERADMIN"
          ? [
              { label: "Configuración", icon: "settings" as const, to: "/admin/settings" },
              { label: "Admins", icon: "admins" as const, to: "/admin/admins" },
            ]
          : []),
      ],
    },
  ];

  return (
    <Shell
      brandSubtitle="Panel interno"
      homeTo="/admin"
      navLabel="Principal"
      groups={groups}
      user={{
        name: fullName || "Mi cuenta",
        detail: roleName,
        initials,
        to: "/admin/account",
        ariaLabel: `Mi cuenta: ${fullName}`,
      }}
      onLogout={logout}
    >
      {isDashboard ? (
        <header className="app-topbar">
          <div>
            <strong className="topbar-greeting">{displayName ? `Hola, ${displayName}` : "Hola"}</strong>
            <span>Panel interno de {BRAND.name}</span>
          </div>
          <div className="app-topbar__actions">
            <span className="topbar-sync">Última actualización: {lastUpdatedLabel}</span>
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
      ) : null}

      {children}
    </Shell>
  );
}
