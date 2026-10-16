import test from "node:test";
import assert from "node:assert/strict";
import { buildTenantPortalDashboard, resolveTenantLoginFailure, TENANT_LOGIN_FAILURES } from "../src/services/tenantPortal.service.js";

test("dashboard tenant no expone informacion operativa global", () => {
  const result = buildTenantPortalDashboard({
    payments: { total: 2, complete: 1, pending: 1, failed: 0, totalAmount: 100, statuses: {} },
    filters: { tenantId: "10" },
    tenants: { total: 99 },
    attentionItems: [{ tenantId: "otro-tenant" }],
    recentActivity: [{ tenantId: "otro-tenant" }],
    systemHealth: { internal: { status: "healthy" } },
  });

  assert.deepEqual(Object.keys(result).sort(), ["filters", "payments"]);
  assert.equal(result.payments.total, 2);
  assert.equal("tenants" in result, false);
  assert.equal("attentionItems" in result, false);
  assert.equal("recentActivity" in result, false);
});

test("login tenant: empresa inexistente, usuario inexistente o contraseña incorrecta dan el mismo mensaje", () => {
  const activeUser = { status: "ACTIVE", passwordHash: "hash", tenant: { status: "ACTIVE" } };
  for (const input of [
    { tenantUser: null, passwordOk: false },
    { tenantUser: activeUser, passwordOk: false },
    { tenantUser: { ...activeUser, status: "DISABLED" }, passwordOk: false, hasPendingVerification: true },
  ]) {
    const failure = resolveTenantLoginFailure(input);
    assert.equal(failure.code, "INVALID_CREDENTIALS");
    assert.equal(failure.message, "Empresa, email o contraseña incorrectos.");
  }
});

test("login tenant: con contraseña correcta distingue email sin verificar", () => {
  const user = { status: "DISABLED", passwordHash: "hash", tenant: { status: "ACTIVE" } };
  assert.equal(resolveTenantLoginFailure({ tenantUser: user, passwordOk: true, hasPendingVerification: true }).code, "EMAIL_NOT_VERIFIED");
  assert.equal(resolveTenantLoginFailure({ tenantUser: user, passwordOk: true, hasPendingVerification: false }).code, "USER_DISABLED");
  assert.equal(resolveTenantLoginFailure({ tenantUser: { ...user, status: "ACTIVE", tenant: { status: "SUSPENDED" } }, passwordOk: true }).code, "TENANT_INACTIVE");
  assert.equal(resolveTenantLoginFailure({ tenantUser: { ...user, status: "ACTIVE" }, passwordOk: true }), null);
  for (const failure of Object.values(TENANT_LOGIN_FAILURES)) {
    assert.doesNotMatch(failure.message, /tenant|slug|password/i);
  }
});
