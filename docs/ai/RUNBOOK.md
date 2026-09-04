# Runbook local y operativo

Ultima revision: 2026-08-26

Estado: monorepo consolidado. PostgreSQL, Redis, migraciones, datos demo, API, workers, frontend, login admin, portal cliente y descarga PDF fueron validados manualmente. Las integraciones externas mantienen sus validaciones especificas pendientes.

Alta publica: aplicar la migracion `20260904120000_public_registration` antes de habilitar `/registro`. En desarrollo, la API devuelve el token de verificacion para probar el circuito local. En `NODE_ENV=production` nunca lo expone; el alta no debe publicarse hasta conectar un transporte de email. El proveedor de cobro recurrente sigue pendiente y las nuevas suscripciones se crean `PAST_DUE`, sin capacidades operativas.

## 1. Requisitos

- Node.js 18 o superior.
- npm.
- PostgreSQL accesible.
- Redis accesible.
- Credenciales sandbox/test para las integraciones que se quieran probar.

No usar credenciales ni bases de produccion para completar la puesta en marcha local.

## 2. Estructura de ejecucion

Se usan tres procesos independientes:

1. API: `facturador-backend/`.
2. Workers: `facturador-backend/`.
3. Frontend: `facturador-frontend/`.

La API usa por defecto el puerto `5000`. Vite define el puerto del frontend al iniciar.

## 3. Instalacion

Backend:

```powershell
cd facturador-backend
npm install
```

Frontend:

```powershell
cd facturador-frontend
npm install
```

Los repositorios contienen `package-lock.json`; cualquier cambio de dependencias debe conservarlo.

## 4. Variables de entorno

El backend carga `facturador-backend/.env`. No copiar secretos a documentacion ni commits.

### Minimo para API, datos y workers

```dotenv
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
REDIS_URL=redis://HOST:6379
ENABLE_WORKERS=true
DEFAULT_TENANT_SLUG=demo

APP_MASTER_KEY=<clave-aleatoria-fuerte>
ADMIN_TOKEN_SECRET=<secreto-aleatorio-fuerte>
TENANT_TOKEN_SECRET=<secreto-aleatorio-fuerte>
ADMIN_TOKEN_TTL_HOURS=12
TENANT_TOKEN_TTL_HOURS=12
```

`APP_MASTER_KEY`/`SECRETS_MASTER_KEY` protege credenciales por tenant. No cambiarla sin un procedimiento de rotacion porque puede volver ilegibles los secretos existentes. Los fallbacks incluidos en codigo son solo para desarrollo y no son seguros para produccion.

### Mercado Pago

```dotenv
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_API_URL=
MP_POLLING_INTERVAL=
MP_POS_ID=
```

Las variables globales son compatibilidad heredada/default. El modelo objetivo usa configuracion cifrada por tenant.

Regla critica para `fiebre`: Mercado Pago usa credenciales productivas y es estrictamente de solo lectura para polling y consulta de pagos POS reales. No crear pagos, preferencias, card tokens ni otros recursos en MP. ARCA, Drive y Sheets de este tenant son de prueba. No existe ningun endpoint para crear pagos en Mercado Pago.

`invoice:test-flow` no crea pagos en Mercado Pago: en ejecucion real inserta un `Payment` sintetico solo en PostgreSQL local y lo encola; con `--dry-run` tampoco inserta datos.

### ARCA/AFIP

```dotenv
CUIT=
AFIP_PRODUCTION=false
AFIP_PTO_VTA=1
AFIP_CBTE_TIPO=6
AFIP_ALIC_IVA=21
AFIP_WSAA_URL=
AFIP_WSFE_URL=

AFIP_CERT_PATH=
AFIP_KEY_PATH=
AFIP_TA_PATH=
AFIP_TRA_PATH=
AFIP_TRACMS_PATH=
```

Como alternativa de despliegue, el codigo admite `AFIP_CERT_B64`, `AFIP_KEY_B64`, `AFIP_TA_B64`, `AFIP_TRA_B64` y `AFIP_TRACMS_B64`, que se materializan con permisos restringidos en el directorio temporal del sistema al arrancar. Probar primero contra homologacion (`AFIP_PRODUCTION=false`).

### Google

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/google/oauth/callback
GOOGLE_STATE_SECRET=<secreto-aleatorio-fuerte>
```

El OAuth por tenant requiere un cliente de tipo **Web application**. En Google Cloud, registrar como Authorized redirect URI exactamente el mismo valor de `GOOGLE_REDIRECT_URI` (incluidos esquema, host, puerto, path y barra final). No usar para este flujo un cliente Desktop/Installed ni depender del fallback `NGROK_URL`. Para desarrollo local se recomienda `http://localhost:5000/google/oauth/callback`; reiniciar la API despues de cambiar las credenciales o la URI.

`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` identifican a la aplicacion Facturador frente a Google; no son credenciales del tenant. Para cada tenant, usar `Conectar / reautorizar Google` desde la pestaña Integraciones del detalle admin. El backend genera una URL firmada y efimera, el callback resuelve el tenant desde DB y guarda su refresh token cifrado en `DRIVE` y `SHEETS`, conservando carpeta, spreadsheet y hoja. No existe token global ni inicio OAuth publico por slug.

Para auditar las entregas de un tenant sin modificar PostgreSQL, Drive o Sheets:

```powershell
cd facturador-backend
npm run google:audit-deliveries -- --tenant=SLUG
```

La salida JSON usa codigo `0` sin inconsistencias criticas, `2` si detecta referencias faltantes/duplicadas y `1` si la auditoria no pudo completarse. Los recursos externos sin correspondencia local se informan como advertencias y nunca se eliminan.

La configuracion operativa objetivo es por tenant y debe identificar, como minimo:

- refresh token cifrado obtenido mediante el consentimiento del cliente;
- carpeta Drive destino de los PDF;
- spreadsheet y hoja donde se registran los comprobantes.

Drive/Sheets es opcional y esta disponible desde la tier 3. Antes de configurarlo o procesar entregas, validar el plan vigente del tenant. Drive recibe solo comprobantes emitidos correctamente en ARCA; Sheets registra tambien los intentos fallidos. Antes de reprocesar una entrega, comprobar `drive_file_link`, `sheets_row` y los eventos del pago para evitar archivos o filas duplicados.

Los PDF no se almacenan localmente: portal/admin los generan en memoria bajo demanda. El worker solo crea un archivo dentro del directorio temporal del sistema cuando debe subirlo a Drive y lo elimina al finalizar el intento. La carpeta heredada `facturas/` no forma parte del flujo vigente.

La politica versionada del plan tier 3 debe declarar la capacidad de Google en `featuresJson`:

```json
{
  "schemaVersion": 1,
  "tier": 3,
  "entitlements": {
    "googleDriveSheets": true
  },
  "limits": {},
  "processing": {
    "allowedModes": ["realtime", "scheduled"],
    "defaultMode": "realtime"
  }
}
```

Sin suscripcion `ACTIVE`, sin ese entitlement o sin ambas integraciones completas, el worker omite Google y completa el pago despues de generar el PDF.

Para entregar a Google un comprobante ya facturado, usar `Subir a Drive y Sheets` desde su detalle admin. Esta accion ejecuta solo el postproceso Google, conserva la emision ARCA y omite los destinos que ya tengan `drive_file_link` o `sheets_row`.

Sheets mantiene una fila por `provider_payment_id`. En errores ARCA se escribe `ERROR` con el mensaje disponible, sin PDF ni Drive. Cuando un reintento factura correctamente, se actualiza la misma fila a `OK` con comprobante, CAE y enlace Drive. Desde el detalle admin, los pagos sin CAE ofrecen `Registrar error en Sheets`.

### Frontend

La API base se controla mediante:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

Si no se define, el frontend usa `/api`, lo que requiere un proxy o despliegue bajo el mismo origen.

## 5. Base de datos

Desde `facturador-backend/`:

```powershell
npx prisma generate
npx prisma migrate deploy
```

Para desarrollo de nuevas migraciones usar `npx prisma migrate dev` solo sobre una base local descartable. No ejecutar migrations destructivas o comandos de reset contra produccion.

Datos iniciales disponibles:

```powershell
npx prisma db seed
npm run admin:create-user -- --help
npm run tenant:setup-demo
```

Sincronizar el catalogo vigente de planes sin eliminar planes ni reasignar tenants:

```powershell
npm run plans:sync
```

El comando crea o actualiza `TIER_1` a `TIER_4`, es idempotente y sincroniza nombres, precios mensuales en USD y la politica comercial vigente. Revisar el cambio antes de ejecutarlo en un ambiente compartido.

Antes de usar scripts administrativos, revisar sus argumentos y apuntar explicitamente a la base correcta. `tenant:bootstrap` y `mp:reset-from-checkpoint` modifican estado y requieren backup/checkpoint y validacion del tenant objetivo.

Nota Windows: `prisma generate` puede fallar si un proceso Node mantiene bloqueado el engine; detener API/workers, regenerar y reiniciar.

La migracion `20260814120000_invoice_domain` crea el dominio fiscal separado y copia de forma aditiva los datos existentes de `Payment`. Despues de aplicarla, verificar las invariantes del backfill:

```powershell
npm run invoice:verify-backfill
```

El comando debe informar `valid: true`, igual cantidad de pagos y facturas vinculadas, cero duplicados y ninguna factura `ISSUED` sin CAE o numero de comprobante. Fue validado sobre la base local el 2026-08-14 con 330 registros.

Verificar que listados, detalle y CSV prioricen `Invoice` sin romper el contrato compatible ni el aislamiento por tenant:

```powershell
npm run invoice:verify-read-model
```

El comando fue validado el 2026-08-15 sobre la base local.

### Prueba integral con pago sintetico

Con API/workers ejecutandose, PostgreSQL local, ARCA en homologacion y recursos Google de prueba, validar primero las protecciones sin crear datos:

```powershell
npm run invoice:test-flow -- --tenant=SLUG --dry-run
```

Ejecutar el flujo real controlado:

```powershell
npm run invoice:test-flow -- --tenant=SLUG --amount=100 --require-drive --require-sheets
```

Para validar de forma deterministica error ARCA, reintento y Sheets `ERROR` -> `OK`:

```powershell
npm run invoice:test-flow -- --tenant=SLUG --amount=100 --require-drive --require-sheets --verify-error-recovery
```

La falla controlada solo se acepta para el pago sintetico `test_flow` y configuracion de homologacion. La primera pasada no consulta ni consume numeracion ARCA; el reintento exitoso si emite un comprobante de homologacion y debe conservar la misma fila Sheets.

El comando crea un `Payment` sintetico, lo encola, espera `Payment.complete`/`Invoice.ISSUED`, genera el PDF y reencola el mismo pago para comprobar idempotencia. Solo admite PostgreSQL local y rechaza configuraciones/URLs ARCA que parezcan productivas. La ejecucion consume numeracion de homologacion y puede crear un archivo y una fila reales en Drive/Sheets de prueba; esos efectos externos no se revierten automaticamente.

Validacion registrada el 2026-09-01 para `fiebre`: estado final `complete`/`ISSUED`, comprobante de homologacion, un documento Drive, una fila Sheets y segunda pasada idempotente. La auditoria posterior no detecto documentos registrados faltantes, IDs duplicados ni filas desalineadas.

La variante `--verify-error-recovery` tambien fue validada el 2026-09-01: alcanzo `afip_pending`/`FAILED`, escribio `ERROR` en Sheets, recupero en homologacion a `complete`/`ISSUED` con CAE, actualizo la misma fila a `OK`, conservo un unico documento Drive y supero la segunda pasada idempotente.

La migracion `20260816100000_remove_payment_fiscal_fields` elimina de `Payment` las columnas fiscales y de documentos despues de copiar referencias Drive/PDF heredadas a `InvoiceDocument`. Fue aplicada y validada localmente el 2026-08-16 con backup previo. Antes de aplicarla en otro ambiente, generar un `pg_dump`, verificar el archivo y detener API/workers para regenerar Prisma Client sin bloqueos de Windows.

## 6. Arranque local

Terminal 1, API:

```powershell
cd facturador-backend
npm start
```

Terminal 2, workers:

```powershell
cd facturador-backend
npm run start:workers
```

Terminal 3, frontend:

```powershell
cd facturador-frontend
npm run dev
```

`ENABLE_WORKERS=true` es necesario para que el launcher cree los workers. El launcher vigente inicia payment, invoice, retry, polling de Mercado Pago, audit, notas de credito y facturas manuales.

La deteccion de ventas Mercado Pago POS se realiza exclusivamente por polling/checkpoints. No existe un endpoint de webhook para este flujo y Payway no forma parte del producto.

El scheduler por tenant acepta:

- `POLLING_MODE=realtime` con `POLLING_INTERVAL_MS` igual o mayor a 5000;
- `POLLING_MODE=scheduled` con `RUN_AT_TIMES` en formato `HH:mm` o el fallback `RUNS_PER_DAY`;
- `TIMEZONE` como zona IANA, con default `America/Argentina/Buenos_Aires`.

La configuracion debe estar permitida por la politica del plan. El polling reclama en Redis un lock por tenant y slot para excluir replicas concurrentes. Redis debe usar una politica `noeviction`; validar esta configuracion antes de escalar workers horizontalmente.

## 7. Verificacion

### Checks validados

Frontend:

```powershell
cd facturador-frontend
npm run build
```

Resultado: correcto el 2026-08-26 (TypeScript y build Vite).

Sintaxis backend:

```powershell
cd facturador-backend
Get-ChildItem -Recurse -File -Filter '*.js' src,prisma | ForEach-Object { node --check $_.FullName }
```

Resultado: correcto el 2026-08-26.

Tests unitarios backend:

```powershell
cd facturador-backend
npm test
```

Resultado: 71 tests correctos el 2026-09-02. La suite incluye endpoints admin, permisos tenant, protecciones, auditoria, estados fiscales, programacion diferida y validaciones de facturacion manual; no ejecuta emisiones ni escrituras en Mercado Pago, ARCA o Google.

### Salud operativa admin

`GET /admin/health` y la seccion web `Integraciones` ejecutan diagnosticos de solo lectura:

- PostgreSQL: `SELECT 1`;
- Redis: conexion y `PING`;
- BullMQ: conteos `waiting`, `active`, `delayed` y `failed` de las colas de pagos y facturas;
- workers: procesos visibles desde la maquina o contenedor de la API;
- Mercado Pago: `GET /users/me`, sin crear ni modificar recursos;
- ARCA: disponibilidad HTTP del web service, sin solicitar CAE ni emitir comprobantes;
- Drive/Sheets: conteo de configuraciones por tenant, sin llamadas que creen o modifiquen archivos o filas.

Si API y workers se despliegan en procesos o contenedores separados, la deteccion local puede mostrar workers no visibles. Interpretar esa señal junto con los conteos y el movimiento de las colas.

### Acciones fiscales administrativas

- `POST /admin/payments/:id/issue` encola la emision de una factura pendiente asociada a un pago y reutiliza las protecciones fiscales existentes.
- `POST /admin/payments/:id/credit-note` con `{ "confirmation": "ANULAR" }` crea o reutiliza una nota de credito de anulacion total y la envia a la cola `credit-notes`.
- Ambas acciones requieren `admin.operate` y generan auditoria; la nota de credito requiere el entitlement `creditNotes`.
- `npm run start:workers` incluye `creditNote.worker.js`. Reiniciar el launcher despues de desplegar este cambio.
- `npm run start:workers` incluye `manualInvoice.worker.js`; sin este proceso las facturas manuales quedan en `QUEUED`.

No validar notas de credito contra ARCA productiva. Usar un tenant con certificado, URLs y punto de venta de homologacion, una factura de homologacion emitida y plan elegible. La implementacion y el SOAP asociado tienen cobertura automatizada, pero la emision integral de una nota de credito queda pendiente de validacion manual controlada en homologacion.

La modalidad con confirmacion guarda `INVOICE_MODE=confirmation` en la configuracion Mercado Pago del tenant. Una venta crea `Invoice.PENDING_CONFIRMATION`; confirmar desde el portal la pasa a `QUEUED` y crea un job inmediato o diferido hasta 30 dias. La factura manual usa la cola `manual-invoices` y no crea un `Payment` sintetico. Validar ambos flujos solamente en homologacion antes de habilitarlos en produccion.

Prisma:

```powershell
cd facturador-backend
npx prisma validate
```

Resultado de `npx prisma validate`: esquema valido el 2026-08-26. Las migraciones, la creacion de datos demo, tenants y planes fueron ejecutadas correctamente en el entorno local, segun validacion manual reportada el 2026-08-14.

### Validaciones manuales completadas

1. PostgreSQL y Redis accesibles.
2. Migraciones aplicadas y datos demo creados.
3. Tenants y planes disponibles.
4. API, workers y frontend iniciados correctamente.
5. Login y navegacion principal del panel admin operativos.
6. Descarga de PDF operativa.
7. El tenant `fiebre` completo manualmente el happy path MP por polling -> ARCA -> PDF -> Drive/Sheets, reportado el 2026-08-26.

Estas validaciones fueron reportadas manualmente el 2026-08-14; no representan una suite automatizada.

### Validaciones diferidas

- El login y los flujos de `/portal` se validaran integralmente al implementar el portal cliente web. Actualmente `/portal-cliente` es un prototipo estatico y una prueba aislada de la API no se considera criterio de cierre inmediato.

No ejecutar pruebas de integraciones con ventas, certificados, puntos de venta o recursos Google de produccion.

## 8. Salud y diagnostico

- `/health` solo prueba que Express responde; no valida DB, Redis ni workers.
- Revisar logs separados de API y workers, sin imprimir tokens o certificados.
- Para pagos atascados, revisar `Payment.status`, `PaymentEvent`, job/cola y checkpoint del tenant antes de reprocesar.
- Para integraciones, usar primero los endpoints de test admin/portal con secretos enmascarados.
- Consultar `docs/ai/ERRORS.md` antes de investigar errores recurrentes.

## 9. Seguridad operativa

- No usar los secretos fallback del codigo en produccion.
- No revelar `secretEnc`, hashes o tokens en respuestas/logs.
- No editar pagos, secuencias o estados directamente en DB salvo procedimiento aprobado con backup y rollback.
- Cualquier reproceso debe identificar tenant y pago, ser idempotente y dejar auditoria.
- El postproceso Drive/Sheets usa el lock Redis `facturador:invoice-post:<tenantId>:<paymentId>` para impedir entregas concurrentes del mismo pago entre replicas o jobs manuales y automaticos.
- Antes de migrar produccion: backup verificado, revision SQL, ventana de despliegue y plan de rollback.

## 10. Deploy, backup y rollback

Todavia no existe un procedimiento validado. No considerar el sistema listo para produccion hasta definir y probar:

- hosting y procesos separados para API/frontend/workers;
- PostgreSQL, Redis y storage persistente;
- gestion/rotacion de secretos;
- migrations automatizadas con control de version;
- backups de DB y archivos, restauracion probada;
- healthchecks profundos, alertas y logs centralizados;
- rollback de aplicacion y compatibilidad de schema.
