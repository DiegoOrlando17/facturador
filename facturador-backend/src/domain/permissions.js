export const ADMIN_PERMISSIONS = Object.freeze({
  READ: "admin.read",
  OPERATE: "admin.operate",
  MANAGE_TENANTS: "admin.manageTenants",
  MANAGE_SUBSCRIPTIONS: "admin.manageSubscriptions",
  MANAGE_ADMINS: "admin.manageAdmins",
  MANAGE_PLANS: "admin.managePlans",
  DELETE_TENANT: "admin.deleteTenant",
  REVEAL_SECRETS: "admin.revealSecrets",
});

export const TENANT_PERMISSIONS = Object.freeze({
  READ: "tenant.read",
  TEST_INTEGRATIONS: "tenant.testIntegrations",
  MANAGE_INTEGRATIONS: "tenant.manageIntegrations",
  SUBMIT_ONBOARDING: "tenant.submitOnboarding",
});

const ADMIN_ROLE_PERMISSIONS = Object.freeze({
  SUPERADMIN: new Set(Object.values(ADMIN_PERMISSIONS)),
  OPERATOR: new Set([ADMIN_PERMISSIONS.READ, ADMIN_PERMISSIONS.OPERATE, ADMIN_PERMISSIONS.MANAGE_TENANTS]),
  VIEWER: new Set([ADMIN_PERMISSIONS.READ]),
});

const TENANT_ROLE_PERMISSIONS = Object.freeze({
  owner: new Set(Object.values(TENANT_PERMISSIONS)),
  admin: new Set(Object.values(TENANT_PERMISSIONS)),
  approver: new Set([TENANT_PERMISSIONS.READ]),
  viewer: new Set([TENANT_PERMISSIONS.READ]),
});

export function adminRoleHasPermission(role, permission) {
  return ADMIN_ROLE_PERMISSIONS[String(role || "").toUpperCase()]?.has(permission) === true;
}

export function tenantRoleHasPermission(role, permission) {
  return TENANT_ROLE_PERMISSIONS[String(role || "").toLowerCase()]?.has(permission) === true;
}
