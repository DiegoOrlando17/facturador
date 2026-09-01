import test from "node:test";
import assert from "node:assert/strict";
import { assertManagedAdminUpdate } from "../src/domain/adminUserPolicy.js";

const currentSuperadmin = { id: 1n, role: "SUPERADMIN", status: "ACTIVE" };

test("un superadmin no puede deshabilitarse ni quitarse su propio rol", () => {
  assert.throws(() => assertManagedAdminUpdate({ actorId: 1n, targetUser: currentSuperadmin, nextStatus: "DISABLED", activeSuperadminCount: 2 }), /deshabilitar tu propio/);
  assert.throws(() => assertManagedAdminUpdate({ actorId: 1n, targetUser: currentSuperadmin, nextRole: "OPERATOR", activeSuperadminCount: 2 }), /quitarte el rol SUPERADMIN/);
});

test("siempre debe quedar al menos un superadmin activo", () => {
  assert.throws(() => assertManagedAdminUpdate({ actorId: 2n, targetUser: currentSuperadmin, nextStatus: "DISABLED", activeSuperadminCount: 1 }), /al menos un SUPERADMIN activo/);
});

test("permite administrar otros usuarios cuando queda un superadmin activo", () => {
  assert.doesNotThrow(() => assertManagedAdminUpdate({ actorId: 2n, targetUser: currentSuperadmin, nextRole: "OPERATOR", activeSuperadminCount: 2 }));
});
