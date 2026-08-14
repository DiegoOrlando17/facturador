# facturador

Facturador de mercado pago.

## Entregas de comprobantes

- Todo comprobante emitido en ARCA puede descargarse como PDF; se genera en memoria cuando el usuario lo solicita y no se persiste localmente.
- Drive/Sheets es opcional y se procesa solo para tenants con suscripcion activa, plan con `featuresJson.googleDriveSheets: true` e integraciones `DRIVE` y `SHEETS` completas.
- Para Drive, el worker genera un PDF temporal y lo elimina despues del intento de subida, incluso si falla.
- Desde el detalle admin de un comprobante ya emitido se puede solicitar `Subir a Drive y Sheets`. La accion omite destinos ya registrados y no vuelve a emitir en ARCA.
- Mercado Pago, ARCA y los destinos Google se configuran por tenant; no se usan destinos o tokens Google globales como fallback.

## Documentacion

- [Referencia completa de endpoints](docs/API_ENDPOINTS.md)
- [API Admin Monitor](docs/ADMIN_MONITOR_API.md)
- [API Portal Cliente](docs/PORTAL_API.md)
