# facturador

Facturador de mercado pago.

## Entregas de comprobantes

- Todo comprobante emitido en ARCA genera un PDF descargable.
- Drive/Sheets es opcional y se procesa solo para tenants con suscripcion activa, plan con `featuresJson.googleDriveSheets: true` e integraciones `DRIVE` y `SHEETS` completas.
- Mercado Pago, ARCA y los destinos Google se configuran por tenant; no se usan destinos o tokens Google globales como fallback.

## Documentacion

- [Referencia completa de endpoints](docs/API_ENDPOINTS.md)
- [API Admin Monitor](docs/ADMIN_MONITOR_API.md)
- [API Portal Cliente](docs/PORTAL_API.md)
