# Multitenant - checklist y convencion de trabajo

## Como trabajamos (importante)

- **Este archivo es solo seguimiento.** Tildar o destildar una tarea en el checklist **no dispara** cambios en el codigo ni avisa al asistente por si solo.
- **Antes de tocar codigo:** se muestra como quedaria el cambio (diff, fragmentos o descripcion concreta del archivo y lineas).
- **Solo se aplica** cuando vos lo aprobas explicitamente en el chat (por ejemplo: "dale", "aplica", "ok a este diff").
- Despues de aplicar, se actualiza este checklist para reflejar el estado real.

---

## Decisiones ya tomadas

| Tema | Decision |
|------|----------|
| Despliegue | Un tenant por cliente, misma base y misma instancia |
| Ingreso de pagos MP | **Polling** es el mecanismo real: los webhooks de MP **no** se usan para este caso (terminales fisicas standalone POS no se cubren bien con webhooks para consultar pagos). Puede existir codigo/ruta de webhook historico; no es el camino de produccion. |
| Polling MP | Depende del tenant: tiempo real vs N veces por dia; credenciales MP **por tenant** |
| Programacion MP | `POLLING_MODE`: `realtime` o `scheduled`; en `scheduled` se admite `RUN_AT_TIMES` y, como fallback, `RUNS_PER_DAY` |
| AFIP | TA por CUIT; cert/key recomendado: hibrido (base64 en DB en prod, paths opcionales en dev) |
| Drive / Sheets | Por tenant; cada cliente conecta su Google |
| Portal | Alta de tenants e integraciones; portal tenant + admin (futuro) |
| Migracion | Cliente actual = primer tenant y entorno de pruebas |
| Secretos | Cifrado de `secretEnc` recomendado antes de prod multitenant (clave maestra en env) |

---

## T0 - Como identifica el sistema al tenant (resuelto)

**No hace falta "una URL por tenant" para ingresar pagos**, porque el ingreso no depende de un callback HTTP por venta: el **worker de polling** corre en el servidor y, en cada ciclo (o segun cron por tenant):

1. Lista **tenants** con integracion `MERCADOPAGO` habilitada y modo **polling** activo.
2. Para **cada** uno tiene `tenantId` de antemano (viene de la base).
3. Usa el **access token (y demas datos)** guardados en `TenantIntegration` de **ese** tenant para llamar a la API de Mercado Pago.
4. Mantiene **checkpoint propio** por tenant (`IntegrationCheckpoint` / `valueJson`: ultimo `date_approved` + `lastPaymentId`), no un solo `SystemConfig` global.

Asi el "enrutado" es: **iteracion explicita por tenant**, no resolucion desde una URL externa.

**Webhooks:** baja prioridad para este producto; si en el futuro se mantuviera una ruta de prueba u otro flujo, el `tenantId` se podria pasar por query (`?tenant=slug`) o deprecar la ruta. **No bloquea** el diseno multitenant del polling.

---

## Backlog

### T0 - Diseno ingreso MP (polling)

- [x] Documentar que el ingreso multitenant es por **polling** con `tenantId` explicito y credenciales por tenant (ver seccion arriba)

### Fase A - Base y bloqueos

- [x] **A1** - Unificar `payment.worker` con datos solo del tenant (`afipCfg`); alinear `createInvoiceAFIP` con la llamada real
- [x] **A2** - Refactor AFIP: TA por CUIT (cache en memoria), emision y ultimo comprobante con config del tenant; cert/key desde `.env` o `CERT_B64`/`KEY_B64` en JSON
- [x] **A3** - Webhook: `upsertPayment(tenantId, ...)` + jobs con `tenantId`; worker webhook alineado (token MP global hasta fase B)
- [x] **A4** - Invoice worker: `tenantId` desde el job; PDF / Drive / Sheets con `getGoogleInvoiceContext` + opcionales `PDF_*` en AFIP

### Fase B - Mercado Pago por tenant

- [x] **B1** - `mercadopago.service`: credenciales por tenant (no solo `config.MP` global)
- [x] **B2** - Checkpoint por tenant (`IntegrationCheckpoint`), no `SystemConfig` global unico
- [x] **B3** - Worker polling: tenants con MP habilitado + modo acorde (`realtime` / `scheduled`)
- [x] **B4** - Programacion por tenant con `RUN_AT_TIMES` o fallback `RUNS_PER_DAY`

Convencion `TenantIntegration.secretEnc` para `MERCADOPAGO`:

```json
{
  "ACCESS_TOKEN": "APP_USR-...",
  "POS_ID": "12345678",
  "API_URL": "https://api.mercadopago.com/v1",
  "POLLING_MODE": "realtime",
  "POLLING_INTERVAL_MS": 5000,
  "RUNS_PER_DAY": 4,
  "RUN_AT_TIMES": ["09:00", "13:00", "17:00", "21:00"]
}
```

Notas:
- Si `POLLING_MODE = realtime`, se usa `POLLING_INTERVAL_MS`
- Si `POLLING_MODE = scheduled` y existe `RUN_AT_TIMES`, manda eso
- Si `POLLING_MODE = scheduled` y no existe `RUN_AT_TIMES`, se calculan slots uniformes con `RUNS_PER_DAY`

### Fase C - Google por tenant

- [x] **C1** - Persistir tokens Google por tenant (refresh cifrado, scopes)
- [x] **C2** - Flujo OAuth con `state` ligado al tenant
- [x] **C3** - `drive.service` / `sheets.service` parametrizados por tenant

Convencion `TenantIntegration.secretEnc` para Google:

```json
{
  "CLIENT_ID": "google-client-id",
  "CLIENT_SECRET": "google-client-secret",
  "REFRESH_TOKEN": "1//0g...",
  "SCOPES": [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets"
  ],
  "TOKEN_TYPE": "Bearer",
  "DRIVE_FOLDER_ID": "folder-id-opcional",
  "SHEETS_ID": "spreadsheet-id-opcional",
  "SHEET_NAME": "Hoja1"
}
```

Rutas OAuth Google:
- `GET /google/oauth/start?tenant=<slug>&driveFolderId=<id>&sheetsId=<id>&sheetName=<nombre>`
- `GET /google/oauth/callback`

Notas:
- El `state` viaja firmado y ligado al tenant
- `DRIVE` y `SHEETS` se persisten como integraciones separadas, compartiendo `REFRESH_TOKEN`, `SCOPES`, `CLIENT_ID` y `CLIENT_SECRET`
- Si no hay credenciales por tenant, el runtime sigue pudiendo caer al token global existente

### Fase D - Portal / API (encaje futuro)

- [x] **D1** - API alta de tenant (nombre, slug, estado)
- [x] **D2** - CRUD integraciones (MP, AFIP, Google) con validacion minima
- [x] **D3** - Roles (`TenantUser` / admin) cuando exista portal
- [x] **D4** - Cifrado al escribir/leer `secretEnc`

Rutas admin minimas:
- `GET /admin/tenants`
- `POST /admin/tenants`
- `GET /admin/tenants/:slug`
- `PATCH /admin/tenants/:slug`
- `GET /admin/tenants/:slug/integrations`
- `PUT /admin/tenants/:slug/integrations/:provider`
- `GET /admin/tenants/:slug/users`
- `PUT /admin/tenants/:slug/users`

Notas:
- `secretEnc` ahora se escribe cifrado con AES-256-GCM usando `APP_MASTER_KEY` o `SECRETS_MASTER_KEY`
- Se mantiene compatibilidad de lectura con integraciones viejas que aun tengan JSON plano
- La API devuelve secretos enmascarados por defecto
- `GET /admin/tenants/:slug/integrations?revealSecrets=true` permite ver configuracion desenmascarada para administracion interna

### Fase E - Migracion y operacion

- [x] **E1** - Migracion: cliente actual como tenant #1; datos existentes con `tenantId`
- [x] **E2** - Documentar env global vs secretos por tenant

Runbook:
- Ver [docs/OPERACION_MULTITENANT.md](/c:/Users/Diego/Documents/PersonalProjects/facturador/docs/OPERACION_MULTITENANT.md)

Comandos operativos:
- `npm run tenant:bootstrap -- --slug <slug> --name "<nombre>" --plan A --owner-email <mail>`
- `npm run tenant:setup-demo`

Notas:
- `tenant:bootstrap` toma credenciales legacy del `.env`, las persiste cifradas en `TenantIntegration` y reasigna `Payment` / `InvoiceSequence` al tenant inicial cuando es seguro hacerlo
- Si encuentra mas de un `tenantId` distinto en datos operativos, aborta para no mezclar clientes
- `setup-demo` tambien quedo alineado con el cifrado de `secretEnc`

---

## Historial de cambios (opcional)

- 2026-04-01 - Fase B completada: Mercado Pago por tenant, checkpoints por tenant, polling multitenant y programacion `realtime` / `scheduled`.
- 2026-04-02 - Fase C completada: Google por tenant con persistencia de credenciales, OAuth con `state` firmado y contexto Drive/Sheets por tenant.
- 2026-04-02 - Fase D completada: API admin para tenants e integraciones, roles basicos en `TenantUser` y cifrado de `secretEnc`.
- 2026-04-02 - Fase E completada: script de bootstrap del tenant inicial, migracion segura de datos operativos y runbook de operacion multitenant.
