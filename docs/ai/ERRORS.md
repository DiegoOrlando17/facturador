# ERRORS.md

Reusable debugging notes for recurring or high-value errors.

Do not use this as a task history. Commits are the task history.

---
# Secretos Google expuestos en errores HTTP detallados

Area: Node | Google OAuth | Seguridad
Status: partial
Last seen: 2026-08-30

### Symptoms

Al imprimir un error Axios completo durante la renovacion OAuth, la configuracion de la solicitud puede incluir `client_secret` y `refresh_token`.

### Root cause

La renovacion enviaba credenciales como query params. Axios conserva URL, parametros y configuracion dentro del objeto de error, que puede volcarse accidentalmente en diagnosticos detallados.

### Fix

- Enviar credenciales OAuth como cuerpo `application/x-www-form-urlencoded`, nunca como query string.
- Capturar el error HTTP dentro del servicio y devolver solo status/codigo Google sanitizados.
- Si hubo una exposicion, rotar el Client Secret, revocar la autorizacion afectada y reautorizar el tenant.

### First checks next time

1. No imprimir objetos Axios completos ni `error.config`.
2. Buscar secretos en URL, params, logs y salidas de CI/diagnostico.
3. Confirmar la rotacion antes de reutilizar la integracion.

### Related files

- `facturador-backend/src/services/googleToken.service.js`
- `facturador-backend/src/services/tenantGoogle.service.js`
- `facturador-backend/src/services/integrationTest.service.js`

# Pagos quedan en processing despues de un fallo Google

Area: Node | BullMQ | Google Drive/Sheets | Workers
Status: solved
Last seen: 2026-08-28

### Symptoms

Tras corregir o reautorizar Google, las facturas ya emitidas permanecen en `processing` y el retry worker no vuelve a procesarlas.

### Root cause

El postproceso obtenia el contexto Google mientras el pago seguia en `processing`. Si la autenticacion fallaba, el error se relanzaba sin moverlo a un estado reintentable. Ademas, el retry worker no consultaba `processing` y un job BullMQ fallido conservado con el mismo `jobId` no se reencolaba mediante un nuevo `add`.

### Fix

- Un fallo de autenticacion Google posterior a una factura `ISSUED` mueve el pago a `drive_pending`.
- El retry worker recupera `processing` solo cuando la factura ya esta `ISSUED` y ejecuta exclusivamente el postproceso.
- Los estados `processing` con emision fiscal incierta no se reintentan automaticamente en ARCA.
- Un job fallido con el mismo ID se reemplaza antes de reencolarlo.

### First checks next time

1. Comparar `Payment.status` con `Invoice.status` y confirmar si existe CAE.
2. Verificar que `retry.worker.js` este ejecutandose y conectado a Redis.
3. Revisar el estado del job deterministico en BullMQ.
4. Nunca reenviar a ARCA automaticamente una factura con estado fiscal incierto.

### Related files

- `facturador-backend/src/workers/invoice.worker.js`
- `facturador-backend/src/workers/retry.worker.js`
- `facturador-backend/src/domain/retryPolicy.js`
- `facturador-backend/src/models/Payment.js`

# Google OAuth: Error 400 redirect_uri_mismatch

Area: Node | Google OAuth | Admin
Status: partial
Last seen: 2026-08-28

### Symptoms

Al usar `Conectar / reautorizar Google`, Google muestra `Acceso bloqueado` y `Error 400: redirect_uri_mismatch`.

### Root cause

El backend enviaba el callback derivado de un `NGROK_URL` heredado porque `GOOGLE_REDIRECT_URI` no estaba definido. Ademas, el `GOOGLE_CLIENT_ID` local correspondia a un cliente OAuth `installed`, mientras el portal usa el flujo de servidor web.

### Fix

- Crear en Google Cloud un cliente OAuth de tipo `Web application`.
- Registrar exactamente `http://localhost:5000/google/oauth/callback` para desarrollo local, o el callback HTTPS estable del ambiente.
- Configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI` con ese cliente y reiniciar la API.
- El backend ahora rechaza iniciar OAuth por tenant si `GOOGLE_REDIRECT_URI` no esta definido explicitamente.

### First checks next time

1. Confirmar el valor efectivo de `GOOGLE_REDIRECT_URI` sin imprimir secretos.
2. Verificar que el cliente sea `Web application`, no Desktop/Installed.
3. Comparar esquema, host, puerto, path y barra final con Authorized redirect URIs.
4. Reiniciar la API despues de modificar `.env`.

### Related files

- `facturador-backend/src/config/index.js`
- `facturador-backend/src/services/tenantGoogle.service.js`
- `facturador-backend/src/routes/admin.routes.js`

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

- `facturador-backend/src/workers/invoice.worker.js`
- `facturador-backend/src/services/tenantGoogle.service.js`
- `facturador-backend/src/services/tenantConfig.service.js`
