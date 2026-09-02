import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_PERMISSIONS,
  TENANT_PERMISSIONS,
  adminRoleHasPermission,
  tenantRoleHasPermission,
} from "../src/domain/permissions.js";

test("SUPERADMIN tiene acceso completo", () => {
  for (const permission of Object.values(ADMIN_PERMISSIONS)) {
    assert.equal(adminRoleHasPermission("SUPERADMIN", permission), true);
  }
});

test("OPERATOR opera tenants sin administrar privilegios globales", () => {
  assert.equal(adminRoleHasPermission("OPERATOR", ADMIN_PERMISSIONS.OPERATE), true);
  assert.equal(adminRoleHasPermission("OPERATOR", ADMIN_PERMISSIONS.MANAGE_TENANTS), true);
  assert.equal(adminRoleHasPermission("OPERATOR", ADMIN_PERMISSIONS.MANAGE_ADMINS), false);
  assert.equal(adminRoleHasPermission("OPERATOR", ADMIN_PERMISSIONS.REVEAL_SECRETS), false);
  assert.equal(adminRoleHasPermission("OPERATOR", ADMIN_PERMISSIONS.DELETE_TENANT), false);
});

test("VIEWER admin es solo lectura", () => {
  assert.equal(adminRoleHasPermission("VIEWER", ADMIN_PERMISSIONS.READ), true);
  assert.equal(adminRoleHasPermission("VIEWER", ADMIN_PERMISSIONS.OPERATE), false);
});

test("owner y admin tenant operan; approver y viewer solo leen", () => {
  assert.equal(tenantRoleHasPermission("owner", TENANT_PERMISSIONS.SUBMIT_ONBOARDING), true);
  assert.equal(tenantRoleHasPermission("admin", TENANT_PERMISSIONS.TEST_INTEGRATIONS), true);
  assert.equal(tenantRoleHasPermission("owner", TENANT_PERMISSIONS.MANAGE_INTEGRATIONS), true);
  assert.equal(tenantRoleHasPermission("admin", TENANT_PERMISSIONS.MANAGE_INTEGRATIONS), true);
  assert.equal(tenantRoleHasPermission("owner", TENANT_PERMISSIONS.MANAGE_PROFILE), true);
  assert.equal(tenantRoleHasPermission("admin", TENANT_PERMISSIONS.MANAGE_PROFILE), true);
  assert.equal(tenantRoleHasPermission("approver", TENANT_PERMISSIONS.READ), true);
  assert.equal(tenantRoleHasPermission("approver", TENANT_PERMISSIONS.SUBMIT_ONBOARDING), false);
  assert.equal(tenantRoleHasPermission("viewer", TENANT_PERMISSIONS.TEST_INTEGRATIONS), false);
  assert.equal(tenantRoleHasPermission("approver", TENANT_PERMISSIONS.MANAGE_INTEGRATIONS), false);
  assert.equal(tenantRoleHasPermission("viewer", TENANT_PERMISSIONS.MANAGE_PROFILE), false);
  assert.equal(tenantRoleHasPermission("approver", TENANT_PERMISSIONS.CONFIRM_INVOICES), true);
  assert.equal(tenantRoleHasPermission("approver", TENANT_PERMISSIONS.MANAGE_INVOICES), false);
});
