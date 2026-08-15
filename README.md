# facturador

Facturador de mercado pago.

## Entregas de comprobantes

- Todo comprobante emitido en ARCA puede descargarse como PDF; se genera en memoria cuando el usuario lo solicita y no se persiste localmente.
- Drive/Sheets es opcional y se procesa solo para tenants con suscripcion activa, plan con `featuresJson.googleDriveSheets: true` e integraciones `DRIVE` y `SHEETS` completas.
- Para Drive, el worker genera un PDF temporal y lo elimina despues del intento de subida, incluso si falla.
- Desde el detalle admin de un comprobante ya emitido se puede solicitar `Subir a Drive y Sheets`. La accion omite destinos ya registrados y no vuelve a emitir en ARCA.
- Sheets funciona como registro operativo: agrega una fila por pago y actualiza esa misma fila con estado `ERROR` u `OK` en cada intento. Los errores ARCA se registran aunque no exista PDF; Drive solo aplica a comprobantes emitidos.

## Planes

Los planes vigentes se sincronizan de forma idempotente con:

```powershell
npm run plans:sync
```

El catalogo `TIER_1` a `TIER_4` y sus entitlements acumulativos se define en `src/config/planCatalog.js`. Los precios permanecen sin definir hasta su aprobacion comercial.

El dominio fiscal separado se crea mediante las migraciones Prisma. Despues de aplicar `20260814120000_invoice_domain`, validar el backfill de pagos existentes con:

```powershell
npm run invoice:verify-backfill
```

Validar tambien el modelo de lectura compatible utilizado por admin, portal y CSV:

```powershell
npm run invoice:verify-read-model
```
- Mercado Pago, ARCA y los destinos Google se configuran por tenant; no se usan destinos o tokens Google globales como fallback.

## Documentacion

- [Referencia completa de endpoints](docs/API_ENDPOINTS.md)
- [API Admin Monitor](docs/ADMIN_MONITOR_API.md)
- [API Portal Cliente](docs/PORTAL_API.md)
