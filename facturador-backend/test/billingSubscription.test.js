import test from "node:test";
import assert from "node:assert/strict";
import { calculateArsAmount, mapMercadoPagoSubscriptionStatus, parseBnaUsdSellingRate } from "../src/domain/billingSubscription.js";

test("lee la cotizacion vendedor billete publicada por BNA", () => {
  assert.equal(parseBnaUsdSellingRate("<td>Dolar U.S.A</td><td>1.480,00</td><td>1.530,00</td>"), 1530);
});
test("convierte el precio USD a ARS sin perder centavos", () => { assert.equal(calculateArsAmount(75, 1530.25), 114768.75); });
test("mapea estados de Mercado Pago sin habilitar pendientes", () => { assert.equal(mapMercadoPagoSubscriptionStatus("authorized"), "ACTIVE"); assert.equal(mapMercadoPagoSubscriptionStatus("pending"), "PAST_DUE"); assert.equal(mapMercadoPagoSubscriptionStatus("paused"), "PAST_DUE"); assert.equal(mapMercadoPagoSubscriptionStatus("cancelled"), "CANCELED"); });
