# Contexto del proyecto

Ultima revision: 2026-08-26

## Producto

Facturador es un SaaS multitenant argentino para emitir comprobantes en ARCA a partir de ventas realizadas mediante Mercado Pago POS. Debe soportar capacidades progresivas por tier:

1. envio automatico, casi en tiempo real o programado;
2. creacion de comprobantes pendientes de confirmacion, emision diferida y notas de credito;
3. comprobantes manuales;
4. creacion asistida por OCR desde archivos.

El alcance completo tambien incluye panel admin web/mobile, portal cliente web/mobile, landing, registro, debito automatico y tutoriales. Existen cuatro planes tecnicos `TIER_1` a `TIER_4` con entitlements acumulativos; sus precios y limites cuantitativos aun no estan definidos.

Todas las tiers incluyen la descarga desde el portal del PDF de cada comprobante emitido en ARCA. A partir de la tier 3 se ofrece una integracion opcional con Google del cliente: una carpeta de Drive para los PDF facturados y una planilla de Sheets para registrar el estado de todos los pagos procesados.

## Repositorio y estructura

- `facturador-backend/`: API y workers Node.js.
- `facturador-frontend/`: aplicacion React que hoy contiene principalmente el panel admin y un prototipo estatico del portal cliente.
- `docs/ai/SCOPE.md`: fuente del alcance funcional.
- `IMPLEMENTATION_PLAN.md`: estado y secuencia de trabajo vigente.
- `docs/ai/`: contexto, decisiones, runbook, errores y prompts compartidos.
- `docs/ai/DOCUMENT_STATUS.md`: clasificacion y precedencia de la documentacion historica.
- `docs/ai/PROCESSING_STATES.md`: contrato canonico de estados, idempotencia y reprocesos.
- `docs/ai/PLAN_POLICY.md`: contrato versionado de entitlements, limites y modos de procesamiento.
- `docs/ai/SCHEDULER.md`: reglas de polling por tenant, zona horaria y limitaciones de concurrencia.
- `docs/ai/SECURITY_PERMISSIONS.md`: matriz de capacidades para roles admin y tenant.
- `files for review/`: analisis y capturas de referencia visual; no son implementacion ejecutable.

Desde 2026-08-26, backend, frontend y documentacion forman un unico repositorio Git. No hay gitlinks, submodulos ni metadatos `.git` dentro de los directorios de las aplicaciones; el estado y los commits se administran desde la raiz.

## Stack confirmado

### Backend

- Node.js >= 18, ESM, Express 5.
- PostgreSQL con Prisma 6.
- Redis y BullMQ.
- Mercado Pago POS mediante polling/checkpoints, ARCA/AFIP SDK y servicios XML.
- Google Drive y Google Sheets.
- La deteccion por webhooks de Mercado Pago y la integracion Payway fueron retiradas; no forman parte del producto.
- Mercado Pago es una fuente de pagos POS existentes y se consulta en modo solo lectura. El tenant `fiebre` usa credenciales productivas de MP; nunca se deben crear pagos, preferencias ni tokens de tarjeta con esas credenciales. ARCA, Drive y Sheets configurados para ese tenant son recursos de prueba.
- PDFKit para comprobantes PDF.

### Frontend

- React 18, TypeScript, Vite 5 y React Router 6.
- CSS propio; no se observo framework de componentes externo.

## Arquitectura actual

La API Express expone:

- `/admin`: autenticacion y operaciones del panel interno;
- `/portal`: autenticacion y consultas limitadas al tenant;
- `/google`: callback OAuth publico con `state` firmado; el inicio del flujo se autoriza desde admin por tenant;
- `/health`: liveness basico de Express.

Prisma modela tenants, perfil fiscal, usuarios tenant/admin, planes, suscripciones, integraciones cifradas, checkpoints, pagos, comprobantes fiscales, documentos, eventos, auditoria, notas, onboarding y secuencias de factura.

El procesamiento vigente usa polling/checkpoints de Mercado Pago POS y las colas `payments` e `invoices`, con workers de procesamiento, emision, reintentos y auditoria. El worker ARCA obtiene o crea una `Invoice` por pago y registra su ciclo fiscal; si la factura ya esta emitida, omite una nueva llamada a ARCA y continua el postproceso. PDF y Drive leen los datos fiscales exclusivamente desde `Invoice`; las entregas Drive se registran idempotentemente como `InvoiceDocument`. Sheets continua vinculado al pago porque tambien registra fallas anteriores a la emision.

El comando `invoice:test-flow` permite crear un pago sintetico en PostgreSQL local y recorrer el flujo real con ARCA en homologacion y recursos Google de prueba, sin depender de una venta nueva de Mercado Pago. Incluye protecciones contra base remota/ARCA productiva y una segunda pasada para verificar idempotencia.

## Estado funcional resumido

- Panel admin web: funcional en varias areas, pero requiere smoke tests y completar operacion sin acceso tecnico.
- Portal API: login, dashboard, pagos, exportacion, PDF, reportes, integraciones y onboarding.
- Portal web: prototipo estatico; no es todavia una interfaz real sobre `/portal`.
- Nucleo Mercado Pago/ARCA/PDF/Drive/Sheets: happy path validado manualmente con el tenant `fiebre` el 2026-08-26; faltan escenarios integrales de error, reintento y concurrencia.
- Landing, alta autoservicio, cobro recurrente, OCR y mobile: pendientes.
- Facturacion con confirmacion y manual: pendientes de flujo completo. El admin puede emitir una factura pendiente asociada a un pago y solicitar una anulacion total mediante nota de credito relacionada; falta certificar esta ultima integralmente en homologacion.
- Webhooks de Mercado Pago y Payway: retirados del codigo y fuera de alcance.

## Reglas de negocio ya materializadas

- Todo dato operativo relevante se asocia a un `tenantId`.
- La unicidad de pagos es por tenant, proveedor e identificador del proveedor.
- El PDF queda disponible despues de la emision correcta en ARCA y se genera en memoria cuando se solicita desde el portal; no se almacena localmente de forma permanente.
- Si un cliente de tier 3 o superior habilita Google, todos los pagos procesados se registran en Sheets y los PDF de comprobantes facturados se guardan en la carpeta Drive configurada.
- Para tenants elegibles con Sheets activo, cada pago procesado se registra aunque ARCA falle. La fila se actualiza entre `ERROR` y `OK` en los reintentos; no se agrega una fila nueva por intento.
- Las credenciales de integraciones se almacenan cifradas y se presentan enmascaradas por defecto.
- El perfil fiscal esta separado de `Tenant` y usa estados `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`.
- Un perfil completo editado vuelve a requerir revision.
- Roles admin: `SUPERADMIN`, `OPERATOR`, `VIEWER`; varias mutaciones sensibles ya exigen `SUPERADMIN`, pero la matriz completa debe auditarse en backend.
- Roles tenant almacenados como string: `owner`, `admin`, `viewer`, `approver`.
- Los tokens admin y tenant tienen TTL configurable; el logout actual es logico y no revoca tokens en servidor.

## Limitaciones tecnicas conocidas

- `Invoice`, `InvoiceEvent` e `InvoiceDocument` son el dominio fiscal vigente. `Payment` conserva datos y estado operativo del cobro, pero ya no almacena CAE, numero/tipo de comprobante, punto de venta, PDF ni enlace Drive. Admin, portal y CSV mantienen campos compatibles mediante una proyeccion desde `Invoice`.
- El modelo de plan usa `featuresJson`; no hay entitlements/limites tipados ni enforcement integral.
- El healthcheck no comprueba PostgreSQL, Redis, colas ni integraciones.
- El backend tiene tests unitarios con `node:test`; el frontend valida tipos durante el build. Todavia no hay lint ni CI.
- Hay valores fallback de secretos para desarrollo; no son aceptables en produccion.
- El storage local de PDFs no tiene aun estrategia productiva documentada.
- No se verifico en esta revision el estado de migraciones contra una base real.

## Documentacion relacionada

- `facturador-backend/docs/API_ENDPOINTS.md`, `ADMIN_MONITOR_API.md` y `PORTAL_API.md`: contratos historicos; deben contrastarse con las rutas antes de usarlos como fuente normativa.
- `facturador-backend/docs/ROADMAP_PRODUCCION.md`: roadmap historico utilizado como evidencia, reemplazado como plan activo por `IMPLEMENTATION_PLAN.md`.
- `facturador-backend/docs/DOMAIN_DECISIONS.md`: antecedente de decisiones incorporado a `docs/ai/DECISIONS.md`.
