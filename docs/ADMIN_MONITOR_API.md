# API Admin Monitor

## Objetivo

Este documento deja el contrato base para el frontend admin del monitor.

Base path:

- `/admin`

Auth:

- login con email + password
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

## Flujo de autenticacion

### `POST /admin/auth/login`

Body:

```json
{
  "email": "admin@empresa.com",
  "password": "password-segura"
}
```

Response:

```json
{
  "token": "<jwt-like-token>",
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

### `GET /admin/me`

Devuelve el admin autenticado.

### `POST /admin/auth/logout`

Hoy invalida del lado cliente solamente.

Response:

- `204 No Content`

## Dashboard global

### `GET /admin/dashboard`

Query params opcionales:

- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`
- `tenantSlug=<slug>`

Response:

```json
{
  "cards": [
    {
      "id": "tenants_total",
      "label": "Tenants",
      "value": 4,
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
      "statuses": {
        "complete": {
          "count": 116,
          "amount": 450000
        }
      }
    },
    "filters": {
      "tenantId": null,
      "tenantSlug": null,
      "dateFrom": "2026-04-01",
      "dateTo": "2026-04-18"
    },
    "recentPayments": []
  }
}
```

Uso sugerido en UI:

- `cards`: KPIs superiores
- `summary.recentPayments`: tabla corta de actividad reciente

## Reportes globales

### `GET /admin/reports/summary`

Query params opcionales:

- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`
- `tenantSlug=<slug>`

Response:

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
    },
    "failed": {
      "count": 1,
      "amount": 0
    }
  },
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

### `GET /admin/reports/timeseries`

Query params opcionales:

- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`
- `tenantSlug=<slug>`
- `granularity=day|week|month`

Response:

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

Uso sugerido en UI:

- gráfico de línea o barras
- selector de granularidad

## Tenants

### `GET /admin/tenants`

Response:

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
        "planName": "Realtime MP → AFIP",
        "billingProvider": null,
        "billingRef": null,
        "updatedAt": "2026-04-01T10:00:00.000Z"
      },
      "integrations": {
        "overallHealth": "attention",
        "enabledCount": 4,
        "configuredCount": 3,
        "needsAttentionCount": 1,
        "items": [
          {
            "id": "10",
            "provider": "AFIP",
            "enabled": true,
            "health": "configured",
            "configured": true,
            "configuredKeys": ["CUIT", "PTO_VTA", "CBTE_TIPO"],
            "updatedAt": "2026-04-18T10:00:00.000Z"
          }
        ]
      }
    }
  ],
  "total": 1
}
```

Uso sugerido en UI:

- tabla de clientes
- badge por `status`
- badge de salud por `integrations.overallHealth`

### `POST /admin/tenants`

Body:

```json
{
  "name": "Cliente Nuevo",
  "slug": "cliente-nuevo",
  "status": "ACTIVE"
}
```

### `PATCH /admin/tenants/:slug`

Body parcial:

```json
{
  "name": "Cliente Renombrado",
  "status": "DISABLED"
}
```

## Detalle de tenant

### `GET /admin/tenants/:slug`

Response:

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
    "planName": "Realtime MP → AFIP",
    "billingProvider": null,
    "billingRef": null,
    "updatedAt": "2026-04-01T10:00:00.000Z"
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

Uso sugerido en UI:

- header del cliente con `identity`
- bloque de plan con `currentSubscription`
- cards de métricas con `metrics`
- bloque de integraciones con `integrations.items`
- bloque de notas con `notes.items`

### `GET /admin/tenants/:slug/dashboard`

Query params opcionales:

- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`
- `granularity=day|week|month`

Response:

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

Uso sugerido en UI:

- pantalla “dashboard del cliente” dentro del portal admin
- reutiliza cards y gráficos del dashboard global

## Pagos y facturas

### `GET /admin/payments`

Query params opcionales:

- `page`
- `pageSize`
- `status`
- `provider`
- `search`
- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`

Response:

```json
{
  "items": [
    {
      "id": "100",
      "tenantId": "1",
      "provider": "MERCADOPAGO",
      "provider_payment_id": "123456",
      "status": "complete",
      "amount": 2500,
      "customer": "Juan Perez",
      "cbte_nro": "00001-00000012",
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

Exporta el listado filtrado de pagos/facturas en CSV.

Query params opcionales:

- `status`
- `provider`
- `search`
- `dateFrom=YYYY-MM-DD`
- `dateTo=YYYY-MM-DD`

Headers de respuesta:

- `X-Export-Max-Rows`
- `X-Export-Truncated`

### `GET /admin/tenants/:slug/payments`

Mismo contrato que `/admin/payments`, pero restringido a un tenant.

### `GET /admin/tenants/:slug/payments/export.csv`

Exporta a CSV los pagos del tenant filtrado.

### `GET /admin/payments/:id`

Response:

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
    "subscriptions": [
      {
        "id": "1",
        "plan": {
          "code": "A",
          "name": "Realtime MP → AFIP"
        }
      }
    ]
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

Uso sugerido en UI:

- ficha de pago/factura
- timeline usando `events`
- acciones operativas

### `GET /admin/payments/:id/pdf`

Genera o reutiliza el PDF del comprobante y lo devuelve al admin.

Query params opcionales:

- `download=true`

Comportamiento:

- si el PDF ya existe, lo reutiliza
- si no existe, lo genera on-demand
- si `download=true`, responde como descarga
- si no, responde inline

### `POST /admin/payments/:id/reprocess`

Body:

```json
{
  "step": "auto"
}
```

Valores posibles:

- `auto`
- `afip`
- `post`

Response:

```json
{
  "ok": true,
  "paymentId": "100",
  "tenantId": "1",
  "step": "post"
}
```

## Notas internas

### `GET /admin/tenants/:slug/notes`

Devuelve notas internas del tenant.

### `POST /admin/tenants/:slug/notes`

Body:

```json
{
  "title": "Seguimiento",
  "body": "Cliente reporta diferencia en una factura.",
  "pinned": true
}
```

## Usuarios del tenant

### `GET /admin/tenants/:slug/users`

Lista usuarios del tenant.

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

Roles válidos:

- `owner`
- `admin`
- `viewer`
- `approver`

Status válidos:

- `ACTIVE`
- `DISABLED`

Notas:

- `password` es opcional al actualizar
- para que el usuario pueda entrar al portal cliente necesita `password`

## Integraciones

### `GET /admin/tenants/:slug/integrations`

Query param opcional:

- `revealSecrets=true`

### `PUT /admin/tenants/:slug/integrations/:provider`

Providers válidos:

- `MERCADOPAGO`
- `AFIP`
- `DRIVE`
- `SHEETS`

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

## Mapeo sugerido de pantallas

### Login admin

- `POST /admin/auth/login`
- `GET /admin/me`

### Dashboard global

- `GET /admin/dashboard`
- `GET /admin/reports/summary`
- `GET /admin/reports/timeseries`

### Clientes

- `GET /admin/tenants`

### Detalle de cliente

- `GET /admin/tenants/:slug`
- `GET /admin/tenants/:slug/dashboard`
- `GET /admin/tenants/:slug/payments`
- `GET /admin/tenants/:slug/notes`
- `GET /admin/tenants/:slug/integrations`
- `GET /admin/tenants/:slug/users`

### Operaciones

- `GET /admin/payments/:id`
- `GET /admin/payments/export.csv`
- `GET /admin/payments/:id/pdf`
- `POST /admin/payments/:id/reprocess`
- `GET /admin/tenants/:slug/payments/export.csv`
- `POST /admin/tenants/:slug/notes`
- `PUT /admin/tenants/:slug/integrations/:provider`

## Pendientes futuros

- invalidación real de sesión / refresh tokens
- filtros avanzados por plan/estado de tenant
- auditoría expuesta por endpoint
- endpoint específico para health operativo de integraciones
