import { useTenantAuth } from "@/app/TenantAuthContext";

/**
 * Permisos del portal por rol. Espejo de TENANT_PERMISSIONS en
 * facturador-backend/src/domain/permissions.js: el backend es quien decide; acá
 * solo se usa para no ofrecer acciones que van a ser rechazadas.
 */
export type TenantPermission =
  | "tenant.read"
  | "tenant.testIntegrations"
  | "tenant.manageIntegrations"
  | "tenant.manageProfile"
  | "tenant.confirmInvoices"
  | "tenant.manageInvoices"
  | "tenant.submitOnboarding";

const ALL: TenantPermission[] = [
  "tenant.read",
  "tenant.testIntegrations",
  "tenant.manageIntegrations",
  "tenant.manageProfile",
  "tenant.confirmInvoices",
  "tenant.manageInvoices",
  "tenant.submitOnboarding",
];

const ROLE_PERMISSIONS: Record<string, TenantPermission[]> = {
  owner: ALL,
  admin: ALL,
  approver: ["tenant.read", "tenant.confirmInvoices"],
  viewer: ["tenant.read"],
};

export function tenantRoleCan(role: string | null | undefined, permission: TenantPermission) {
  return ROLE_PERMISSIONS[String(role || "").toLowerCase()]?.includes(permission) ?? false;
}

/** `const can = useTenantCan(); can("tenant.manageInvoices")` */
export function useTenantCan() {
  const { user } = useTenantAuth();
  return (permission: TenantPermission) => tenantRoleCan(user?.role, permission);
}
