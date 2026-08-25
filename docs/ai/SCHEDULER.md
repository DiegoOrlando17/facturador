# Contrato del scheduler por tenant

Ultima revision: 2026-08-22

## Alcance

El scheduler decide cuando consultar Mercado Pago POS. No decide si el comprobante requiere confirmacion: esa modalidad pertenece al ciclo de `Invoice` y se habilitara mediante `clientApproval`.

La configuracion se guarda en la integracion `MERCADOPAGO` del tenant y se valida contra la politica de su suscripcion activa.

## Configuracion

### Tiempo real

```json
{
  "POLLING_MODE": "realtime",
  "POLLING_INTERVAL_MS": 5000,
  "TIMEZONE": "America/Argentina/Buenos_Aires"
}
```

- El intervalo debe ser un entero igual o mayor a 5000 ms y respetar `minRealtimeIntervalMs` si el plan define uno mayor.
- La primera evaluacion ejecuta inmediatamente; las siguientes esperan el intervalo completo.

### Programado

```json
{
  "POLLING_MODE": "scheduled",
  "RUN_AT_TIMES": ["09:00", "13:00", "17:00", "21:00"],
  "TIMEZONE": "America/Argentina/Buenos_Aires"
}
```

- `RUN_AT_TIMES` usa `HH:mm`, elimina duplicados y se interpreta en la zona IANA indicada.
- Si no hay horarios explicitos, `RUNS_PER_DAY` genera slots uniformes desde `00:00`.
- `RUNS_PER_DAY` debe ser un entero positivo y respetar `maxRunsPerDay` cuando el plan lo defina.
- El fallback heredado sigue soportado, pero para operacion resulta preferible guardar horarios explicitos.

## Reglas de ejecucion

1. Se requiere suscripcion y plan `ACTIVE`.
2. El plan debe habilitar `automaticInvoicing` y el modo solicitado.
3. Una configuracion invalida se rechaza al guardarla desde admin y tampoco se ejecuta si ya estaba persistida.
4. Un slot programado se ejecuta una sola vez por tenant dentro de una instancia del worker.
5. Polling y checkpoints mantienen la idempotencia de deteccion; los jobs posteriores usan IDs deterministas.

## Limitacion para produccion

El estado `lastRunAt`/`lastSlot` reside en memoria. Con una sola instancia evita duplicados por slot; con varias replicas cada una podria ejecutar el mismo slot. Antes de escalar workers horizontalmente se debe adquirir un lock distribuido en Redis por tenant y slot, con expiracion y observabilidad.
