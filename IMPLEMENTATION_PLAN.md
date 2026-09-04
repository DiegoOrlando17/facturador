# Plan de implementacion - Facturador

Ultima revision: 2026-09-02

## 1. Objetivo

Construir un SaaS multitenant para convertir ventas de Mercado Pago POS en comprobantes de ARCA, con modalidades automatica, programada y con aprobacion del cliente. El producto incluye portal administrativo, portal cliente, landing con alta y debito automatico, tutoriales y, en etapas posteriores, aplicaciones mobile y carga asistida por OCR.

La fuente funcional es `docs/ai/SCOPE.md`. Este plan traduce ese alcance a una secuencia verificable y registra el estado observado en el codigo al 2026-08-10.

Desde la tier inicial, todo comprobante emitido en ARCA debe poder descargarse como PDF desde el portal. A partir de la tier 3, el cliente puede activar opcionalmente una integracion con sus recursos de Google para guardar los PDF facturados en una carpeta de Drive y registrar en Sheets el estado de todos los pagos procesados, incluidos errores de facturacion.

## 2. Criterio de estado

- **Implementado**: existe un flujo conectado en codigo. Todavia puede requerir pruebas funcionales.
- **Parcial**: existe una base util, pero faltan piezas del alcance o validacion integral.
- **Prototipo**: existe UI visual con datos estaticos o sin flujo completo.
- **Pendiente**: no se encontro implementacion suficiente.
- **No verificado**: el codigo existe, pero depende de infraestructura o credenciales que no se probaron en esta revision.

## 3. Linea base actual

| Area | Estado | Evidencia y brecha principal |
| --- | --- | --- |
| Backend multitenant | Parcial | Express, Prisma/PostgreSQL, tenants, usuarios, perfiles, planes, suscripciones e integraciones. Faltan endurecimiento, tests y validacion integral. |
| Procesamiento MP POS -> ARCA -> PDF -> Drive/Sheets | Parcial / validado manualmente | El tenant `fiebre` completo el happy path real por polling/checkpoints, ARCA, PDF, Drive y Sheets, reportado por el usuario el 2026-08-26. Faltan certificar fallos, reintentos y concurrencia integral. |
| Panel admin web | Parcial | Login, dashboard, clientes, detalle, perfil fiscal, suscripcion, integraciones, pagos, notas, onboarding, admins y planes. No garantiza resolver toda incidencia sin DB/codigo. |
| Portal cliente API | Parcial | Auth, dashboard, pagos, CSV, PDF, reportes, integraciones y onboarding disponibles. Su validacion integral se difiere hasta conectar el portal cliente web. |
| Portal cliente web | Prototipo | `/portal-cliente` usa datos estaticos y no consume la API del portal. |
| Planes y suscripciones | Parcial | CRUD basico y asignacion a tenant; entitlements, limites, calendario, historial y cobro automatico no estan cerrados. PDF descargable debe estar disponible desde la tier inicial; Drive/Sheets opcional, desde la tier 3. |
| Facturacion con confirmacion | Pendiente | No existe un dominio separado de borrador/factura ni aprobacion, vencimiento o nota de credito. |
| Facturacion manual | Pendiente | No se encontro flujo de portal/admin completo. |
| OCR | Pendiente | Sin modelo de documento, proveedor ni proceso de revision. |
| Landing, registro y debito automatico | Pendiente | No se encontro aplicacion publica ni integracion de cobro de suscripcion. |
| Tutoriales | Pendiente | No se encontro experiencia publica/cliente implementada. |
| Mobile Android/iOS | Pendiente | No existe proyecto mobile ni decision de estrategia. |
| Calidad y operacion | Parcial | Entorno local, PostgreSQL, Redis, migraciones, datos demo, API, workers, admin y descarga PDF validados manualmente. Faltan tests automatizados, lint, CI y validacion integral del portal cliente. |

## 4. Decisiones bloqueantes antes de ampliar funcionalidad

Estas definiciones deben cerrarse durante la Fase 1 y registrarse en `docs/ai/DECISIONS.md`:

1. Politica detallada de confirmacion: vencimiento, aprobacion, rechazo y emision diferida; el scheduler automatico/programado ya fue definido en D-014.
2. Estrategia mobile: PWA primero o aplicaciones dedicadas.
3. Proveedor OCR, formatos, retencion de archivos y revision humana obligatoria.

## 5. Camino de implementacion

### Fase 0 - Recuperacion y linea base

Objetivo: poder modificar el sistema sin depender de supuestos heredados.

- [x] Inventariar backend, frontend, esquema, migraciones y documentacion disponible.
- [x] Clasificar alcance implementado, parcial, prototipo y pendiente.
- [x] Crear plan, contexto, decisiones y runbook centrales.
- [x] Verificar build frontend y sintaxis JavaScript.
- [x] Revisar y ordenar los cambios no confirmados en ambos repositorios Git sin descartarlos.
- [x] Crear archivos de ejemplo de entorno sin secretos y validar las variables necesarias para el entorno local.
- [x] Levantar PostgreSQL y Redis locales; aplicar migraciones y ejecutar seed/demo.
- [x] Validar manualmente API, workers y panel admin en el entorno local.
- [x] Validar integralmente la API del portal junto con el portal cliente web; validacion manual confirmada por el usuario el 2026-09-04.
- [x] Confirmar que documentos historicos siguen vigentes y clasificarlos en `docs/ai/DOCUMENT_STATUS.md` como fuentes vigentes, referencias tecnicas o referencias historicas.
- [x] Retirar el codigo, endpoints, colas, configuracion y dependencias obsoletos de webhooks y Payway.
- [x] Unificar backend, frontend y documentacion en un unico repositorio Git, sin gitlinks ni metadatos Git anidados.

Aceptacion: una instalacion limpia puede iniciarse siguiendo el runbook y el estado de cada flujo critico queda reproducible.

### Fase 1 - Dominio, planes y contratos

Objetivo: cerrar las reglas que condicionan el resto del producto.

- [x] Definir catalogo tecnico y matriz acumulativa de cuatro tiers.
- [x] Establecer la descarga PDF como entitlement base y la configuracion opcional de Drive/Sheets como entitlement de la tier 3 en adelante.
- [x] Definir nombres comerciales, precios y limites cuantitativos: Esencial USD 50, Control USD 75, Profesional USD 100 e Inteligente USD 125 por mes; sin limites generales, OCR 500 documentos/mes y realtime minimo 15 segundos.
- [x] Modelar entitlements, limites y configuracion de procesamiento por suscripcion mediante la politica versionada documentada en `docs/ai/PLAN_POLICY.md`.
- [x] Definir y crear de forma aditiva el dominio `Payment` / `Invoice` / credit note / document.
- [x] Adaptar workers, servicios y APIs al nuevo dominio, validar el flujo integral y retirar los campos fiscales duplicados de `Payment` manteniendo el contrato compatible.
- [x] Definir estados y transiciones; documentar idempotencia y reprocesos en `docs/ai/PROCESSING_STATES.md` y protegerlos en el dominio.
- [x] Definir y aplicar el contrato de scheduler para intervalos, horarios y zona horaria por tenant, documentado en `docs/ai/SCHEDULER.md`.
- [x] Completar contrato de seguridad y permisos para admin y tenant, documentado en `docs/ai/SECURITY_PERMISSIONS.md` y aplicado mediante capacidades backend.

Aceptacion: esquema, API y reglas soportan las cuatro capacidades progresivas del alcance sin condicionales ambiguos por nombre de plan.

### Fase 2 - Estabilizacion del nucleo de facturacion

Objetivo: certificar el flujo principal antes de sumar canales.

- [x] Probar deteccion de ventas Mercado Pago POS exclusivamente por polling/checkpoints con el tenant `fiebre`.
- [x] Probar idempotencia ante eventos duplicados y concurrencia mediante segunda pasada integral y locks Redis por pago/slot.
- [x] Probar emision ARCA, CAE, numeracion, errores y reintentos en homologacion, incluyendo falla controlada y recuperacion exitosa el 2026-09-01.
- [x] Validar que todo comprobante emitido en ARCA pueda generar un PDF descargable bajo demanda, sin persistencia local.
- [x] Validar configuracion opcional por tenant de carpeta Drive y planilla Sheets con el tenant `fiebre`.
- [x] Validar que Sheets registre una fila por pago y la actualice entre `ERROR` y `OK` durante reintentos; Drive conservo un unico PDF y la auditoria no detecto entregas registradas faltantes ni IDs Sheets duplicados.
- [x] Implementar scheduler por modalidad y tenant con exclusion distribuida Redis por slot.
- [x] Completar trazabilidad y acciones seguras de reproceso.
- [x] Incorporar tests automatizados de servicios y endpoints criticos, incluyendo acciones admin de reproceso y entrega Google con permisos, validaciones y respuestas seguras.

Herramienta disponible: `npm run invoice:test-flow -- --tenant=SLUG` crea un pago sintetico local y recorre el flujo real de workers contra homologacion/recursos de prueba, incluyendo una segunda pasada idempotente. Con `--verify-error-recovery` simula primero una respuesta ARCA fallida, verifica `afip_pending`/`FAILED` y Sheets `ERROR`, y luego recupera contra homologacion comprobando la misma fila en `OK`. Su ejecucion exitosa debe registrarse antes de cerrar esta fase.

Aceptacion: un tenant demo completa MP -> ARCA y puede generar el PDF bajo demanda sin persistirlo; un tenant de tier 3 o superior que habilita Google registra cada pago en Sheets aunque ARCA falle, actualiza la misma fila al reintentar y guarda en Drive solo los PDF facturados mediante un temporal eliminado al terminar; repetir un evento no duplica pagos, comprobantes, filas ni archivos.

### Fase 3 - Panel admin operable

Objetivo: resolver altas, configuracion e incidentes habituales sin acceder a DB o codigo.

- [x] Validar manualmente los flujos ya construidos y corregir contratos inconsistentes.
- [x] Completar planes: editor admin de servicios, limites opcionales, precio, moneda, ciclo y estado sobre la politica versionada vigente.
- [x] Completar administradores, roles y cambio/restablecimiento de password, protegiendo la cuenta operadora y el ultimo superadmin activo.
- [x] Mostrar auditoria de acciones sensibles con actor, tenant, entidad, cambios sanitizados y filtros desde el panel admin.
- [x] Convertir alertas en una cola operativa accionable con asignacion auditable, filtros por responsable y acceso directo a la causa real.
- [x] Agregar salud de integraciones, infraestructura, workers visibles y colas BullMQ con verificacion de solo lectura desde el panel.
- [x] Agregar soporte admin para emitir facturas pendientes asociadas a pagos, cancelar totalmente mediante nota de credito ARCA asociada y reprocesar con seguridad.

Aceptacion: las incidencias conocidas de onboarding, integraciones y facturacion se diagnostican y resuelven desde el panel con auditoria.

### Fase 4 - Portal cliente web MVP

Objetivo: reemplazar el prototipo estatico por una aplicacion funcional y responsive.

- [x] Integrar login y sesion de `TenantUser`.
- [x] Conectar dashboard, pagos, reportes, PDF, integraciones y onboarding existentes.
- [x] Permitir configurar y mostrar el estado de la carpeta Drive y la planilla Sheets del cliente.
- [x] Implementar perfil fiscal y estado de aprobacion.
- [x] Implementar facturas como recurso separado cuando se apruebe el dominio.
- [x] Aplicar permisos por usuario y entitlements por plan.
- [x] Implementar modalidad con confirmacion y emision diferida.
- [x] Permitir notas de credito para operaciones canceladas, con controles.
- [x] Implementar facturacion manual segun plan.
- [x] Validar responsive, accesibilidad, estados vacios y errores; validacion manual confirmada por el usuario el 2026-09-04.

Aceptacion: un cliente puede completar onboarding, revisar ventas, operar lo permitido por su tier y descargar todo comprobante emitido; desde la tier 3 puede configurar opcionalmente su destino Drive/Sheets sin asistencia tecnica.

### Fase 5 - Comercializacion y autoservicio

Objetivo: convertir el sistema operable en un producto contratable.

- [x] Construir landing publica con alcance, tiers, precios configurables, FAQ y contacto.
- [ ] Implementar registro, creacion de tenant y verificacion de identidad/contacto. El alta transaccional y la verificacion por token estan implementadas; falta transporte de email productivo.
- [x] Integrar Mercado Pago Suscripciones mediante checkout alojado y sincronizacion consultada contra la API ante webhooks; precios USD convertidos a ARS con vendedor billete BNA.
- [x] Aplicar alta, mora, pausa, cancelacion y reactivacion de forma segura; falta certificacion con credenciales de prueba y staging.
- [x] Publicar tutoriales de Mercado Pago, ARCA, Drive/Sheets y uso del portal.
- [x] Incorporar checklist guiado de onboarding.

Aceptacion: un prospecto puede entender, contratar e iniciar el onboarding; el estado de cobro gobierna el acceso de manera auditable.

### Fase 6 - OCR

Objetivo: crear borradores de comprobante desde archivos y exigir revision antes de ARCA.

- [ ] Definir proveedor, formatos, limites y politica de retencion.
- [ ] Modelar documentos, resultados y correcciones.
- [ ] Implementar upload seguro y procesamiento asincronico.
- [ ] Mostrar extraccion, confianza y validaciones para revision humana.
- [ ] Emitir solo tras confirmacion y registrar auditoria.

Aceptacion: PDF/imagen/Word soportado genera un borrador corregible; ningun resultado OCR se factura silenciosamente.

### Fase 7 - Produccion y observabilidad

Objetivo: operar el MVP de forma segura y recuperable.

- [ ] Definir ambientes, hosting, dominios, storage y gestion de secretos.
- [ ] Crear CI para build, tests, validacion Prisma y migraciones.
- [ ] Implementar healthchecks de API, DB, Redis, workers y colas.
- [ ] Configurar logs, metricas y alertas sin secretos.
- [ ] Definir backups, retencion, restauracion y rollback probado.
- [ ] Ejecutar staging y piloto controlado antes de produccion.

Aceptacion: despliegue y rollback son repetibles; una restauracion de backup y el flujo critico fueron probados en staging.

### Fase 8 - Mobile

Objetivo: cubrir admin y cliente en Android/iOS una vez estabilizados los contratos web/API.

- [ ] Confirmar PWA versus aplicaciones dedicadas.
- [ ] Definir MVP mobile para cliente y admin.
- [ ] Reutilizar API, permisos y entitlements estabilizados.
- [ ] Implementar almacenamiento seguro, notificaciones y distribucion.

Aceptacion: los flujos mobile acordados funcionan en Android/iOS y respetan las mismas reglas y auditoria que web.

## 6. Orden inmediato recomendado

1. Definir transporte de email transaccional.
2. Configurar credenciales de prueba y webhook de Mercado Pago Suscripciones.
3. Validar alta, mora, pausa, cancelacion, reactivacion y actualizacion mensual de importe en staging.
4. No iniciar OCR o mobile hasta cerrar la operacion comercial y productiva.

## 7. Riesgos principales

- Backend y frontend forman un unico monorepo desde 2026-08-26; antes de cada cambio debe comprobarse el estado Git desde la raiz.
- Las referencias a webhooks y Payway se conservan solo en el historial de decisiones; no deben reintroducirse sin una nueva decision arquitectonica.
- `Payment` concentra hoy datos de pago, factura y entregas; extenderlo sin definir el dominio puede dificultar notas de credito y modalidades con aprobacion.
- Existen defaults de secretos pensados para desarrollo; produccion debe fallar si faltan secretos fuertes.
- El healthcheck actual solo confirma que Express responde, no DB, Redis ni workers.
- La ausencia de tests automatizados hace que el build no sea evidencia suficiente del flujo fiscal.
- ARCA, Mercado Pago y cobros recurrentes implican efectos financieros; staging, idempotencia, auditoria y rollback son requisitos de salida.

## 8. Validacion de esta linea base

- `facturador-frontend`: `npm run build` correcto el 2026-09-01, incluido el editor admin de politicas y limites de planes.
- `facturador-backend`: 63 tests correctos, incluidos endpoints y reglas de emision administrativa, nota de credito asociada, protecciones, auditoria, alertas y salud; sintaxis JavaScript validada el 2026-09-02.
- PostgreSQL y Redis locales, migraciones Prisma, datos demo, tenants y planes: reportados como operativos el 2026-08-14.
- API, workers, frontend, login admin y descarga PDF: reportados como operativos el 2026-08-14.
- La validacion integral del portal cliente queda diferida hasta reemplazar el prototipo estatico por una aplicacion conectada a `/portal`.
- Las integraciones externas y el flujo completo MP -> ARCA -> Google conservan el estado de validacion especifico indicado en las fases siguientes.
- `invoice:test-flow -- --tenant=fiebre --amount=100 --require-drive --require-sheets`: correcto el 2026-09-01 contra PostgreSQL local, ARCA homologacion y Google de test; genero `Invoice.ISSUED`, CAE, un documento Drive y una fila Sheets, y la segunda pasada fue idempotente.
- `invoice:test-flow -- --tenant=fiebre --amount=100 --require-drive --require-sheets --verify-error-recovery`: correcto el 2026-09-01; verifico `afip_pending`/`FAILED`, fila Sheets `ERROR`, recuperacion `complete`/`ISSUED`, CAE, actualizacion de la misma fila a `OK`, un documento Drive y segunda pasada idempotente.
- `google:audit-deliveries -- --tenant=fiebre`: correcto el 2026-09-01, sin documentos registrados faltantes, IDs de pago duplicados ni filas Sheets desalineadas; permanecen recursos historicos externos no vinculados a la DB actual.
- Panel admin y Fase 3: cierre funcional confirmado el 2026-09-02 tras validar navegacion de pagos, acciones administrativas, visibilidad de errores y anulacion fiscal mediante nota de credito en homologacion; una falla de inicializacion de secuencia fue recuperada desde el panel y la nota finalizo `ISSUED` con numero y CAE.
- Portal cliente Fase 4: login, dashboard, pagos/PDF, reportes/CSV, integraciones Google, perfil fiscal, onboarding, facturas separadas, confirmacion inmediata/diferida, notas de credito y facturacion manual implementados el 2026-09-02. Build frontend, esquema Prisma y 71 tests backend correctos; falta validacion manual responsive/accesibilidad y certificacion fiscal de los nuevos flujos en homologacion antes de cerrar la fase.
