import test from "node:test";
import assert from "node:assert/strict";
import { buildTenantPortalDashboard } from "../src/services/tenantPortal.service.js";

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
