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
- `APP_MASTER_KEY` o `SECRETS_MASTER_KEY` (obligatoria en produccion)
- `ADMIN_TOKEN_SECRET`, `TENANT_TOKEN_SECRET` (obligatorios en produccion)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (aplicacion OAuth de la plataforma)
- `GOOGLE_REDIRECT_URI` o `GOOGLE_REDIRECT_BASE_URL`
- `GOOGLE_STATE_SECRET`
- `NGROK_URL`
- `MP_API_URL` (default `https://api.mercadopago.com`)
- `AFIP_WSAA_URL`, `AFIP_WSFE_URL` (endpoints por defecto; el tenant puede sobreescribirlos con `WSAA_URL`/`WSFE_URL` o `ENV`)
- `AFIP_PRODUCTION` (bandera de seguridad de `invoice:test-flow`)
- Variables de billing/email (`MP_BILLING_*`, `BILLING_BACK_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL`)

### Variables legacy retiradas

El fallback single-tenant fue eliminado: el codigo ya no lee credenciales de clientes desde el `.env`.
Un tenant sin sus credenciales en `TenantIntegration` se saltea con un error claro
("La integración de Mercado Pago del cliente no tiene credenciales" / "La integración de ARCA del cliente no tiene credenciales")
y los workers siguen con el resto de los tenants. No volver a agregar:

- `CUIT`, `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_POS_ID`, `MP_POLLING_INTERVAL`
- `AFIP_PTO_VTA`, `AFIP_CBTE_TIPO`, `AFIP_ALIC_IVA`
- `AFIP_CERT_PATH`, `AFIP_KEY_PATH`, `AFIP_TA_PATH`, `AFIP_TRA_PATH`, `AFIP_TRACMS_PATH`, `AFIP_*_B64`
- `GOOGLE_TOKEN_PATH`, `DRIVE_FOLDER_ID`, `SHEET_ID`, `SHEET_NAME`
- `DEFAULT_TENANT_SLUG`

### Secretos por tenant

Estas configuraciones deben quedar en `TenantIntegration.secretEnc`:

- `MERCADOPAGO`: `ACCESS_TOKEN`, `POS_ID`, `API_URL`, `POLLING_MODE`, `POLLING_INTERVAL_MS`, `RUNS_PER_DAY`, `RUN_AT_TIMES`
- `AFIP`: `CUIT`, `PTO_VTA`, `CBTE_TIPO`, `ALIC_IVA`, `ENV` (`homologacion`/`produccion`), `WSAA_URL`, `WSFE_URL`, `CERT_PATH`, `KEY_PATH`, `CERT_B64`, `KEY_B64`
- `DRIVE`: `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `SCOPES`, `TOKEN_TYPE`, `DRIVE_FOLDER_ID`
- `SHEETS`: `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`, `SCOPES`, `TOKEN_TYPE`, `SHEETS_ID`, `SHEET_NAME`

## Alta de tenants

El script `tenant:bootstrap` (que copiaba credenciales legacy del `.env` a un tenant) fue retirado.
Los tenants se crean desde el panel admin / `POST /admin/tenants` o por el alta publica + onboarding,
y sus credenciales se cargan en la pestaña Integraciones del detalle admin.

## Flujo sugerido para pruebas

1. Crear el tenant desde el panel admin y cargar sus integraciones (Mercado Pago, ARCA).
2. Revisar `GET /admin/tenants/<slug>` y `GET /admin/tenants/<slug>/integrations?revealSecrets=true`.
4. Conectar o reautorizar Google desde Integraciones en el detalle admin del tenant; el inicio OAuth publico fue retirado.
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
