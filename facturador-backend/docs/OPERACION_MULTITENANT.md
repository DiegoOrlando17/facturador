# Operacion Multitenant

## Objetivo

Dejar el proyecto listo para pruebas con un primer cliente operando como tenant inicial.

## Variables globales vs secretos por tenant

### Globales del proceso

Estas variables siguen siendo globales y aplican a toda la instancia:

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `ENABLE_WORKERS`
- `APP_MASTER_KEY` o `SECRETS_MASTER_KEY`
- `GOOGLE_REDIRECT_URI` o `GOOGLE_REDIRECT_BASE_URL`
- `GOOGLE_STATE_SECRET`
- `NGROK_URL`

### Compatibilidad legacy

Estas variables todavia pueden existir como fallback para instalaciones viejas o para bootstrap inicial:

- `MP_ACCESS_TOKEN`
- `MP_POS_ID`
- `MP_API_URL`
- `MP_POLLING_INTERVAL`
- `CUIT`
- `AFIP_*`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_PATH` o `GOOGLE_TOKEN_B64`
- `DRIVE_FOLDER_ID`
- `SHEET_ID`
- `SHEET_NAME`

### Secretos por tenant

Estas configuraciones deben quedar en `TenantIntegration.secretEnc`:

- `MERCADOPAGO`: `ACCESS_TOKEN`, `POS_ID`, `API_URL`, `POLLING_MODE`, `POLLING_INTERVAL_MS`, `RUNS_PER_DAY`, `RUN_AT_TIMES`
- `AFIP`: `CUIT`, `PTO_VTA`, `CBTE_TIPO`, `ALIC_IVA`, `WSAA_URL`, `WSFE_URL`, `CERT_PATH`, `KEY_PATH`, `CERT_B64`, `KEY_B64`
- `DRIVE`: `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `SCOPES`, `TOKEN_TYPE`, `DRIVE_FOLDER_ID`
- `SHEETS`: `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `SCOPES`, `TOKEN_TYPE`, `SHEETS_ID`, `SHEET_NAME`

## Bootstrap del primer tenant

Comando:

```bash
npm run tenant:bootstrap -- --slug cliente-1 --name "Cliente 1" --plan A --owner-email admin@cliente.com
```

Que hace:

1. Crea o actualiza el tenant.
2. Garantiza una suscripcion activa.
3. Crea el usuario owner si se pasa `--owner-email`.
4. Toma credenciales legacy del `.env` y las guarda cifradas en `TenantIntegration`.
5. Reasigna `Payment` e `InvoiceSequence` al tenant inicial si toda la data existente pertenece a un unico tenant previo.

## Reglas de seguridad del bootstrap

- Si `Payment` o `InvoiceSequence` ya tienen mas de un `tenantId` distinto, el script aborta.
- Si la data ya esta asociada al tenant objetivo, no cambia nada.
- Si existe un unico `tenantId` previo distinto al tenant objetivo, lo migra al tenant objetivo.

## Flujo sugerido para pruebas

1. Configurar `.env` legacy con las credenciales actuales.
2. Ejecutar `npm run tenant:bootstrap -- --slug <slug> --name "<nombre>" --plan A --owner-email <mail>`.
3. Revisar `GET /admin/tenants/<slug>` y `GET /admin/tenants/<slug>/integrations?revealSecrets=true`.
4. Si Google no vino desde token global, conectar con `GET /google/oauth/start?tenant=<slug>`.
5. Levantar API y workers.
6. Ejecutar pruebas end-to-end.

## Setup demo

Para un entorno de prueba simple:

```bash
npm run prisma db seed
npm run tenant:setup-demo
```

## Seed de checkpoint para pagos MP

Si el ambiente ya tiene muchos pagos y queres arrancar desde un punto puntual, el seed ahora puede dejar creado el checkpoint de `MERCADOPAGO` para un tenant.

Ejemplo:

```bash
npx prisma db seed -- --mp-tenant-slug demo --mp-checkpoint-timestamp 2026-04-09T12:30:00.000Z --mp-checkpoint-payment-id 123456789
```

Tambien podés usar variables de entorno:

```bash
$env:SEED_MP_TENANT_SLUG="demo"
$env:SEED_MP_CHECKPOINT_TIMESTAMP="2026-04-09T12:30:00.000Z"
$env:SEED_MP_CHECKPOINT_PAYMENT_ID="123456789"
npx prisma db seed
```

Ese checkpoint se guarda como el ultimo pago ya visto. A partir de ahi, el worker solo va a traer pagos con `date_approved` mayor o, si coincide la fecha, con `id` mayor.
