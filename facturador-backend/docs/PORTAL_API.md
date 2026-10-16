# API Portal Cliente

## Objetivo

Este documento deja el contrato base para el frontend cliente.

Base path:

- `/portal`

Auth:

- login con `tenantSlug`, `email` y `password`
- el backend devuelve un token
- el frontend debe enviarlo como:

```http
Authorization: Bearer <token>
```

Formato general:

- IDs `BigInt` salen serializados como `string`
- fechas salen como ISO string
- errores salen como:

```json
{
  "error": "mensaje"
}
```

## Login

### `POST /portal/auth/login`

Body:

```json
{
  "tenantSlug": "demo",
  "email": "owner@cliente.com",
  "password": "password-segura"
}
```

Response:

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

### `GET /portal/me`

Devuelve el usuario autenticado del tenant.

### `POST /portal/auth/logout`

Hoy invalida del lado cliente solamente.

## Inicio

### `GET /portal/home`

Resumen del Inicio del portal. Todo se calcula solo para el tenant de la sesión; los meses se cortan en hora argentina.

```json
{
  "month": { "key": "2026-10", "previousKey": "2026-09", "currency": "ARS", "net": 190470, "invoiced": 193170, "credited": 2700, "invoiceCount": 18, "averageTicket": 10731.67, "previousNet": 139250, "changePercent": 37 },
  "attention": [{ "code": "invoices_pending_confirmation", "tone": "warning", "count": 3, "detail": null }],
  "profileStatus": "APPROVED",
  "subscription": { "status": "ACTIVE", "planName": "Control" },
  "connection": { "mercadoPagoConnected": true, "invoiceMode": "confirmation", "lastSyncAt": "2026-10-16T13:42:00.000Z", "lastIssuedAt": "2026-10-16T13:40:00.000Z" }
}
```

- `month.net`: facturas emitidas menos notas de crédito emitidas en el mes en curso. `previousNet` es el mes anterior hasta el mismo punto ("a esta altura"); `changePercent` es `null` si no hay base.
- `attention`: de más a menos urgente. Códigos: `subscription_unpaid`, `invoices_failed`, `profile_rejected`, `invoices_pending_confirmation`, `profile_incomplete`, `mercadopago_not_connected`, `profile_in_review`.

### `GET /portal/dashboard` (en desuso)

El portal ya no lo usa (lo reemplaza `/portal/home`); se elimina en la fase de limpieza.

Response:

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
    "statuses": {
      "complete": {
        "count": 116,
        "amount": 450000
      }
    }
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

Uso sugerido en UI:

- cards de facturación
- pendientes/fallidos
- actividad reciente

## Pagos y facturas

### `GET /portal/invoices`

Query: `page`, `pageSize` (máx. 100), `view` = `all` | `pending` | `issued` | `failed` | `voided` (por defecto `all`). Lista solo facturas; las notas de crédito vienen anidadas en `creditNotes`. `issued` excluye las anuladas (con nota de crédito emitida), que están en `voided`.

Response: `{ items, view, counts: { all, pending, issued, failed, voided }, pagination: { page, pageSize, total, totalPages } }`.

### `GET /portal/payments`

Query params opcionales:

- `page`
- `pageSize`
- `status`: un estado o varios separados por coma (`pdf_pending,complete`); un estado desconocido responde 400
- `provider`
- `search`
- `dateFrom=YYYY-MM-DD`, `dateTo=YYYY-MM-DD`: días completos en hora argentina (también en el admin)

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 1
  },
  "filters": {
    "tenantId": "1",
    "status": null,
    "provider": null,
    "search": null,
    "dateFrom": null,
    "dateTo": null
  }
}
```

### `GET /portal/payments/export.csv`

Exporta el listado filtrado de pagos/facturas del tenant autenticado.

Formato pensado para Excel en Argentina: BOM UTF-8, separador `;`, coma decimal, fechas `dd/mm/aaaa hh:mm` en hora argentina y encabezados/estados en castellano. Archivo `ventas-<empresa>.csv`. Los headers `X-Export-Max-Rows` y `X-Export-Truncated` están expuestos por CORS para avisar cuando se recorta.

Query params opcionales:

- `status`
- `provider`
- `search`
- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`

Headers de respuesta:

- `X-Export-Max-Rows`
- `X-Export-Truncated`

### `GET /portal/payments/:id`

Devuelve el detalle de una factura/pago del tenant autenticado.

Incluye:

- datos del pago
- datos del tenant
- timeline de `events`

### `GET /portal/payments/:id/pdf`

Genera o reutiliza el PDF del comprobante y lo devuelve al cliente autenticado.

Query params opcionales:

- `download=true`

Comportamiento:

- si el PDF ya existe en disco, lo reutiliza
- si no existe, lo genera on-demand usando los datos AFIP ya guardados
- si `download=true`, responde como descarga
- si no, responde inline para preview embebida

## Reportes

### `GET /portal/reports/summary`

Query params opcionales:

- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`

Response:

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

Query params opcionales:

- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`
- `granularity=day|week|month`

Response:

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

## Integraciones

### `GET /portal/integrations`

Devuelve integraciones del tenant autenticado con secretos enmascarados.

Uso sugerido en UI:

- vista de estado de configuración
- solo lectura en la primera versión

## Alta y actualización de usuarios cliente desde admin

El portal cliente usa `TenantUser`. Para dejarlo listo desde admin:

### `PUT /admin/tenants/:slug/users`

Body:

```json
{
  "email": "owner@cliente.com",
  "role": "owner",
  "status": "ACTIVE",
  "password": "password-segura"
}
```

Notas:

- `password` es opcional en updates, pero necesaria para que el usuario pueda loguear
- `status` admite `ACTIVE` o `DISABLED`

## Mapeo sugerido de pantallas

### Login

- `POST /portal/auth/login`
- `GET /portal/me`

### Dashboard

- `GET /portal/dashboard`
- `GET /portal/reports/summary`
- `GET /portal/reports/timeseries`

### Historial

- `GET /portal/payments`
- `GET /portal/payments/export.csv`

### Detalle de factura

- `GET /portal/payments/:id`
- `GET /portal/payments/:id/pdf`

### Estado de integraciones

- `GET /portal/integrations`

## Pendientes futuros

- refresh tokens / invalidación real de sesión
- endpoint específico de perfil del tenant
- autogestión de configuraciones por parte del cliente
