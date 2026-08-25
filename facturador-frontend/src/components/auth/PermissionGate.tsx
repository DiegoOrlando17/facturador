import type { ReactNode } from "react";
import { useAuth } from "@/app/AuthContext";
import type { AdminPermission } from "@/lib/adminPermissions";

type PermissionGateProps = {
  permission: AdminPermission;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { can } = useAuth();

  if (!can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
