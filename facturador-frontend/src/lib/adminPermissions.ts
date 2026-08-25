export type AdminRole = "SUPERADMIN" | "OPERATOR" | "VIEWER";

export type AdminPermission =
  | "dashboard:view"
  | "payments:manage"
  | "tenants:view"
  | "tenants:manage"
  | "integrations:manage"
  | "users:manage";

const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  SUPERADMIN: [
    "dashboard:view",
    "payments:manage",
    "tenants:view",
    "tenants:manage",
    "integrations:manage",
    "users:manage",
  ],
  OPERATOR: [
    "dashboard:view",
    "payments:manage",
    "tenants:view",
  ],
  VIEWER: [
    "dashboard:view",
    "tenants:view",
  ],
};

export function normalizeAdminRole(role: string | null | undefined): AdminRole | null {
  if (role === "SUPERADMIN" || role === "OPERATOR" || role === "VIEWER") {
    return role;
  }

  return null;
}

export function hasAdminPermission(
  role: string | null | undefined,
  permission: AdminPermission,
) {
  const normalizedRole = normalizeAdminRole(role);

  if (!normalizedRole) {
    return false;
  }

  return rolePermissions[normalizedRole].includes(permission);
}

export function getAdminRoleLabel(role: string | null | undefined) {
  switch (role) {
    case "SUPERADMIN":
      return "Acceso total";
    case "OPERATOR":
      return "Operacion";
    case "VIEWER":
      return "Solo lectura";
    default:
      return "Sin rol";
  }
}
