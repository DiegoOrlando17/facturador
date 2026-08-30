# Plan de implementacion - Facturador

Ultima revision: 2026-08-26

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

1. Nombres comerciales, precios y limites cuantitativos de los tiers. La matriz funcional acumulativa ya esta materializada en `planCatalog.js`, preservando PDF descargable como capacidad inicial e integracion opcional Drive/Sheets desde la tier 3.
2. Politica detallada de confirmacion: vencimiento, aprobacion, rechazo y emision diferida; el scheduler automatico/programado ya fue definido en D-014.
3. Proveedor y flujo de cobro recurrente para las suscripciones.
4. Estrategia mobile: PWA primero o aplicaciones dedicadas.
5. Proveedor OCR, formatos, retencion de archivos y revision humana obligatoria.

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
- [ ] Validar integralmente la API del portal junto con el portal cliente web cuando se implemente su conexion.
- [x] Confirmar que documentos historicos siguen vigentes y clasificarlos en `docs/ai/DOCUMENT_STATUS.md` como fuentes vigentes, referencias tecnicas o referencias historicas.
- [x] Retirar el codigo, endpoints, colas, configuracion y dependencias obsoletos de webhooks y Payway.
- [x] Unificar backend, frontend y documentacion en un unico repositorio Git, sin gitlinks ni metadatos Git anidados.

Aceptacion: una instalacion limpia puede iniciarse siguiendo el runbook y el estado de cada flujo critico queda reproducible.

### Fase 1 - Dominio, planes y contratos

Objetivo: cerrar las reglas que condicionan el resto del producto.

- [x] Definir catalogo tecnico y matriz acumulativa de cuatro tiers.
- [x] Establecer la descarga PDF como entitlement base y la configuracion opcional de Drive/Sheets como entitlement de la tier 3 en adelante.
- [ ] Definir nombres comerciales, precios y limites cuantitativos.
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
- [ ] Probar idempotencia ante eventos duplicados y concurrencia.
- [ ] Probar emision ARCA, CAE, numeracion, errores y reintentos. El happy path fue validado manualmente; faltan fallos y reintentos.
- [x] Validar que todo comprobante emitido en ARCA pueda generar un PDF descargable bajo demanda, sin persistencia local.
- [x] Validar configuracion opcional por tenant de carpeta Drive y planilla Sheets con el tenant `fiebre`.
- [ ] Validar que Sheets registre una fila por pago y la actualice entre `ERROR` y `OK` durante reintentos; validar que Drive reciba solo PDF de comprobantes facturados, sin duplicados.
- [x] Implementar scheduler por modalidad y tenant con exclusion distribuida Redis por slot.
- [ ] Completar trazabilidad y acciones seguras de reproceso.
- [ ] Incorporar tests automatizados de servicios y endpoints criticos.

Herramienta disponible: `npm run invoice:test-flow -- --tenant=SLUG` crea un pago sintetico local y recorre el flujo real de workers contra homologacion/recursos de prueba, incluyendo una segunda pasada idempotente. Su ejecucion exitosa debe registrarse antes de cerrar esta fase.

Aceptacion: un tenant demo completa MP -> ARCA y puede generar el PDF bajo demanda sin persistirlo; un tenant de tier 3 o superior que habilita Google registra cada pago en Sheets aunque ARCA falle, actualiza la misma fila al reintentar y guarda en Drive solo los PDF facturados mediante un temporal eliminado al terminar; repetir un evento no duplica pagos, comprobantes, filas ni archivos.

### Fase 3 - Panel admin operable

Objetivo: resolver altas, configuracion e incidentes habituales sin acceder a DB o codigo.

- [ ] Validar manualmente los flujos ya construidos y corregir contratos inconsistentes.
- [ ] Completar planes: servicios, limites, precio, moneda, ciclo y estado.
- [ ] Completar administradores, roles y cambio/restablecimiento de password.
- [ ] Mostrar auditoria de acciones sensibles.
- [ ] Convertir alertas en una cola operativa accionable.
- [ ] Agregar salud de integraciones, workers y colas.
- [ ] Agregar soporte para emitir, cancelar mediante nota de credito y reprocesar con seguridad.

Aceptacion: las incidencias conocidas de onboarding, integraciones y facturacion se diagnostican y resuelven desde el panel con auditoria.

### Fase 4 - Portal cliente web MVP

Objetivo: reemplazar el prototipo estatico por una aplicacion funcional y responsive.

- [ ] Integrar login y sesion de `TenantUser`.
- [ ] Conectar dashboard, pagos, reportes, PDF, integraciones y onboarding existentes.
- [ ] Permitir configurar y mostrar el estado de la carpeta Drive y la planilla Sheets del cliente.
- [ ] Implementar perfil fiscal y estado de aprobacion.
- [ ] Implementar facturas como recurso separado cuando se apruebe el dominio.
- [ ] Aplicar permisos por usuario y entitlements por plan.
- [ ] Implementar modalidad con confirmacion y emision diferida.
- [ ] Permitir notas de credito para operaciones canceladas, con controles.
- [ ] Implementar facturacion manual segun plan.
- [ ] Validar responsive, accesibilidad, estados vacios y errores.

Aceptacion: un cliente puede completar onboarding, revisar ventas, operar lo permitido por su tier y descargar todo comprobante emitido; desde la tier 3 puede configurar opcionalmente su destino Drive/Sheets sin asistencia tecnica.

### Fase 5 - Comercializacion y autoservicio

Objetivo: convertir el sistema operable en un producto contratable.

- [ ] Construir landing publica con alcance, tiers, precios, FAQ y contacto.
- [ ] Implementar registro, creacion de tenant y verificacion de identidad/contacto.
- [ ] Integrar debito automatico y sincronizacion segura del estado de suscripcion segun el mecanismo soportado por el proveedor elegido.
- [ ] Aplicar alta, mora, cancelacion y reactivacion de forma segura.
- [ ] Publicar tutoriales de Mercado Pago, ARCA, Drive/Sheets y uso del portal.
- [ ] Incorporar checklist guiado de onboarding.

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

1. Definir nombres comerciales, precios y limites cuantitativos cuando exista la decision comercial.
2. Iniciar Fase 2 certificando el nucleo MP -> ARCA con homologacion y recursos de prueba.
3. Validar idempotencia, errores, reintentos y entregas PDF/Drive/Sheets.
4. Validar el lock distribuido Redis al operar multiples replicas del scheduler.
5. No iniciar OCR, landing de cobro o mobile hasta estabilizar el nucleo fiscal.

## 7. Riesgos principales

- Backend y frontend forman un unico monorepo desde 2026-08-26; antes de cada cambio debe comprobarse el estado Git desde la raiz.
- Las referencias a webhooks y Payway se conservan solo en el historial de decisiones; no deben reintroducirse sin una nueva decision arquitectonica.
- `Payment` concentra hoy datos de pago, factura y entregas; extenderlo sin definir el dominio puede dificultar notas de credito y modalidades con aprobacion.
- Existen defaults de secretos pensados para desarrollo; produccion debe fallar si faltan secretos fuertes.
- El healthcheck actual solo confirma que Express responde, no DB, Redis ni workers.
- La ausencia de tests automatizados hace que el build no sea evidencia suficiente del flujo fiscal.
- ARCA, Mercado Pago y cobros recurrentes implican efectos financieros; staging, idempotencia, auditoria y rollback son requisitos de salida.

## 8. Validacion de esta linea base

- `facturador-frontend`: `npm run build` correcto el 2026-08-26.
- `facturador-backend`: 34 tests correctos, esquema Prisma valido y todos los `.js` de `src` y `prisma` aprobados por `node --check` el 2026-08-30.
- PostgreSQL y Redis locales, migraciones Prisma, datos demo, tenants y planes: reportados como operativos el 2026-08-14.
- API, workers, frontend, login admin y descarga PDF: reportados como operativos el 2026-08-14.
- La validacion integral del portal cliente queda diferida hasta reemplazar el prototipo estatico por una aplicacion conectada a `/portal`.
- Las integraciones externas y el flujo completo MP -> ARCA -> Google conservan el estado de validacion especifico indicado en las fases siguientes.
