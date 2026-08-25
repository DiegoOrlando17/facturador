# ERRORS.md

Reusable debugging notes for recurring or high-value errors.

Do not use this as a task history. Commits are the task history.

---
# Drive falla aunque el tenant no tiene Google configurado

Area: Node | Google Drive/Sheets | Workers  
Status: solved  
Last seen: 2026-08-12

### Symptoms

El invoice worker deja pagos ya facturados en `drive_pending`, registra `No se pudo subir la factura al drive` y puede mostrar un HTTP 400 al renovar un token Google global.

### Root cause

El flujo post-ARCA trataba Drive y Sheets como pasos obligatorios. Si el tenant no tenia integraciones configuradas, `getGoogleInvoiceContext` usaba token y destinos globales heredados del `.env`.

### Fix

- La descarga PDF permanece disponible para todas las tiers, pero se genera bajo demanda y no forma parte obligatoria del worker post-ARCA.
- Google se ejecuta solo con suscripcion `ACTIVE`, `featuresJson.googleDriveSheets: true` e integraciones `DRIVE` y `SHEETS` completas.
- Se eliminaron los fallbacks globales de token y destinos para la entrega por tenant.
- Sin Google elegible/configurado, el pago finaliza en `complete` sin generar PDF; el portal lo genera en memoria cuando se solicita.

### First checks next time

1. Revisar estado y plan de la suscripcion activa.
2. Confirmar `featuresJson` con `{ "googleDriveSheets": true }`.
3. Confirmar integraciones `DRIVE` y `SHEETS`, refresh token y destinos.
4. Revisar `PaymentEvent` antes de reprocesar; no volver a emitir en ARCA.
5. Para comprobantes `complete`, usar `Subir a Drive y Sheets`; no resetear el checkpoint de Mercado Pago.

### Related files

- `facturador/src/workers/invoice.worker.js`
- `facturador/src/services/tenantGoogle.service.js`
- `facturador/src/services/tenantConfig.service.js`
