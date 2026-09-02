import test from "node:test";
import assert from "node:assert/strict";
import { mergeAlertAssignments } from "../src/domain/operationalAlert.js";

const alerts = [{ id: "payment_failed-1-10", title: "Pago fallido" }];

test("la cola muestra el responsable del ultimo claim", () => {
  const adminUser = { id: 7n, email: "operator@example.test" };
  const result = mergeAlertAssignments(alerts, [{
    entityId: alerts[0].id,
    action: "operational_alert_claimed",
    adminUser,
    createdAt: new Date("2026-09-01T12:00:00Z"),
  }]);

  assert.equal(result[0].assignment.adminUser, adminUser);
});

test("el ultimo release deja la alerta sin asignar", () => {
  const result = mergeAlertAssignments(alerts, [
    { entityId: alerts[0].id, action: "operational_alert_released", createdAt: new Date("2026-09-01T13:00:00Z") },
    { entityId: alerts[0].id, action: "operational_alert_claimed", createdAt: new Date("2026-09-01T12:00:00Z") },
  ]);

  assert.equal(result[0].assignment, null);
});
