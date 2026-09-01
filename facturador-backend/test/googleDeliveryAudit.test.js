import test from "node:test";
import assert from "node:assert/strict";
import { auditGoogleDeliveries } from "../src/services/googleDeliveryAudit.service.js";

function payment(id, row, externalId, fileName = `${id}.pdf`) {
  return {
    providerPaymentId: id,
    sheetsRow: row,
    driveDocuments: externalId ? [{ externalId, fileName }] : [],
  };
}

test("la auditoria acepta entregas Drive y Sheets consistentes", () => {
  const report = auditGoogleDeliveries({
    payments: [payment("pay-1", "Hoja1!A2:J2", "file-1")],
    driveFiles: [{ id: "file-1", name: "pay-1.pdf" }],
    sheetValues: [["Pago"], ["pay-1"]],
  });

  assert.equal(report.ok, true);
  assert.equal(report.errors.missingDriveDocuments.count, 0);
  assert.equal(report.errors.missingOrMismatchedSheetRows.count, 0);
});

test("la auditoria detecta IDs repetidos y referencias externas faltantes", () => {
  const report = auditGoogleDeliveries({
    payments: [payment("pay-1", "Hoja1!A2:J2", "missing-file")],
    driveFiles: [],
    sheetValues: [["Pago"], ["pay-1"], ["pay-1"]],
  });

  assert.equal(report.ok, false);
  assert.equal(report.errors.missingDriveDocuments.count, 1);
  assert.equal(report.errors.duplicateSheetPaymentIds.count, 1);
});

test("los recursos ajenos se informan como advertencias sin modificarlos", () => {
  const report = auditGoogleDeliveries({
    payments: [],
    driveFiles: [{ id: "external-file", name: "manual.pdf" }],
    sheetValues: [["Pago"], ["manual-row"]],
  });

  assert.equal(report.ok, true);
  assert.equal(report.warnings.untrackedDriveFiles.count, 1);
  assert.equal(report.warnings.untrackedSheetIds.count, 2);
});
