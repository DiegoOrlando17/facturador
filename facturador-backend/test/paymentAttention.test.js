import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentAttentionWhere, isPaymentAttentionState } from "../src/domain/paymentAttention.js";

test("los estados reintentables se consideran alertas operativas", () => {
  for (const status of ["afip_pending", "pdf_pending", "drive_pending", "sheets_pending", "failed"]) {
    assert.equal(isPaymentAttentionState(status), true);
  }
});

test("processing solo requiere atencion cuando conserva un error", () => {
  assert.equal(isPaymentAttentionState("processing"), false);
  assert.equal(isPaymentAttentionState("processing", "Fallo Google"), true);
});

test("el filtro Prisma incluye pendientes, fallidos y processing con error", () => {
  assert.deepEqual(buildPaymentAttentionWhere(), {
    OR: [
      { status: { in: ["afip_pending", "pdf_pending", "drive_pending", "sheets_pending", "failed"] } },
      { status: "processing", error: { not: null } },
    ],
  });
});
