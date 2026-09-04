# Politica de planes y suscripciones

Ultima revision: 2026-08-22

## Responsabilidades

- `Plan.featuresJson` contiene la politica versionada del plan.
- `Subscription` selecciona el plan efectivo del tenant y debe estar `ACTIVE`.
- Un plan `DISABLED` no concede capacidades aunque la suscripcion este activa.
- La configuracion concreta del tenant, como horarios o IDs de integraciones, no se guarda en el plan; debe respetar las capacidades y limites de su politica efectiva.

## Contrato versionado

```json
{
  "schemaVersion": 1,
  "tier": 3,
  "entitlements": {
    "automaticInvoicing": true,
    "pdfDownload": true,
    "googleDriveSheets": true
  },
  "limits": {
    "monthlyInvoices": null,
    "tenantUsers": null,
    "manualInvoicesMonthly": null,
    "ocrDocumentsMonthly": null
  },
  "processing": {
    "allowedModes": ["realtime", "scheduled"],
    "defaultMode": "realtime",
    "minRealtimeIntervalMs": 15000,
    "maxRunsPerDay": null
  }
}
```

`null` significa que el limite comercial todavia no fue definido y, por lo tanto, no se aplica un bloqueo cuantitativo. No significa que la capacidad este habilitada: eso se determina exclusivamente mediante `entitlements`.

## Reglas

1. Los tiers son acumulativos y se identifican tecnicamente por capacidades, no por el nombre comercial.
2. PDF está habilitado desde `TIER_1`; Google Drive/Sheets desde `TIER_3`.
3. El resolver acepta temporalmente el JSON plano anterior y los planes heredados `A/B`.
4. Nuevas verificaciones deben usar `resolvePlanPolicy` y `hasEntitlement`; no deben leer claves de `featuresJson` directamente.
5. Antes de ejecutar un modo, el scheduler debe comprobar `processing.allowedModes` y sus limites configurados.
6. Los planes mensuales son Esencial USD 50, Control USD 75, Profesional USD 100 e Inteligente USD 125. Los volumenes generales permanecen sin limite (`null`); Inteligente admite 500 documentos OCR mensuales y todos los tiers aplican un intervalo realtime minimo de 15 segundos.
7. La confirmacion del cliente no es un modo de polling; se controla mediante el entitlement `clientApproval` y el estado `Invoice.PENDING_CONFIRMATION`.

## Sincronizacion

`npm run plans:sync` actualiza `TIER_1` a `TIER_4` con el contrato vigente, sin reasignar suscripciones. Antes de usarlo en un ambiente compartido, revisar el diff esperado del catalogo y respaldar la base.
