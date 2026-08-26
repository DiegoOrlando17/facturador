# Decisiones tecnicas y de producto

Ultima revision: 2026-08-26

Este archivo registra decisiones durables. Las preguntas abiertas se incluyen al final y no deben tratarse como decisiones aprobadas.

## D-001 - Arquitectura SaaS multitenant

Estado: vigente (heredada)

Decision: usar un unico backend y una base compartida, aislando datos operativos por `tenantId`.

Contexto: el producto atiende multiples clientes con credenciales, usuarios, configuraciones y procesamiento independientes.

Alternativas consideradas: una instalacion/base por cliente; esquema PostgreSQL por cliente.

Rationale: reduce costo operativo y coincide con el modelo ya implementado. Las restricciones compuestas e identidad de tenant permiten aislamiento logico.

Consecuencias:

- cada query, job, archivo y evento debe conservar contexto de tenant;
- endpoints de portal nunca deben aceptar un tenant arbitrario del cliente;
- tests de aislamiento son obligatorios antes de produccion.

## D-002 - Perfil fiscal separado del tenant

Estado: vigente (heredada, 2026-05-24)

Decision: mantener `Tenant` como identidad tecnica y `TenantProfile` para datos fiscales, comerciales y de contacto.

Contexto: el perfil se usa en onboarding, aprobacion administrativa y facturacion, y cambia con reglas distintas a la identidad del tenant.

Alternativas consideradas: agregar todos los campos a `Tenant`; guardar perfil como JSON.

Rationale: separa responsabilidades, permite medir completitud y soporta un ciclo de aprobacion explicito.

Consecuencias: el perfil usa `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`; una edicion relevante debe volver a revision y conservar actor, fecha y notas.

## D-003 - Procesamiento asincronico con Redis/BullMQ

Estado: vigente (heredada)

Decision: separar recepcion/deteccion, procesamiento de pago, emision y reintentos mediante colas y workers.

Contexto: Mercado Pago y ARCA son integraciones externas con latencia, duplicados y fallas transitorias.

Alternativas consideradas: procesar todo dentro del webhook; cron monolitico sin colas.

Rationale: desacopla la API de las integraciones y permite reintentos y escalado independiente.

Consecuencias: PostgreSQL y Redis son dependencias operativas; jobs deben ser idempotentes; workers, colas fallidas y backlog necesitan healthchecks y alertas.

## D-004 - Credenciales de integracion por tenant cifradas

Estado: vigente (heredada)

Decision: persistir configuracion sensible por `TenantIntegration.secretEnc`, cifrada con una clave maestra, y enmascararla en respuestas normales.

Contexto: cada cliente aporta tokens/certificados distintos.

Alternativas consideradas: variables de entorno por cliente; credenciales en texto plano.

Rationale: las variables globales no escalan a multitenancy y el texto plano es un riesgo inaceptable.

Consecuencias: la clave maestra necesita gestion y rotacion; produccion debe rechazar defaults; revelar secretos debe restringirse, auditarse y evitarse cuando sea posible.

## D-005 - Separar autenticacion admin y tenant

Estado: vigente (heredada)

Decision: usar identidades, tokens, secretos y middlewares separados para admin y portal cliente.

Contexto: ambos actores tienen fronteras y permisos distintos.

Alternativas consideradas: una tabla y un token comun con roles globales.

Rationale: reduce confusion entre privilegios internos y permisos del cliente, y refuerza el aislamiento.

Consecuencias: deben mantenerse matrices de permisos backend; ocultar UI no reemplaza autorizacion; queda pendiente definir revocacion/refresh/reset de password.

## D-006 - El portal cliente actual es un prototipo, no una funcionalidad terminada

Estado: vigente

Decision: considerar `/portal-cliente` referencia visual y reconstruir sus flujos sobre la API `/portal`, sin contabilizar datos estaticos como avance funcional.

Contexto: la pagina contiene navegacion, metricas y facturas codificadas en el componente, mientras la API real ya ofrece parte de esos datos.

Alternativas consideradas: extender el componente monolitico; marcar el portal como implementado por existir una pantalla.

Rationale: una clasificacion explicita evita planificar sobre una capacidad inexistente y permite dividir el portal por rutas y recursos reales.

Consecuencias: el diseño puede reutilizarse, pero auth, estados, errores, permisos y responsive deben implementarse y validarse.

## D-007 - Secuencia de reanudacion basada en riesgo

Estado: vigente

Decision: estabilizar entorno y flujo fiscal, luego cerrar dominio/planes y conectar el portal; OCR, mobile y comercializacion avanzada se ejecutan despues del nucleo confiable.

Contexto: existe mucho codigo sin pruebas automatizadas ni certificacion end-to-end, y el alcance financiero amplifica el costo de duplicados o estados ambiguos.

Alternativas consideradas: continuar directamente con pantallas admin; iniciar landing/mobile en paralelo.

Rationale: el dominio de facturas, entitlements e idempotencia condiciona todos los canales.

Consecuencias: la primera fase puede producir menos UI nueva, pero reduce retrabajo y riesgo fiscal.

## D-008 - Mercado Pago POS se consulta mediante polling y checkpoints

Estado: vigente

Decision: no utilizar webhooks para detectar ventas del POS de Mercado Pago. El mecanismo soportado por el producto es polling con checkpoints por tenant.

Contexto: al inicio se intento un flujo basado en webhooks, pero se abandono porque no es compatible con la API de Mercado Pago POS utilizada por el producto.

Alternativas consideradas: webhooks de Mercado Pago; polling periodico con checkpoints.

Rationale: polling/checkpoints es el mecanismo compatible con la fuente POS que debe facturarse.

Consecuencias:

- `/webhook/mercadopago`, `webhook.worker.js` y la cola `webhooks` fueron retirados el 2026-08-14;
- no deben reintroducirse en despliegues, pruebas funcionales ni planes de producto sin una nueva decision arquitectonica;
- la observabilidad debe controlar frecuencia de polling, checkpoint, retraso y fallas por tenant.

## D-009 - Payway queda discontinuado

Estado: vigente

Decision: excluir Payway del producto y no continuar su integracion.

Contexto: la integracion se inicio, pero no se recibio el soporte necesario para avanzar y fue abandonada.

Alternativas consideradas: mantenerla como integracion futura; continuar investigando sin soporte; retirarla.

Rationale: mantener una integracion no operable aumenta superficie de mantenimiento y confunde el alcance vigente.

Consecuencias:

- worker, endpoints, configuracion, dependencia y pruebas Payway fueron retirados el 2026-08-14;
- Payway no debe desplegarse, documentarse como capacidad ni recibir nuevas funcionalidades sin una nueva decision arquitectonica.

## D-010 - PDF desde la tier inicial y Google Drive/Sheets desde la tier 3

Estado: vigente

Decision: incluir en la tier inicial la descarga desde el portal del PDF de todo comprobante emitido correctamente en ARCA. Ofrecer a partir de la tier 3 una integracion opcional con recursos Google propiedad del cliente: una carpeta Drive para almacenar los PDF facturados y una planilla Sheets para registrar el estado de todos los pagos procesados, exitosos o fallidos.

Contexto: estas capacidades forman parte de la experiencia base posterior a la facturacion, aunque no estaban explicitadas originalmente en el scope.

Alternativas consideradas: reservar PDF o Google para tiers superiores; almacenar exclusivamente en infraestructura propia; hacer obligatoria la integracion Google.

Rationale: el cliente siempre necesita acceso a sus comprobantes; Google ofrece una copia y registro opcionales en herramientas que ya controla, sin obligarlo a configurar la integracion.

Consecuencias:

- PDF descargable es un entitlement base y no puede ocultarse por plan;
- la descarga genera el PDF bajo demanda en memoria, sin persistencia local;
- Drive/Sheets es configurable y opcional, y solo esta disponible desde la tier 3;
- solo se exportan comprobantes emitidos correctamente en ARCA;
- para Drive se crea un PDF temporal que debe eliminarse despues del intento de subida, exitoso o fallido;
- la carpeta y planilla pertenecen al cliente y se configuran por tenant;
- reintentos deben ser idempotentes para no duplicar archivos ni filas;
- Sheets representa el estado operativo de todos los pagos procesados: registra errores de facturacion sin PDF y actualiza la misma fila cuando el estado cambia;
- el portal y el panel admin deben mostrar configuracion, estado y errores de ambas entregas.

## D-011 - Separar pagos de comprobantes fiscales

Estado: vigente

Decision: mantener `Payment` como representacion del cobro externo y crear `Invoice` como agregado fiscal separado. `Invoice` admite comprobantes originados de forma automatica, con confirmacion, manual u OCR; las notas de credito se modelan como comprobantes `CREDIT_NOTE` relacionados con el comprobante original.

Contexto: `Payment` concentraba datos del cobro, estados de procesamiento, datos ARCA, PDF y entregas. Ese modelo no permite representar correctamente borradores, facturacion sin pago asociado, confirmacion previa, OCR ni notas de credito.

Alternativas consideradas: continuar ampliando `Payment`; crear modelos separados para factura y nota de credito; usar un unico agregado fiscal con tipo y autorrelacion.

Rationale: un agregado fiscal tipado evita duplicar reglas entre facturas y notas de credito, permite comprobantes sin Mercado Pago y separa el ciclo del cobro del ciclo de emision fiscal.

Consecuencias:

- `Invoice.paymentId` es opcional y unico: un pago puede originar como maximo un comprobante principal;
- una nota de credito referencia a la factura original mediante `relatedInvoiceId` y no reutiliza `paymentId`;
- `InvoiceEvent` registra transiciones, errores y reintentos del circuito fiscal;
- `InvoiceDocument` registra archivos fuente o PDF externos, pero el PDF descargable puede seguir generandose bajo demanda sin persistencia;
- la primera migracion fue aditiva y copio los datos fiscales existentes mientras se adaptaron workers y APIs;
- despues de validar el flujo integral e idempotencia, los campos fiscales duplicados de `Payment` fueron retirados el 2026-08-16;
- `sheets_row`, el estado operativo y los errores permanecen en `Payment` porque Sheets tambien registra fallas anteriores a la emision.

## D-012 - Estados canonicos y reprocesos protegidos

Estado: vigente

Decision: separar la maquina operativa de `Payment` del ciclo fiscal de `Invoice`, validar todas sus transiciones en el dominio y tratar `Invoice.ISSUED` como terminal. Los reprocesos seleccionan ARCA o postproceso segun el estado fiscal, nunca solo por el estado del pago.

Contexto: los enums existian, pero las escrituras no validaban origen y destino. Un reproceso ambiguo podia intentar el paso incorrecto y una lectura concurrente podia permitir que mas de un worker reclamara la emision.

Alternativas consideradas: mantener convenciones solo en workers; unificar pago y factura en una sola maquina; validar transiciones en los modelos.

Rationale: las dos entidades tienen responsabilidades y ciclos distintos. Centralizar reglas evita saltos invalidos, protege la emision terminal y permite reutilizar el contrato en workers, APIs y futuras modalidades.

Consecuencias:

- las transiciones permitidas se definen en `src/domain/processingState.js` y se documentan en `docs/ai/PROCESSING_STATES.md`;
- los cambios de estado comparan el estado observado para detectar competencia entre workers;
- `Invoice.ISSUED` no vuelve a `ISSUING`; una anulacion futura crea una `CREDIT_NOTE`;
- el paso `post` exige una factura emitida y el paso `afip` la rechaza;
- los valores persistidos y los contratos publicos existentes no cambian.

## D-013 - Politica versionada de planes

Estado: vigente

Decision: representar capacidades, limites y modos permitidos mediante una politica versionada en `Plan.featuresJson`; la suscripcion activa selecciona la politica efectiva del tenant. La configuracion concreta permanece por tenant y debe validarse contra esa politica.

Contexto: existia una matriz acumulativa, pero Google interpretaba `featuresJson` por su cuenta y no habia un contrato comun para limites o procesamiento.

Alternativas consideradas: columnas booleanas por capacidad; tablas normalizadas para cada entitlement; JSON versionado con resolver tipado.

Rationale: el JSON versionado permite evolucionar el catalogo sin una migracion por cada capacidad, mientras el resolver central evita interpretaciones divergentes. Las tablas dedicadas se reconsideraran si aparecen overrides, medicion o consultas complejas.

Consecuencias:

- `src/domain/planPolicy.js` es la unica interpretacion valida de la politica;
- los endpoints de planes y resumen de suscripcion exponen `policy` de forma aditiva;
- un plan o una suscripcion inactivos no conceden capacidades;
- se conserva compatibilidad temporal con JSON plano y planes `A/B`;
- los limites `null` no bloquean operaciones hasta definir valores comerciales;
- el scheduler debera validar modo, intervalo y cantidad de ejecuciones contra la politica.

## D-014 - Scheduler por tenant gobernado por suscripcion

Estado: vigente

Decision: configurar el polling de Mercado Pago por tenant con modo `realtime` o `scheduled`, zona IANA y limites validados contra la politica efectiva. La confirmacion del cliente pertenece al ciclo fiscal y no es un modo del scheduler.

Contexto: el worker tenia reglas de horario en memoria, con defaults permisivos y sin validar la suscripcion. Esto mezclaba capacidad comercial, frecuencia de polling y modalidad de emision.

Alternativas consideradas: cron global; jobs recurrentes BullMQ por tenant; evaluador central por intervalos con configuracion por tenant.

Rationale: el evaluador central preserva el polling/checkpoint existente, permite reglas por tenant y es determinista para pruebas. BullMQ recurrente puede evaluarse cuando cambie el modelo operativo.

Consecuencias:

- `src/domain/tenantScheduler.js` normaliza y evalua la configuracion;
- los horarios usan `HH:mm` y una zona IANA explicita;
- `RUNS_PER_DAY` queda como fallback heredado;
- configuraciones no permitidas se rechazan al guardar y al ejecutar;
- la deduplicacion por slot es solo por instancia hasta implementar lock distribuido Redis.

## D-015 - Autorizacion por capacidades en backend

Estado: vigente

Decision: aplicar permisos por capacidad en middlewares backend y mapearlos a roles admin y tenant. `SUPERADMIN` conserva acceso completo; `OPERATOR` opera tenants sin administrar privilegios globales; `VIEWER` es solo lectura. En portal, `owner/admin` operan y `approver/viewer` leen hasta implementar aprobaciones fiscales.

Contexto: la autenticacion estaba implementada, pero casi todas las rutas admin aceptaban cualquier rol autenticado. Ademas, algunos listados tenant devolvian `passwordHash` y la revelacion de secretos no comprobaba rol.

Alternativas consideradas: controles por ruta basados directamente en nombres de rol; permisos persistidos en base; matriz estatica de capacidades.

Rationale: capacidades centralizadas evitan condicionales dispersos y permiten evolucionar roles sin cambiar cada controlador. La persistencia se difiere hasta que exista necesidad de roles personalizados.

Consecuencias:

- `src/domain/permissions.js` define la matriz vigente;
- los middlewares devuelven `403` para usuarios autenticados sin permiso;
- `passwordHash` no se serializa en operaciones administrativas de usuarios tenant;
- `revealSecrets=true` requiere `SUPERADMIN`;
- cambios futuros de rol deben agregar tests de permisos y revisar la UI correspondiente.

## D-016 - Monorepo unico para backend, frontend y documentacion

Estado: vigente

Decision: administrar `facturador-backend/`, `facturador-frontend/` y la documentacion central dentro de un unico repositorio Git, con un solo remoto operativo `origin`.

Contexto: backend y frontend se desarrollaban en repositorios independientes, mientras el plan y la documentacion compartida necesitaban coordinar cambios entre ambos. La separacion dejaba estados Git y commits que no representaban una version integral del producto.

Alternativas consideradas: conservar repositorios independientes; usar submodulos; importar ambos historiales y operar un monorepo.

Rationale: el producto comparte contratos, plan, runbook y criterios de validacion. Un monorepo permite versionar esos cambios de forma atomica y reduce el riesgo de combinaciones incompatibles.

Consecuencias:

- el estado Git, las ramas y los commits se administran desde la raiz;
- no se admiten `.git` anidados, gitlinks ni submodulos para las dos aplicaciones;
- los comandos de desarrollo siguen ejecutandose dentro del directorio de cada aplicacion;
- los antiguos remotos separados no forman parte de la operacion normal.

## Decisiones pendientes

No estan aprobadas; deben resolverse antes de las fases que dependen de ellas.

| ID | Pregunta | Bloquea |
| --- | --- | --- |
| P-001 | Nombres comerciales, precios y limites cuantitativos de `TIER_1` a `TIER_4`; la matriz funcional acumulativa ya esta definida en `planCatalog.js` | Landing y cobro |
| P-005 | Proveedor de debito/cobro recurrente | Registro y suscripciones comerciales |
| P-006 | PWA versus apps dedicadas y alcance de cada app | Mobile |
| P-007 | Proveedor OCR, formatos, limites y retencion | OCR |
| P-009 | Storage productivo de PDFs y documentos | Produccion, OCR y backups |
