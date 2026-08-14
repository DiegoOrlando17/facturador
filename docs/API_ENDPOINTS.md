# API Endpoints

Referencia completa de endpoints expuestos por la API.

Base URL local por defecto:

```http
http://localhost:<PORT>
```

El `PORT` se toma de la configuracion de la aplicacion.

## Convenciones

- Todas las respuestas JSON usan `Content-Type: application/json`, salvo CSV, PDF y redirects.
- Los IDs `BigInt` se serializan como `string`.
- Las fechas se devuelven como ISO string.
- Los errores JSON siguen este formato:

```json
{
  "error": "mensaje"
}
```

## Autenticacion

Los endpoints protegidos usan bearer token:

```http
Authorization: Bearer <token>
```

Tokens disponibles:

- Admin: se obtiene con `POST /admin/auth/login`.
- Portal tenant: se obtiene con `POST /portal/auth/login`.

Codigos comunes:

- `400 Bad Request`: parametros/body invalidos o error de validacion.
- `401 Unauthorized`: falta token, token invalido, usuario inactivo o tenant inactivo.
- `404 Not Found`: recurso no encontrado.
- `500 Internal Server Error`: error interno/no controlado.

## Valores de referencia

Payment statuses:

- `pending`
- `processing`
- `afip_pending`
- `pdf_pending`
- `drive_pending`
- `sheets_pending`
- `complete`
- `failed`

Payment event types:

- `payment_detected`
- `payment_updated`
- `invoice_requested`
- `afip_ok`
- `pdf_ok`
- `drive_ok`
- `sheets_ok`
- `retry_scheduled`
- `retried`
- `failed`
- `note_added`

Tenant statuses:

- `ACTIVE`
- `DISABLED`

Tenant user roles:

- `owner`
- `admin`
- `viewer`
- `approver`

Tenant user statuses:

- `ACTIVE`
- `DISABLED`

Tenant onboarding statuses:

- `pending`
- `approved`
- `rejected`

Integration providers:

- `MERCADOPAGO`
- `AFIP`
- `DRIVE`
- `SHEETS`

Granularidades de reportes:

- `day`
- `week`
- `month`

## Indice rapido

| Metodo | Path | Auth | Descripcion |
| --- | --- | --- | --- |
| GET | `/health` | No | Healthcheck basico |
| GET | `/google/oauth/start` | No | Inicia OAuth Google para un tenant |
| GET | `/google/oauth/callback` | No | Callback OAuth Google |
| POST | `/api/crear-pago-mp` | No | Crea pago de prueba en Mercado Pago |
| POST | `/admin/auth/login` | No | Login admin |
| POST | `/admin/auth/logout` | No | Logout admin del lado cliente |
| GET | `/admin/me` | Admin | Usuario admin autenticado |
| GET | `/admin/dashboard` | Admin | Dashboard global |
| GET | `/admin/reports/summary` | Admin | Resumen de reportes global |
| GET | `/admin/reports/timeseries` | Admin | Serie temporal global |
| GET | `/admin/payments` | Admin | Lista pagos global |
| GET | `/admin/payments/export.csv` | Admin | Exporta pagos globales |
| GET | `/admin/payments/:id` | Admin | Detalle de pago |
| GET | `/admin/payments/:id/pdf` | Admin | PDF de comprobante |
| POST | `/admin/payments/:id/reprocess` | Admin | Reprocesa un pago |
| GET | `/admin/tenants` | Admin | Lista tenants |
| POST | `/admin/tenants` | Admin | Crea tenant |
| GET | `/admin/tenants/:slug` | Admin | Detalle de tenant |
| PATCH | `/admin/tenants/:slug` | Admin | Actualiza tenant |
| DELETE | `/admin/tenants/:slug` | Admin | Elimina tenant y datos asociados |
| GET | `/admin/tenants/:slug/dashboard` | Admin | Dashboard de tenant |
| GET | `/admin/tenants/:slug/payments` | Admin | Pagos de tenant |
| GET | `/admin/tenants/:slug/payments/export.csv` | Admin | Exporta pagos de tenant |
| GET | `/admin/tenants/:slug/notes` | Admin | Lista notas internas |
| POST | `/admin/tenants/:slug/notes` | Admin | Crea nota interna |
| GET | `/admin/tenants/:slug/integrations` | Admin | Lista integraciones |
| POST | `/admin/tenants/:slug/integrations/mercadopago/start` | Admin | Importa y procesa pagos MP desde fecha |
| PUT | `/admin/tenants/:slug/integrations/:provider` | Admin | Reemplaza configuracion de integracion |
| POST | `/admin/tenants/:slug/integrations/:provider/test` | Admin | Prueba conexion con la configuracion guardada |
| GET | `/admin/tenants/:slug/onboarding` | Admin | Lista envios de onboarding |
| GET | `/admin/tenants/:slug/onboarding/:submissionId` | Admin | Detalle de onboarding |
| POST | `/admin/tenants/:slug/onboarding/:submissionId/approve` | Admin | Aprueba onboarding y puede iniciar procesamiento |
| POST | `/admin/tenants/:slug/onboarding/:submissionId/reject` | Admin | Rechaza onboarding |
| GET | `/admin/tenants/:slug/users` | Admin | Lista usuarios del tenant |
| PUT | `/admin/tenants/:slug/users` | Admin | Crea o actualiza usuario del tenant |
| POST | `/portal/auth/login` | No | Login portal tenant |
| POST | `/portal/auth/logout` | No | Logout portal del lado cliente |
| GET | `/portal/me` | Tenant | Usuario tenant autenticado |
| GET | `/portal/dashboard` | Tenant | Dashboard del tenant |
| GET | `/portal/payments` | Tenant | Lista pagos del tenant |
| GET | `/portal/payments/export.csv` | Tenant | Exporta pagos del tenant |
| GET | `/portal/payments/:id` | Tenant | Detalle de pago del tenant |
| GET | `/portal/payments/:id/pdf` | Tenant | PDF de comprobante del tenant |
| GET | `/portal/reports/summary` | Tenant | Resumen de reportes del tenant |
| GET | `/portal/reports/timeseries` | Tenant | Serie temporal del tenant |
| GET | `/portal/integrations` | Tenant | Integraciones del tenant |
| POST | `/portal/integrations/:provider/test` | Tenant | Prueba conexion con la configuracion guardada |
| GET | `/portal/onboarding` | Tenant | Lista envios de onboarding del tenant |
| POST | `/portal/onboarding` | Tenant | Envia datos/documentacion para alta |

## Health

### `GET /health`

Healthcheck basico de la API.

Response `200`:

```json
{
  "ok": true
}
```

## Google OAuth

### `GET /google/oauth/start`

Inicia el flujo OAuth de Google para conectar Drive/Sheets de un tenant.

Query params:

- `tenant` requerido. Slug del tenant.
- `driveFolderId` opcional. Carpeta de Drive a configurar.
- `sheetsId` opcional. Spreadsheet a configurar.
- `sheetName` opcional. Hoja/tab a configurar.

Response:

- `302 Found` redirige a la URL de autorizacion de Google.
- `400` si falta `tenant`.

Error:

```json
{
  "error": "Falta tenant"
}
```

### `GET /google/oauth/callback`

Callback del flujo OAuth de Google.

Query params:

- `code` requerido. Codigo OAuth entregado por Google.
- `state` requerido. Estado firmado/generado por la API en el inicio del flujo.

Response `200`:

```json
{
  "ok": true,
  "message": "Google conectado al tenant"
}
```

La respuesta puede incluir campos adicionales devueltos por el servicio de conexion.

## Endpoints de prueba de pagos

Este endpoint esta montado bajo `/api` y sirve para simular/crear pagos contra Mercado Pago.

### `POST /api/crear-pago-mp`

Crea un pago de prueba en Mercado Pago usando la configuracion global.

Response `200`:

```json
{
  "id": "123456789",
  "provider": "mercadopago",
  "raw": {}
}
```

Errores:

- `500` si no se pudo simular el pago.

## Admin API

Base path:

```http
/admin
```

### `POST /admin/auth/login`

Autentica un usuario administrador.

Body:

```json
{
  "email": "admin@empresa.com",
  "password": "password-segura"
}
```

Validaciones:

- `email` requerido.
- `password` requerido.

Response `200`:

```json
{
  "token": "<admin-token>",
  "adminUser": {
    "id": "1",
    "email": "admin@empresa.com",
    "role": "SUPERADMIN",
    "status": "ACTIVE",
    "lastLoginAt": "2026-04-18T12:00:00.000Z",
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T12:00:00.000Z"
  }
}
```

Errores:

- `400` si faltan campos.
- `401` si las credenciales son invalidas.

### `POST /admin/auth/logout`

Logout logico. Actualmente no invalida token en servidor.

Response:

- `204 No Content`.

### `GET /admin/me`

Devuelve el admin autenticado.

Auth:

- Admin bearer token.

Response `200`:

```json
{
  "id": "1",
  "email": "admin@empresa.com",
  "role": "SUPERADMIN",
  "status": "ACTIVE",
  "lastLoginAt": "2026-04-18T12:00:00.000Z",
  "createdAt": "2026-04-18T10:00:00.000Z",
  "updatedAt": "2026-04-18T12:00:00.000Z"
}
```

### `GET /admin/dashboard`

Dashboard global. Puede filtrarse por tenant y fechas.

Auth:

- Admin bearer token.

Query params:

- `dateFrom` opcional, fecha `YYYY-MM-DD` o parseable por `Date`.
- `dateTo` opcional, fecha `YYYY-MM-DD` o parseable por `Date`.
- `tenantSlug` opcional.
- `granularity` opcional, solo se propaga en algunos usos internos.

Response `200`:

```json
{
  "cards": [
    {
      "id": "payments_total",
      "label": "Pagos",
      "value": 120,
      "tone": "neutral"
    }
  ],
  "summary": {
    "tenants": {
      "total": 4,
      "active": 4,
      "withErrors": 1
    },
    "payments": {
      "total": 120,
      "pending": 3,
      "failed": 1,
      "complete": 116,
      "totalAmount": 456000,
      "statuses": {}
    },
    "filters": {
      "tenantId": null,
      "tenantSlug": null,
      "dateFrom": null,
      "dateTo": null
    },
    "recentPayments": []
  }
}
```

### `GET /admin/reports/summary`

Resumen agregado de reportes globales.

Auth:

- Admin bearer token.

Query params:

- `dateFrom` opcional.
- `dateTo` opcional.
- `tenantSlug` opcional.

Response `200`:

```json
{
  "filters": {
    "tenantId": "1",
    "tenantSlug": "demo",
    "dateFrom": "2026-04-01",
    "dateTo": "2026-04-18"
  },
  "totals": {
    "paymentsCount": 120,
    "totalAmount": 456000,
    "avgTicket": 3800
  },
  "byStatus": {
    "complete": {
      "count": 116,
      "amount": 450000
    }
  },
  "topTenants": []
}
```

### `GET /admin/reports/timeseries`

Serie temporal global de pagos.

Auth:

- Admin bearer token.

Query params:

- `dateFrom` opcional.
- `dateTo` opcional.
- `tenantSlug` opcional.
- `granularity` opcional: `day`, `week`, `month`. Default: `day`.

Response `200`:

```json
{
  "filters": {
    "tenantId": "1",
    "tenantSlug": "demo",
    "dateFrom": "2026-04-01",
    "dateTo": "2026-04-18",
    "granularity": "day"
  },
  "series": [
    {
      "bucketStart": "2026-04-01T00:00:00.000Z",
      "paymentsCount": 12,
      "totalAmount": 35000
    }
  ]
}
```

### `GET /admin/payments`

Lista paginada global de pagos.

Auth:

- Admin bearer token.

Query params:

- `page` opcional. Default: `1`.
- `pageSize` opcional. Default: `20`, maximo: `100`.
- `status` opcional.
- `provider` opcional.
- `search` opcional. Busca en `provider_payment_id`, `cbte_nro`, `customer` y `customer_doc_number`.
- `dateFrom` opcional.
- `dateTo` opcional.

Response `200`:

```json
{
  "items": [
    {
      "id": "100",
      "tenantId": "1",
      "provider": "MERCADOPAGO",
      "provider_payment_id": "123456",
      "status": "complete",
      "payment_method_id": "visa",
      "amount": 2500,
      "currency": "ARS",
      "customer": "cliente@correo.com",
      "customer_doc_type": "DNI",
      "customer_doc_number": "12345678",
      "date_approved": "2026-04-18T11:00:00.000Z",
      "cae": "123",
      "cae_vto": "20260501",
      "cbte_nro": "00001-00000012",
      "cbte_tipo": 6,
      "pto_vta": 1,
      "pdf_path": "facturas/demo.pdf",
      "drive_file_link": "https://drive.google.com/...",
      "sheets_row": "42",
      "error": null,
      "createdAt": "2026-04-18T11:00:00.000Z",
      "updatedAt": "2026-04-18T11:01:00.000Z",
      "tenant": {
        "id": "1",
        "slug": "demo",
        "name": "Cliente Demo"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  },
  "filters": {
    "tenantId": null,
    "status": null,
    "provider": null,
    "search": null,
    "dateFrom": null,
    "dateTo": null
  }
}
```

### `GET /admin/payments/export.csv`

Exporta pagos globales filtrados a CSV.

Auth:

- Admin bearer token.

Query params:

- `status` opcional.
- `provider` opcional.
- `search` opcional.
- `dateFrom` opcional.
- `dateTo` opcional.

Response `200`:

- Body: CSV.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition: attachment; filename="payments-admin.csv"`.
- Header `X-Export-Max-Rows`: maximo de filas exportadas.
- Header `X-Export-Truncated`: `true` si el resultado fue truncado.

### `GET /admin/payments/:id`

Detalle de un pago global.

Auth:

- Admin bearer token.

Path params:

- `id` requerido. ID numerico del pago.

Response `200`:

```json
{
  "id": "100",
  "tenantId": "1",
  "provider": "MERCADOPAGO",
  "provider_payment_id": "123456",
  "status": "complete",
  "amount": 2500,
  "tenant": {
    "id": "1",
    "slug": "demo",
    "name": "Cliente Demo",
    "status": "ACTIVE",
    "subscriptions": []
  },
  "events": [
    {
      "id": "500",
      "tenantId": "1",
      "paymentId": "100",
      "type": "afip_ok",
      "message": "Factura autorizada por AFIP",
      "payloadJson": "{\"cae\":\"...\"}",
      "createdAt": "2026-04-18T11:01:00.000Z"
    }
  ]
}
```

Errores:

- `400` si `id` no es valido.
- `404` si el pago no existe.

### `GET /admin/payments/:id/pdf`

Genera o reutiliza el PDF del comprobante y lo devuelve.

Auth:

- Admin bearer token.

Path params:

- `id` requerido.

Query params:

- `download` opcional. Si es `true`, fuerza descarga.

Response `200`:

- Body: PDF.
- Inline por defecto con `Content-Type: application/pdf`.
- Descarga si `download=true`.

### `POST /admin/payments/:id/reprocess`

Solicita reproceso manual de un pago.

Auth:

- Admin bearer token.

Path params:

- `id` requerido.

Body:

```json
{
  "step": "auto"
}
```

Valores de `step`:

- `auto`: si el pago esta en `afip_pending`, encola `afip`; en otro caso encola `post`.
- `afip`: encola reproceso AFIP en `paymentsQueue`.
- `post`: encola postproceso en `invoicesQueue`.

Response `202`:

```json
{
  "ok": true,
  "paymentId": "100",
  "tenantId": "1",
  "step": "post"
}
```

### `GET /admin/tenants`

Lista tenants.

Auth:

- Admin bearer token.

Response `200`:

```json
{
  "items": [
    {
      "id": "1",
      "name": "Cliente Demo",
      "slug": "demo",
      "status": "ACTIVE",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-18T11:00:00.000Z",
      "usersCount": 2,
      "currentSubscription": {
        "id": "1",
        "status": "ACTIVE",
        "planCode": "A",
        "planName": "Realtime MP a AFIP",
        "billingProvider": null,
        "billingRef": null,
        "updatedAt": "2026-04-18T11:00:00.000Z"
      },
      "integrations": {
        "overallHealth": "healthy",
        "enabledCount": 4,
        "configuredCount": 4,
        "needsAttentionCount": 0,
        "items": []
      }
    }
  ],
  "total": 1
}
```

### `POST /admin/tenants`

Crea un tenant. Tambien puede crear el usuario owner, guardar integraciones y arrancar el procesamiento inicial de Mercado Pago desde una fecha.

Auth:

- Admin bearer token.

Body:

```json
{
  "name": "Cliente Nuevo",
  "slug": "cliente-nuevo",
  "status": "ACTIVE"
}
```

Body completo opcional para alta desde admin:

```json
{
  "name": "Cliente Nuevo",
  "slug": "cliente-nuevo",
  "status": "ACTIVE",
  "ownerUser": {
    "email": "owner@cliente.com",
    "password": "password-segura"
  },
  "processingStartDate": "2026-05-01",
  "integrations": {
    "MERCADOPAGO": {
      "ACCESS_TOKEN": "APP_USR-...",
      "POS_ID": "123456"
    },
    "AFIP": {
      "CUIT": "30719022525",
      "PTO_VTA": 1,
      "CBTE_TIPO": 6
    },
    "DRIVE": {
      "REFRESH_TOKEN": "...",
      "FOLDER_ID": "..."
    },
    "SHEETS": {
      "REFRESH_TOKEN": "...",
      "SPREADSHEET_ID": "...",
      "SHEET_NAME": "facturas"
    }
  }
}
```

Validaciones:

- `name` requerido.
- `slug` requerido. Se normaliza a minusculas, numeros y guiones.
- `status` opcional: `ACTIVE` o `DISABLED`.
- `ownerUser` opcional. Si se informa, `email` es requerido y `password` debe tener al menos 8 caracteres si no esta vacia.
- `integrations` opcional. Valida los campos requeridos por provider igual que `PUT /admin/tenants/:slug/integrations/:provider`.
- `processingStartDate` opcional. Si se informa junto con `integrations.MERCADOPAGO`, importa pagos aprobados desde esa fecha y los encola para facturacion.

Response `201`:

```json
{
  "tenant": {
    "id": "2",
    "name": "Cliente Nuevo",
    "slug": "cliente-nuevo",
    "status": "ACTIVE",
    "createdAt": "2026-05-13T10:00:00.000Z",
    "updatedAt": "2026-05-13T10:00:00.000Z"
  },
  "ownerUser": {
    "id": "10",
    "tenantId": "2",
    "email": "owner@cliente.com",
    "role": "owner",
    "status": "ACTIVE"
  },
  "integrations": [
    {
      "id": "20",
      "provider": "MERCADOPAGO",
      "enabled": true,
      "config": {
        "ACCESS_TOKEN": "********...",
        "POS_ID": "123456"
      }
    }
  ],
  "mercadopagoStart": {
    "processingStartDate": "2026-05-01T03:00:00.000Z",
    "imported": 12,
    "created": 12,
    "skipped": 0,
    "enqueued": 12,
    "checkpoint": {
      "timestamp": "2026-05-13T12:00:00.000-04:00",
      "lastPaymentId": "123456789"
    }
  }
}
```

### `GET /admin/tenants/:slug`

Detalle operativo de un tenant.

Auth:

- Admin bearer token.

Path params:

- `slug` requerido.

Response `200`:

```json
{
  "identity": {
    "id": "1",
    "name": "Cliente Demo",
    "slug": "demo",
    "status": "ACTIVE",
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-18T11:00:00.000Z"
  },
  "currentSubscription": {
    "id": "1",
    "status": "ACTIVE",
    "planCode": "A",
    "planName": "Realtime MP a AFIP",
    "billingProvider": null,
    "billingRef": null,
    "updatedAt": "2026-04-18T11:00:00.000Z"
  },
  "users": {
    "total": 2,
    "items": []
  },
  "integrations": {
    "overallHealth": "healthy",
    "enabledCount": 4,
    "configuredCount": 4,
    "needsAttentionCount": 0,
    "items": []
  },
  "metrics": {
    "totalPayments": 120,
    "latestFailedPayment": null,
    "recentPayments": [],
    "totalAmount": 456000,
    "statuses": {}
  },
  "notes": {
    "total": 1,
    "items": []
  },
  "raw": {
    "subscriptions": []
  }
}
```

Errores:

- `404` si el tenant no existe.

### `PATCH /admin/tenants/:slug`

Actualiza campos basicos de un tenant.

Auth:

- Admin bearer token.

Body parcial:

```json
{
  "name": "Cliente Renombrado",
  "slug": "cliente-renombrado",
  "status": "DISABLED"
}
```

Response `200`:

```json
{
  "id": "1",
  "name": "Cliente Renombrado",
  "slug": "cliente-renombrado",
  "status": "DISABLED",
  "createdAt": "2026-04-01T10:00:00.000Z",
  "updatedAt": "2026-04-18T11:00:00.000Z"
}
```

### `DELETE /admin/tenants/:slug`

Elimina un tenant y toda su informacion local asociada. Pensado para resetear pruebas de alta.

Auth:

- Admin bearer token.

Path params:

- `slug` requerido.

Query params:

- `deleteLocalFiles` opcional. Default: `true`. Si es `false`, no intenta borrar PDFs locales.

Comportamiento:

- Borra pagos, eventos, usuarios, integraciones, checkpoints, suscripciones, notas, auditoria, secuencias y envios de onboarding del tenant.
- Borra PDFs locales referenciados por `pdf_path` solo si estan dentro de la carpeta local `facturas/`.
- No borra archivos externos en Drive ni filas en Sheets.

Response `200`:

```json
{
  "ok": true,
  "tenant": {
    "id": "2",
    "slug": "cliente-nuevo",
    "name": "Cliente Nuevo",
    "status": "ACTIVE"
  },
  "deleted": {
    "paymentEvents": 12,
    "payments": 12,
    "invoiceSequences": 1,
    "integrationCheckpoints": 1,
    "tenantIntegrations": 4,
    "tenantUsers": 1,
    "subscriptions": 0,
    "tenantNotes": 0,
    "onboardingSubmissions": 1,
    "auditLogs": 3,
    "tenants": 1
  },
  "files": {
    "requested": 12,
    "deleted": 12,
    "missing": 0,
    "failed": []
  }
}
```

Errores:

- `404` si el tenant no existe.

### `GET /admin/tenants/:slug/dashboard`

Dashboard y reportes de un tenant visto desde admin.

Auth:

- Admin bearer token.

Query params:

- `dateFrom` opcional.
- `dateTo` opcional.
- `granularity` opcional: `day`, `week`, `month`.

Response `200`:

```json
{
  "tenant": {
    "id": "1",
    "name": "Cliente Demo",
    "slug": "demo",
    "status": "ACTIVE"
  },
  "cards": [],
  "summary": {},
  "reports": {
    "summary": {},
    "timeseries": {}
  }
}
```

### `GET /admin/tenants/:slug/payments`

Lista pagos de un tenant.

Auth:

- Admin bearer token.

Query params:

- Mismos filtros que `GET /admin/payments`.

Response:

- Mismo contrato que `GET /admin/payments`, con `filters.tenantId` seteado.

### `GET /admin/tenants/:slug/payments/export.csv`

Exporta pagos filtrados de un tenant a CSV.

Auth:

- Admin bearer token.

Query params:

- Mismos filtros que `GET /admin/payments/export.csv`.

Response `200`:

- Body: CSV.
- `Content-Disposition: attachment; filename="payments-<slug>.csv"`.
- Header `X-Export-Max-Rows`.
- Header `X-Export-Truncated`.

### `GET /admin/tenants/:slug/notes`

Lista notas internas de un tenant.

Auth:

- Admin bearer token.

Response `200`:

```json
[
  {
    "id": "1",
    "tenantId": "1",
    "createdByAdminUserId": "1",
    "title": "Seguimiento",
    "body": "Cliente reporta diferencia en una factura.",
    "pinned": true,
    "createdAt": "2026-04-18T11:00:00.000Z",
    "updatedAt": "2026-04-18T11:00:00.000Z",
    "createdByAdmin": {
      "id": "1",
      "email": "admin@empresa.com",
      "role": "SUPERADMIN"
    }
  }
]
```

### `POST /admin/tenants/:slug/notes`

Crea una nota interna de tenant.

Auth:

- Admin bearer token.

Body:

```json
{
  "title": "Seguimiento",
  "body": "Cliente reporta diferencia en una factura.",
  "pinned": true
}
```

Validaciones:

- `title` requerido.
- `body` requerido.
- `pinned` opcional, default `false`.

Response `201`:

```json
{
  "id": "1",
  "tenantId": "1",
  "createdByAdminUserId": "1",
  "title": "Seguimiento",
  "body": "Cliente reporta diferencia en una factura.",
  "pinned": true,
  "createdAt": "2026-04-18T11:00:00.000Z",
  "updatedAt": "2026-04-18T11:00:00.000Z",
  "createdByAdmin": {
    "id": "1",
    "email": "admin@empresa.com",
    "role": "SUPERADMIN"
  }
}
```

### `GET /admin/tenants/:slug/integrations`

Lista integraciones configuradas de un tenant.

Auth:

- Admin bearer token.

Query params:

- `revealSecrets` opcional. Si es `true`, devuelve secretos desencriptados. Por defecto los enmascara.

Response `200`:

```json
[
  {
    "id": "10",
    "tenantId": "1",
    "provider": "AFIP",
    "enabled": true,
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:00:00.000Z",
    "config": {
      "CUIT": "********2525",
      "PTO_VTA": 1,
      "CBTE_TIPO": 6
    }
  }
]
```

### `POST /admin/tenants/:slug/integrations/mercadopago/start`

Importa pagos aprobados de Mercado Pago desde una fecha y los encola para facturacion AFIP.

Auth:

- Admin bearer token.

Path params:

- `slug` requerido.

Body:

```json
{
  "processingStartDate": "2026-05-01"
}
```

Notas:

- Tambien acepta `startDate` como alias.
- Usa la integracion `MERCADOPAGO` ya guardada para el tenant.
- `processingStartDate` puede ser `YYYY-MM-DD` o ISO datetime.
- Si se envia `YYYY-MM-DD`, se interpreta como inicio del dia en zona `America/Argentina/Buenos_Aires`.
- Crea pagos idempotentemente: si el `provider_payment_id` ya existe para el tenant, lo saltea.
- Actualiza el checkpoint MP para que el worker normal continue desde el ultimo pago importado.

Response `202`:

```json
{
  "ok": true,
  "tenantId": "2",
  "processingStartDate": "2026-05-01T03:00:00.000Z",
  "imported": 12,
  "created": 10,
  "skipped": 2,
  "enqueued": 10,
  "checkpoint": {
    "timestamp": "2026-05-13T12:00:00.000-04:00",
    "lastPaymentId": "123456789"
  }
}
```

### `PUT /admin/tenants/:slug/integrations/:provider`

Reemplaza por completo la configuracion de una integracion.

Auth:

- Admin bearer token.

Path params:

- `slug` requerido.
- `provider` requerido: `MERCADOPAGO`, `AFIP`, `DRIVE` o `SHEETS`.

Body:

```json
{
  "enabled": true,
  "config": {
    "CUIT": "30719022525",
    "PTO_VTA": 1,
    "CBTE_TIPO": 6
  }
}
```

Campos requeridos por provider:

- `MERCADOPAGO`: `ACCESS_TOKEN`, `POS_ID`.
- `AFIP`: `CUIT`, `PTO_VTA`, `CBTE_TIPO`.
- `DRIVE`: `REFRESH_TOKEN`.
- `SHEETS`: `REFRESH_TOKEN`.

Response `200`:

```json
{
  "id": "10",
  "tenantId": "1",
  "provider": "AFIP",
  "enabled": true,
  "config": {
    "CUIT": "********2525",
    "PTO_VTA": 1,
    "CBTE_TIPO": 6
  }
}
```

### `POST /admin/tenants/:slug/integrations/:provider/test`

Prueba la conexion de una integracion usando la configuracion guardada del tenant y sin generar comprobantes/pagos.

Auth:

- Admin bearer token.

Path params:

- `slug` requerido.
- `provider` requerido. Actualmente soporta test para `MERCADOPAGO` y `AFIP`.

Notas:

- Ignora cualquier `config` enviado en el body. Para probar cambios, primero hay que guardarlos con `PUT /admin/tenants/:slug/integrations/:provider`.
- Para `MERCADOPAGO`, prueba el `ACCESS_TOKEN` buscando pagos aprobados. Si hay `POS_ID`, busca el ultimo pago aprobado de ese POS; si no encuentra, devuelve el ultimo pago aprobado general y una advertencia.
- En tests de `MERCADOPAGO`, solo filtra por `POS_ID` si `POS_ID` esta guardado en la configuracion; si no esta, trae el ultimo pago aprobado general.
- Para `AFIP`, obtiene TA y consulta `FECompUltimoAutorizado` para `CUIT`, `PTO_VTA` y `CBTE_TIPO`. No emite factura.

Response MP `200`:

```json
{
  "tenantId": "2",
  "ok": true,
  "provider": "MERCADOPAGO",
  "connected": true,
  "requestedPosId": "123456",
  "posMatched": false,
  "latestPayment": null,
  "latestAnyPayment": {
    "id": "123456789",
    "status": "approved",
    "date_approved": "2026-05-13T12:00:00.000-04:00",
    "pos_id": "999999",
    "operation_type": "regular_payment",
    "transaction_amount": 1000,
    "currency_id": "ARS",
    "payment_method_id": "visa",
    "payer_email": "cliente@correo.com"
  },
  "warnings": [
    "El access token es valido, pero no se encontraron pagos aprobados para el POS_ID indicado."
  ]
}
```

Response AFIP `200`:

```json
{
  "tenantId": "2",
  "ok": true,
  "provider": "AFIP",
  "connected": true,
  "cuit": "30719022525",
  "ptoVta": 1,
  "cbteTipo": 6,
  "lastCbteNro": 123,
  "nextCbteNro": 124,
  "warnings": []
}
```

Error `400`:

```json
{
  "ok": false,
  "provider": "AFIP",
  "error": "AFIP.CUIT es obligatorio"
}
```

### `GET /admin/tenants/:slug/onboarding`

Lista envios de onboarding de un tenant.

Auth:

- Admin bearer token.

Query params:

- `status` opcional: `pending`, `approved`, `rejected`.
- `revealSecrets` opcional. Si es `true`, devuelve secretos desencriptados. Por defecto los enmascara.

Response `200`:

```json
{
  "items": [
    {
      "id": "1",
      "tenantId": "2",
      "status": "pending",
      "submittedByUserId": "10",
      "reviewedByAdminUserId": null,
      "reviewNotes": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z",
      "reviewedAt": null,
      "data": {
        "business": {
          "legalName": "Cliente SRL",
          "cuit": "30719022525"
        },
        "processingStartDate": "2026-05-01",
        "integrations": {
          "MERCADOPAGO": {
            "ACCESS_TOKEN": "********...",
            "POS_ID": "123456"
          }
        }
      },
      "documents": [
        {
          "type": "constancia_afip",
          "name": "constancia.pdf",
          "url": "https://..."
        }
      ]
    }
  ],
  "total": 1
}
```

### `GET /admin/tenants/:slug/onboarding/:submissionId`

Detalle de un envio de onboarding.

Auth:

- Admin bearer token.

Query params:

- `revealSecrets` opcional. Si es `true`, devuelve secretos desencriptados.

Response:

- Mismo item que `GET /admin/tenants/:slug/onboarding`.

### `POST /admin/tenants/:slug/onboarding/:submissionId/approve`

Aprueba un envio de onboarding, guarda las integraciones enviadas y opcionalmente inicia procesamiento MP desde fecha.

Auth:

- Admin bearer token.

Body:

```json
{
  "reviewNotes": "Documentacion OK",
  "processingStartDate": "2026-05-01",
  "enableProcessing": true
}
```

Campos:

- `reviewNotes` opcional.
- `processingStartDate` opcional si ya vino en el envio del cliente; requerido si se aprueba MP con `enableProcessing=true`.
- `enableProcessing` opcional. Default: `true`. Si es `false`, guarda integraciones pero no importa pagos MP.

Response `202`:

```json
{
  "ok": true,
  "tenantId": "2",
  "submission": {
    "id": "1",
    "tenantId": "2",
    "status": "approved",
    "reviewNotes": "Documentacion OK",
    "reviewedAt": "2026-05-13T12:00:00.000Z"
  },
  "mercadopagoStart": {
    "processingStartDate": "2026-05-01T03:00:00.000Z",
    "imported": 12,
    "created": 12,
    "skipped": 0,
    "enqueued": 12,
    "checkpoint": {
      "timestamp": "2026-05-13T12:00:00.000-04:00",
      "lastPaymentId": "123456789"
    }
  }
}
```

### `POST /admin/tenants/:slug/onboarding/:submissionId/reject`

Rechaza un envio de onboarding.

Auth:

- Admin bearer token.

Body:

```json
{
  "reviewNotes": "Falta refresh token de Google"
}
```

Response `200`:

```json
{
  "ok": true,
  "tenantId": "2",
  "submission": {
    "id": "1",
    "tenantId": "2",
    "status": "rejected",
    "reviewNotes": "Falta refresh token de Google",
    "reviewedAt": "2026-05-13T12:00:00.000Z"
  }
}
```

### `GET /admin/tenants/:slug/users`

Lista usuarios del tenant.

Auth:

- Admin bearer token.

Response `200`:

```json
[
  {
    "id": "1",
    "tenantId": "1",
    "email": "owner@cliente.com",
    "role": "owner",
    "passwordHash": "$2...",
    "status": "ACTIVE",
    "lastLoginAt": "2026-04-18T12:00:00.000Z",
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T12:00:00.000Z"
  }
]
```

Nota: este endpoint devuelve actualmente el registro completo de `TenantUser`, incluido `passwordHash`.

### `PUT /admin/tenants/:slug/users`

Crea o actualiza un usuario del tenant.

Auth:

- Admin bearer token.

Body:

```json
{
  "email": "owner@cliente.com",
  "role": "owner",
  "status": "ACTIVE",
  "password": "password-segura"
}
```

Validaciones:

- `email` requerido.
- `role` requerido: `owner`, `admin`, `viewer`, `approver`.
- `status` opcional: `ACTIVE`, `DISABLED`.
- `password` opcional en updates; si se informa y no esta vacia, debe tener al menos 8 caracteres.

Response `200`:

```json
{
  "id": "1",
  "tenantId": "1",
  "email": "owner@cliente.com",
  "role": "owner",
  "passwordHash": "$2...",
  "status": "ACTIVE",
  "lastLoginAt": null,
  "createdAt": "2026-04-18T10:00:00.000Z",
  "updatedAt": "2026-04-18T12:00:00.000Z"
}
```

## Portal API

Base path:

```http
/portal
```

Todos los endpoints protegidos quedan restringidos al `tenantId` del token.

### `POST /portal/auth/login`

Autentica un usuario del portal cliente.

Body:

```json
{
  "tenantSlug": "demo",
  "email": "owner@cliente.com",
  "password": "password-segura"
}
```

Validaciones:

- `tenantSlug` requerido.
- `email` requerido.
- `password` requerido.

Response `200`:

```json
{
  "token": "<portal-token>",
  "tenantUser": {
    "id": "1",
    "tenantId": "1",
    "email": "owner@cliente.com",
    "role": "owner",
    "status": "ACTIVE",
    "lastLoginAt": "2026-04-18T12:00:00.000Z",
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T12:00:00.000Z",
    "tenant": {
      "id": "1",
      "slug": "demo",
      "name": "Cliente Demo",
      "status": "ACTIVE"
    }
  }
}
```

Errores:

- `400` si faltan campos.
- `401` si credenciales son invalidas, usuario inactivo o tenant inactivo.

### `POST /portal/auth/logout`

Logout logico. Actualmente no invalida token en servidor.

Response:

- `204 No Content`.

### `GET /portal/me`

Devuelve el usuario autenticado del portal.

Auth:

- Tenant bearer token.

Response `200`:

```json
{
  "id": "1",
  "tenantId": "1",
  "email": "owner@cliente.com",
  "role": "owner",
  "status": "ACTIVE",
  "lastLoginAt": "2026-04-18T12:00:00.000Z",
  "createdAt": "2026-04-18T10:00:00.000Z",
  "updatedAt": "2026-04-18T12:00:00.000Z",
  "tenant": {
    "id": "1",
    "slug": "demo",
    "name": "Cliente Demo",
    "status": "ACTIVE"
  }
}
```

### `GET /portal/dashboard`

Dashboard del tenant autenticado.

Auth:

- Tenant bearer token.

Response `200`:

```json
{
  "tenants": {
    "total": 1,
    "active": 1,
    "withErrors": 0
  },
  "payments": {
    "total": 120,
    "pending": 3,
    "failed": 1,
    "complete": 116,
    "totalAmount": 456000,
    "statuses": {}
  },
  "filters": {
    "tenantId": "1",
    "tenantSlug": null,
    "dateFrom": null,
    "dateTo": null
  },
  "recentPayments": []
}
```

### `GET /portal/payments`

Lista paginada de pagos del tenant autenticado.

Auth:

- Tenant bearer token.

Query params:

- `page` opcional. Default: `1`.
- `pageSize` opcional. Default: `20`, maximo: `100`.
- `status` opcional.
- `provider` opcional.
- `search` opcional.
- `dateFrom` opcional.
- `dateTo` opcional.

Response:

- Mismo contrato que `GET /admin/payments`, restringido al tenant autenticado.

### `GET /portal/payments/export.csv`

Exporta pagos del tenant autenticado a CSV.

Auth:

- Tenant bearer token.

Query params:

- `status` opcional.
- `provider` opcional.
- `search` opcional.
- `dateFrom` opcional.
- `dateTo` opcional.

Response `200`:

- Body: CSV.
- `Content-Type: text/csv; charset=utf-8`.
- `Content-Disposition: attachment; filename="payments-<tenantSlug>.csv"`.
- Header `X-Export-Max-Rows`.
- Header `X-Export-Truncated`.

### `GET /portal/payments/:id`

Detalle de un pago del tenant autenticado.

Auth:

- Tenant bearer token.

Path params:

- `id` requerido.

Response:

- Mismo contrato que `GET /admin/payments/:id`, pero solo si el pago pertenece al tenant autenticado.

Errores:

- `404` si el pago no existe o no pertenece al tenant.

### `GET /portal/payments/:id/pdf`

Genera o reutiliza el PDF del comprobante y lo devuelve.

Auth:

- Tenant bearer token.

Path params:

- `id` requerido.

Query params:

- `download` opcional. Si es `true`, fuerza descarga.

Response `200`:

- Body: PDF.
- Inline por defecto.
- Descarga si `download=true`.

### `GET /portal/reports/summary`

Resumen de reportes del tenant autenticado.

Auth:

- Tenant bearer token.

Query params:

- `dateFrom` opcional.
- `dateTo` opcional.

Response `200`:

```json
{
  "filters": {
    "tenantId": "1",
    "tenantSlug": null,
    "dateFrom": "2026-04-01",
    "dateTo": "2026-04-18"
  },
  "totals": {
    "paymentsCount": 120,
    "totalAmount": 456000,
    "avgTicket": 3800
  },
  "byStatus": {},
  "topTenants": [
    {
      "id": "1",
      "slug": "demo",
      "name": "Cliente Demo",
      "paymentsCount": 120,
      "totalAmount": 456000
    }
  ]
}
```

### `GET /portal/reports/timeseries`

Serie temporal del tenant autenticado.

Auth:

- Tenant bearer token.

Query params:

- `dateFrom` opcional.
- `dateTo` opcional.
- `granularity` opcional: `day`, `week`, `month`. Default: `day`.

Response `200`:

```json
{
  "filters": {
    "tenantId": "1",
    "tenantSlug": null,
    "dateFrom": "2026-04-01",
    "dateTo": "2026-04-18",
    "granularity": "day"
  },
  "series": [
    {
      "bucketStart": "2026-04-01T00:00:00.000Z",
      "paymentsCount": 12,
      "totalAmount": 35000
    }
  ]
}
```

### `GET /portal/integrations`

Lista integraciones del tenant autenticado con secretos enmascarados.

Auth:

- Tenant bearer token.

Response `200`:

```json
[
  {
    "id": "10",
    "tenantId": "1",
    "provider": "AFIP",
    "enabled": true,
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:00:00.000Z",
    "config": {
      "CUIT": "********2525",
      "PTO_VTA": 1,
      "CBTE_TIPO": 6
    }
  }
]
```

### `POST /portal/integrations/:provider/test`

Prueba la conexion de una integracion usando la configuracion guardada del tenant. No lee datos que el cliente este cargando en pantalla y no genera comprobantes/pagos.

Auth:

- Tenant bearer token.

Path params:

- `provider` requerido. Actualmente soporta `MERCADOPAGO` y `AFIP`.

Response:

- Mismo contrato que `POST /admin/tenants/:slug/integrations/:provider/test`.
- En portal siempre se prueba la configuracion guardada; cualquier `config` enviado en el body se ignora.

### `GET /portal/onboarding`

Lista los envios de onboarding del tenant autenticado.

Auth:

- Tenant bearer token.

Query params:

- `status` opcional: `pending`, `approved`, `rejected`.

Response `200`:

```json
{
  "items": [
    {
      "id": "1",
      "tenantId": "2",
      "status": "pending",
      "submittedByUserId": "10",
      "reviewedByAdminUserId": null,
      "reviewNotes": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z",
      "reviewedAt": null,
      "data": {
        "business": {
          "legalName": "Cliente SRL",
          "cuit": "30719022525"
        },
        "processingStartDate": "2026-05-01",
        "integrations": {
          "MERCADOPAGO": {
            "ACCESS_TOKEN": "********...",
            "POS_ID": "123456"
          }
        }
      },
      "documents": [
        {
          "type": "constancia_afip",
          "name": "constancia.pdf",
          "url": "https://..."
        }
      ]
    }
  ],
  "total": 1
}
```

### `POST /portal/onboarding`

Envia datos, credenciales y documentacion para que un admin revise y apruebe el alta.

Auth:

- Tenant bearer token.

Body:

```json
{
  "business": {
    "legalName": "Cliente SRL",
    "cuit": "30719022525",
    "taxCondition": "Responsable Inscripto",
    "address": "Calle 123"
  },
  "processingStartDate": "2026-05-01",
  "integrations": {
    "MERCADOPAGO": {
      "ACCESS_TOKEN": "APP_USR-...",
      "POS_ID": "123456"
    },
    "AFIP": {
      "CUIT": "30719022525",
      "PTO_VTA": 1,
      "CBTE_TIPO": 6
    },
    "DRIVE": {
      "REFRESH_TOKEN": "...",
      "FOLDER_ID": "..."
    },
    "SHEETS": {
      "REFRESH_TOKEN": "...",
      "SPREADSHEET_ID": "...",
      "SHEET_NAME": "facturas"
    }
  },
  "documents": [
    {
      "type": "constancia_afip",
      "name": "constancia.pdf",
      "url": "https://..."
    }
  ]
}
```

Notas:

- `business` es objeto libre para datos fiscales/comerciales.
- `documents` es una lista libre de referencias a documentos ya subidos/externos. Este endpoint no recibe archivos binarios.
- `integrations` acepta `MERCADOPAGO`, `AFIP`, `DRIVE` y `SHEETS`.
- `processingStartDate` puede venir arriba o como `integrations.MERCADOPAGO.PROCESSING_START_DATE`.
- El envio queda en estado `pending`; no se procesan pagos hasta que admin apruebe.

Response `201`:

```json
{
  "id": "1",
  "tenantId": "2",
  "status": "pending",
  "submittedByUserId": "10",
  "reviewedByAdminUserId": null,
  "reviewNotes": null,
  "createdAt": "2026-05-13T10:00:00.000Z",
  "updatedAt": "2026-05-13T10:00:00.000Z",
  "reviewedAt": null,
  "data": {
    "business": {
      "legalName": "Cliente SRL",
      "cuit": "30719022525"
    },
    "processingStartDate": "2026-05-01",
    "integrations": {
      "MERCADOPAGO": {
        "ACCESS_TOKEN": "********...",
        "POS_ID": "123456"
      }
    }
  },
  "documents": []
}
```
## `POST /admin/payments/:id/deliver-google`

Solicita la entrega opcional a Drive y Sheets de un comprobante ya emitido en ARCA.

Auth:

- Admin bearer token con permiso para gestionar pagos.

Comportamiento:

- valida CAE, numero y vencimiento del comprobante;
- exige suscripcion activa, entitlement `googleDriveSheets` e integraciones completas;
- no vuelve a consultar Mercado Pago ni emitir en ARCA;
- omite Drive o Sheets cuando su checkpoint local ya existe;
- si ARCA fallo, permite registrar/actualizar solamente el estado `ERROR` en Sheets;
- responde `202` si encolo trabajo y `200` si la entrega ya estaba completa.
