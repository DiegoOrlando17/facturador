import { Outlet, useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { Shell, type ShellNavGroup } from "@/components/layout/Shell";
import { usePortalResource } from "@/hooks/usePortalResource";

type OnboardingSummary = { items: { status: string }[] };

function buildNavigation(showOnboarding: boolean): ShellNavGroup[] {
  return [
    {
      items: [
        { label: "Inicio", icon: "home", to: "/portal-cliente", end: true },
        { label: "Ventas", icon: "payments", to: "/portal-cliente/pagos" },
        { label: "Facturas", icon: "invoice", to: "/portal-cliente/comprobantes" },
        { label: "Reportes", icon: "reports", to: "/portal-cliente/reportes" },
      ],
    },
    {
      label: "Tu empresa",
      items: [
        { label: "Datos fiscales", icon: "tax", to: "/portal-cliente/perfil-fiscal" },
        { label: "Integraciones", icon: "integrations", to: "/portal-cliente/integraciones" },
        ...(showOnboarding ? [{ label: "Puesta en marcha", icon: "onboarding" as const, to: "/portal-cliente/onboarding" }] : []),
        { label: "Plan y suscripción", icon: "money", to: "/portal-cliente/suscripcion" },
      ],
    },
  ];
}

export function ClientPortalLayout() {
  const navigate = useNavigate();
  const { logout, user } = useTenantAuth();
  // "Puesta en marcha" sale del menú cuando ya está aprobada (la ruta sigue existiendo).
  const onboarding = usePortalResource<OnboardingSummary>("/portal/onboarding");
  const showOnboarding = onboarding.data?.items[0]?.status !== "approved";
  const companyName = user?.tenant?.name ?? "Tu empresa";
  const initials = (user?.tenant?.name || user?.email || "FC").slice(0, 2).toUpperCase();

  return (
    <Shell
      brandSubtitle="Portal del cliente"
      homeTo="/portal-cliente"
      navLabel="Portal del cliente"
      groups={buildNavigation(showOnboarding)}
      user={{ name: companyName, detail: user?.email, initials }}
      onLogout={() => {
        logout();
        navigate("/portal-cliente/login", { replace: true });
      }}
    >
      <Outlet />
    </Shell>
  );
}
