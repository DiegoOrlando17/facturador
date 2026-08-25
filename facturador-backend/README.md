# facturador

Facturador de mercado pago.

## Roles y permisos

- Admin `SUPERADMIN`: acceso completo, incluidos admins, planes, suscripciones, eliminacion de tenants y revelacion explicita de secretos.
- Admin `OPERATOR`: lectura y operacion cotidiana de tenants; no administra privilegios globales ni elimina tenants.
- Admin `VIEWER`: solo lectura.
- Portal `owner/admin`: lectura y acciones operativas disponibles.
- Portal `approver/viewer`: solo lectura hasta implementar el flujo formal de aprobacion.

Los secretos se devuelven enmascarados por defecto y `passwordHash` nunca forma parte de las respuestas de usuarios tenant. La matriz completa esta en `../docs/ai/SECURITY_PERMISSIONS.md`.

## Entregas de comprobantes

- Todo comprobante emitido en ARCA puede descargarse como PDF; se genera en memoria cuando el usuario lo solicita y no se persiste localmente.
- Drive/Sheets es opcional y se procesa solo para tenants con suscripcion activa, entitlement `googleDriveSheets` e integraciones `DRIVE` y `SHEETS` completas.
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

Con workers activos y ARCA/Google de prueba, ejecutar un flujo integral mediante un pago sintetico:

```powershell
npm run invoice:test-flow -- --tenant=SLUG --dry-run
npm run invoice:test-flow -- --tenant=SLUG --amount=100 --require-drive --require-sheets
```

El comando solo acepta PostgreSQL local y ARCA en homologacion. La segunda ejecucion crea efectos reales en los recursos externos de prueba.
- Mercado Pago, ARCA y los destinos Google se configuran por tenant; no se usan destinos o tokens Google globales como fallback.

## Documentacion

- [Referencia completa de endpoints](docs/API_ENDPOINTS.md)
- [API Admin Monitor](docs/ADMIN_MONITOR_API.md)
- [API Portal Cliente](docs/PORTAL_API.md)
