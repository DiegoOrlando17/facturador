export type AdminRole = "SUPERADMIN" | "OPERATOR" | "VIEWER";

export type AdminPermission =
  | "dashboard:view"
  | "payments:manage"
  | "tenants:view"
  | "tenants:manage"
  | "tenants:delete"
  | "integrations:manage"
  | "tenant-users:manage"
  | "users:manage";

const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  SUPERADMIN: [
    "dashboard:view",
    "payments:manage",
    "tenants:view",
    "tenants:manage",
    "tenants:delete",
    "integrations:manage",
    "tenant-users:manage",
    "users:manage",
  ],
  OPERATOR: [
    "dashboard:view",
    "payments:manage",
    "tenants:view",
    "tenants:manage",
    "integrations:manage",
    "tenant-users:manage",
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
      return "Operación";
    case "VIEWER":
      return "Solo lectura";
    default:
      return "Sin rol";
  }
}

export function getAdminRoleName(role: string | null | undefined) {
  switch (role) {
    case "SUPERADMIN":
      return "Superadmin";
    case "OPERATOR":
      return "Operador";
    case "VIEWER":
      return "Lector";
    default:
      return "Sin rol";
  }
}

export function getAdminInitials(name: string | null | undefined, email: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  const localPart = (email ?? "").split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return localPart ? localPart.slice(0, 2).toUpperCase() : "?";
}
