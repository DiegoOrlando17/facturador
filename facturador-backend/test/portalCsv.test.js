import test from "node:test";
import assert from "node:assert/strict";
import { buildPortalPaymentsCsv } from "../src/services/csvExport.service.js";

test("el CSV del portal abre en Excel argentino: BOM, punto y coma, coma decimal y castellano", () => {
  const csv = buildPortalPaymentsCsv([
    { provider_payment_id: "123", payment_method_id: "account_money", amount: 1234.5, currency: "ARS", customer: "Pérez; Hnos", status: "complete", cbte_nro: "00003-00000001", cae: "1", cae_vto: "26/10/2026", date_approved: new Date("2026-10-16T13:42:00Z") },
  ]);
  assert.ok(csv.startsWith("﻿Fecha;Operación Mercado Pago;"));
  const [, row] = csv.split("\r\n");
  assert.match(row, /^16\/10\/2026 10:42;123;Dinero en cuenta;1234,50;ARS;"Pérez; Hnos";;;Facturada;00003-00000001;1;26\/10\/2026;$/);
});
