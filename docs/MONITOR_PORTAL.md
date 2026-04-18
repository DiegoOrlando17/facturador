# Monitor de Facturacion - propuesta inicial

## Objetivo

Agregar un monitor propio para que el producto deje de depender de Google Drive/Sheets como vista principal.

El monitor tendra dos superficies:

- Portal cliente: historial de facturacion, detalle de comprobantes, estado de cada venta/factura y reportes simples.
- Portal admin: operacion completa del sistema, gestion de clientes, soporte, revision de errores, configuracion de integraciones y alta de nuevos tenants.

Drive/Sheets quedan como salida opcional por tenant, no como experiencia default.

## Lo que ya tenemos

La base actual alcanza para arrancar:

- `Tenant`, `TenantUser`, `TenantIntegration` y `IntegrationCheckpoint` ya existen.
- `Payment` ya guarda casi todo lo necesario para listar facturas emitidas y problemas operativos.
- Hay API admin minima para tenants, usuarios e integraciones.
- El flujo operativo real ya es multitenant por polling.

Lo que todavia falta para portal real:

- autenticacion
- autorizacion por rol
- endpoints de consulta para monitor
- modelo de observabilidad/auditoria
- UI cliente/admin

## Principios del diseno

- El monitor consulta la base propia; Drive/Sheets pasa a ser una exportacion secundaria.
- Todo dato visible en portal debe estar asociado a `tenantId`.
- Admin global puede operar cualquier tenant desde el portal.
- Usuario cliente solo puede ver su tenant.
- La UI tiene que servir para soporte real: detectar, entender y resolver problemas sin tocar DB.

## Superficies del producto

## 1. Portal cliente

### Vistas principales

- Dashboard
  - facturado hoy / semana / mes
  - cantidad de comprobantes
  - ticket promedio
  - ultimas facturas
  - alertas: facturas fallidas, integracion desconectada, pendientes de reproceso
- Historial de facturacion
  - tabla con filtros por fecha, estado, monto, medio de pago, cliente/documento
  - busqueda por `provider_payment_id`, `cbte_nro`, `customer`, `customer_doc_number`
- Detalle de factura/pago
  - datos del pago
  - datos AFIP
  - links a PDF / Drive / Sheets si existen
  - timeline de estados
  - errores visibles en lenguaje claro
- Reportes
  - facturacion por periodo
  - cantidad de comprobantes por dia/semana/mes
  - top medios de pago
  - tasa de error / pendientes

### Acciones cliente

- Descargar PDF
- Filtrar y exportar CSV
- Ver estado de integraciones propias (solo lectura al inicio)
- Opcional fase posterior: autogestionar carpeta Drive / Sheet / datos de branding

## 2. Portal admin

### Vistas principales

- Dashboard global
  - tenants activos
  - tenants con errores
  - pagos pendientes/fallidos
  - integraciones desconectadas
  - resumen de facturacion global
- Clientes
  - listado de tenants
  - estado
  - plan
  - ultima actividad
  - salud de integraciones
- Detalle de cliente
  - datos del tenant
  - usuarios
  - integraciones
  - checkpoint MP
  - secuencias AFIP
  - ultimas facturas
  - errores recientes
- Facturas/pagos globales
  - vista transversal para soporte
  - filtros por tenant, estado, fecha, proveedor, monto
- Centro de operaciones
  - reprocesar pago/factura
  - reintentar Drive/Sheets
  - resincronizar checkpoint o secuencia
  - deshabilitar/habilitar integraciones
  - alta y configuracion de tenant

### Acciones admin

- Crear tenant
- Editar tenant
- Agregar usuarios al tenant
- Configurar integraciones
- Forzar reproceso de un pago
- Marcar incidente / nota interna
- Ver auditoria de cambios

## Roles propuestos

Separar roles globales de roles por tenant.

### Roles globales

- `superadmin`: control total
- `operator`: soporte operativo y reprocesos
- `viewer`: solo lectura global

### Roles por tenant

- `owner`: control total del tenant
- `admin`: gestiona usuarios y configuracion menor
- `analyst`: ve reportes e historial
- `viewer`: solo lectura basica

## Autenticacion recomendada

Hoy no hay auth. Para no mezclar conceptos, conviene agregar dos capas:

- `AdminUser`: usuario global del sistema
- `TenantUser`: sigue representando acceso por tenant

Recomendacion MVP:

- login con email + password para admin
- login por magic link o password para cliente
- sesion con cookie HttpOnly o JWT corto + refresh en cookie

Si queremos minimizar complejidad inicial:

- fase 1: solo admin auth
- fase 2: login cliente

## Datos y entidades nuevas

El modelo actual sirve para listar, pero para operar bien desde portal faltan algunas entidades.

### 1. `AdminUser`

Usuario global del sistema.

Campos sugeridos:

- `id`
- `email`
- `passwordHash`
- `role`
- `status`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

### 2. `PaymentEvent`

Timeline tecnico y funcional de cada pago.

Campos sugeridos:

- `id`
- `tenantId`
- `paymentId`
- `type` (`payment_detected`, `invoice_requested`, `afip_ok`, `pdf_ok`, `drive_ok`, `retry_scheduled`, `failed`, etc.)
- `message`
- `payloadJson`
- `createdAt`

Sirve para:

- mostrar timeline en portal
- entender errores sin revisar logs
- auditar reprocesos

### 3. `TenantAuditLog`

Auditoria de acciones de admin o cambios sensibles.

Campos sugeridos:

- `id`
- `tenantId`
- `actorType` (`admin`, `tenant_user`, `system`)
- `actorId`
- `action`
- `entityType`
- `entityId`
- `beforeJson`
- `afterJson`
- `createdAt`

### 4. `TenantNote`

Notas internas de soporte.

Campos sugeridos:

- `id`
- `tenantId`
- `createdByAdminUserId`
- `title`
- `body`
- `pinned`
- `createdAt`

### 5. Campos utiles en `Payment`

Antes de abrir el portal conviene evaluar sumar:

- `invoice_pdf_url` o mantener solo `pdf_path` si el archivo siempre vive local
- `customer_email`
- `external_reference`
- `metadataJson`
- `lastRetryAt`
- `resolvedAt`

No todos son obligatorios para MVP.

## Decisiones cerradas

- Login cliente: password.
- Frontend: repo separado del backend actual.
- `Plan` y `Subscription`: se usan desde la primera version del portal admin.
- PDFs: estrategia hibrida.

## Estrategia recomendada para PDFs

La opcion mas practica para este producto es no depender de almacenar siempre el PDF.

Recomendacion:

- guardar siempre los datos estructurados del comprobante en DB
- generar el PDF on-demand cuando el cliente o admin lo pida
- permitir cache opcional por tenant
- seguir soportando persistencia en disco o Drive para clientes que lo necesiten

### Por que esta estrategia es buena

- baja costo de almacenamiento
- evita generar archivos que nadie descargue
- mantiene flexibilidad para clientes que si quieren archivo persistido
- el monitor sigue funcionando aunque el PDF no exista todavia

### Modo sugerido por defecto

- `PDF_MODE = on_demand`

Comportamiento:

- al completar una factura, se guarda todo menos el PDF fisico
- si alguien abre "Descargar PDF", se genera en ese momento
- opcionalmente se cachea por un tiempo o se persiste si el tenant lo pide

### Modos a soportar mas adelante

- `on_demand`: default recomendado
- `persistent_local`: se genera y guarda local
- `persistent_external`: se genera y sube a storage/Drive

Esto implica que, en una fase posterior, conviene desacoplar el estado "factura emitida" del estado "PDF generado".

## API propuesta

Separar la API operativa actual de la API del monitor.

### Admin

- `POST /admin/auth/login`
- `POST /admin/auth/logout`
- `GET /admin/me`
- `GET /admin/dashboard`
- `GET /admin/tenants`
- `POST /admin/tenants`
- `GET /admin/tenants/:slug`
- `PATCH /admin/tenants/:slug`
- `GET /admin/tenants/:slug/users`
- `PUT /admin/tenants/:slug/users`
- `GET /admin/tenants/:slug/integrations`
- `PUT /admin/tenants/:slug/integrations/:provider`
- `GET /admin/tenants/:slug/payments`
- `GET /admin/payments`
- `GET /admin/payments/:id`
- `POST /admin/payments/:id/reprocess`
- `GET /admin/audit`
- `POST /admin/tenants/:slug/notes`

### Cliente

- `POST /portal/auth/login`
- `POST /portal/auth/logout`
- `GET /portal/me`
- `GET /portal/dashboard`
- `GET /portal/payments`
- `GET /portal/payments/:id`
- `GET /portal/reports/summary`
- `GET /portal/reports/timeseries`
- `GET /portal/integrations`

## Reportes iniciales

### Cliente y admin

- facturacion total por rango
- cantidad de comprobantes por rango
- ticket promedio
- distribucion por estado
- distribucion por medio de pago
- serie temporal diaria / semanal / mensual

### Solo admin

- ranking de tenants por facturacion
- ranking de tenants por errores
- tenants sin actividad
- integraciones desconectadas o incompletas
- backlog operativo por estado

## Resolucion de problemas desde el portal admin

Para cumplir la idea de "resolver todo desde el portal", el admin deberia poder:

- ver el error tecnico y una explicacion legible
- ver el timeline del pago
- reintentar pasos puntuales
- editar configuracion de integraciones
- inspeccionar ultimo checkpoint MP
- inspeccionar numeracion AFIP
- dejar notas internas

Eso implica que el backend no solo guarde el estado final, sino tambien eventos y contexto.

## Estrategia UI recomendada

El repo actual es backend-only. Para no trabar el avance, conviene separar el trabajo en dos capas:

### Capa 1 - Backend de monitor

- auth
- consultas paginadas y filtradas
- reportes agregados
- eventos/auditoria
- acciones admin

### Capa 2 - Frontend

Opciones viables:

- agregar un frontend separado (`web/`) con React/Vite
- agregar una app SSR aparte
- evitar mezclar la UI con el proceso de workers

Recomendacion: frontend separado, consumiendo la API Express.

## Roadmap sugerido

### Fase 1 - Base del monitor admin

- auth admin
- endpoints de listado/detalle de pagos por tenant
- dashboard admin simple
- pantalla de clientes
- pantalla de detalle de cliente

Resultado: ya podes operar tenants y revisar facturas desde un portal propio.

### Fase 2 - Observabilidad operativa

- `PaymentEvent`
- `TenantAuditLog`
- endpoint de reproceso
- notas internas
- timeline de errores y acciones

Resultado: soporte real desde portal, sin depender de logs ni DB.

### Fase 3 - Portal cliente

- auth cliente
- dashboard cliente
- historial y detalle
- descarga/export
- reportes base

Resultado: el cliente deja de depender de Drive como experiencia principal.

### Fase 4 - Reportes avanzados y autogestion

- analytics comparativos
- configuraciones editables por tenant
- alertas
- exportaciones programadas

## Recomendacion concreta para arrancar

El mejor primer paso no es la UI completa, sino dejar firme el backend del monitor admin.

Orden recomendado:

1. agregar auth admin
2. crear endpoints de consulta de pagos y dashboard
3. agregar `PaymentEvent`
4. recien despues montar la UI admin
5. una vez estable, abrir portal cliente usando las mismas bases

## MVP exacto

Si queremos arrancar chico pero util, el MVP deberia incluir:

- login admin
- listado de tenants
- detalle de tenant
- listado de pagos/facturas con filtros
- detalle de pago/factura
- reproceso manual
- configuracion de integraciones

Con eso ya tenes una primera version del monitor que reemplaza bastante del uso operativo de Drive, aunque todavia no el acceso del cliente final.

## Decisiones abiertas

- si el login cliente va a ser password o magic link
- si el frontend vive dentro de este repo o en repo/app separada
- si `Plan`/`Subscription` se van a usar de verdad en el portal admin desde la primera version
- si los PDFs se van a servir desde disco local, object storage o ambos

## Siguiente paso sugerido

Tomar esta propuesta y bajar el primer corte tecnico:

- esquema Prisma para auth admin + eventos
- contratos de API admin para dashboard, tenants y payments
- mapa de pantallas del portal admin MVP

Ese seria el punto ideal para pasar de diseno conceptual a implementacion.

## Estado actual del primer corte tecnico

Ya quedaron preparados:

- esquema base para `AdminUser`, `PaymentEvent`, `TenantAuditLog` y `TenantNote`
- auth admin MVP con login por password
- token admin firmado para `Authorization: Bearer <token>`
- rutas:
  - `POST /admin/auth/login`
  - `POST /admin/auth/logout`
  - `GET /admin/me`
- proteccion del resto de `/admin`

Pendiente inmediato:

- dashboard admin
- listado/detalle de pagos del monitor
- endpoint de reproceso
- alta visual de tenants/admins desde portal
