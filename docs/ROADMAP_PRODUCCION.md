# Roadmap de producto y produccion - Facturador

Fecha de referencia: 2026-05-25

## Vision del producto

**Facturador** es una aplicacion desarrollada por **Dorlando** para facilitar la facturacion en AFIP de clientes que cobran con Mercado Pago, tanto por transferencias como por cobros desde POS.

El producto se ofrecera como servicio con abono mensual. El precio dependera del plan contratado y de los servicios incluidos.

La aplicacion debe cubrir:

- facturacion automatica en tiempo real desde Mercado Pago;
- facturacion asincronica programada;
- portal web para clientes;
- futura aplicacion mobile;
- panel admin interno para Dorlando;
- landing comercial;
- tutoriales de onboarding;
- descarga de facturas en PDF;
- integracion opcional con Google Drive y Google Sheets;
- facturacion manual desde pagos, cargas manuales, OCR y WhatsApp.

## Principio de trabajo

Cada nueva sesion de trabajo debe arrancar desde este documento.

Regla:

1. Revisar **Proximo paso**.
2. Elegir una tarea concreta.
3. Implementar y verificar.
4. Actualizar este roadmap.
5. Dejar escrito el nuevo **Proximo paso**.

## Proximo paso

Avanzar con **Fase 2 - Panel admin Dorlando**.

Primera tarea concreta:

1. Validar manualmente en el panel admin la nueva revision de **Datos del cliente**.
2. Completar datos fiscales, confirmar que quedan en estado pendiente y aprobarlos.
3. Confirmar que el dashboard muestra perfiles pendientes como operacion para revisar.
4. Luego avanzar con **Configuracion > Planes**: servicios incluidos, limites, precio, moneda, ciclo y estado.

## Alcance general

### Usuarios principales

- **Visitante comercial**: entra a la landing, entiende el producto y solicita contacto/onboarding.
- **Cliente del portal**: empresa o persona que cobra por Mercado Pago y necesita facturar.
- **Administrador Dorlando**: opera clientes, altas, planes, integraciones y soporte.
- **Superadmin Dorlando**: configura planes, administradores, reglas internas y parametros globales.

### Canales

- Portal web cliente.
- Panel admin web.
- Landing page publica.
- Seccion de tutoriales/documentacion.
- Aplicacion mobile futura.
- Integracion futura por WhatsApp.

### Servicios ofrecidos por plan

- Facturacion en tiempo real.
- Facturacion asincronica programada.
- Portal con pagos recibidos, estados y estadisticas.
- Facturacion manual de pagos de Mercado Pago.
- Facturacion manual de pagos creados desde el portal.
- Facturacion manual de pagos importados por OCR desde PDF/imagenes.
- Facturacion manual desde chat de WhatsApp.
- Descarga de facturas PDF.
- Guardado de facturas PDF en Google Drive.
- Registro de informacion en Google Sheets.

## Estado actual

### Ya avanzado

- Backend Express multitenant.
- Prisma/PostgreSQL.
- Redis/BullMQ para workers.
- Modelo base de tenants, pagos, integraciones, usuarios, admins, notas, onboarding.
- Admin auth con token.
- Panel admin React/Vite.
- Dashboard admin redisenado.
- Cola inicial de operaciones para revisar.
- Listado/detalle de clientes.
- Integraciones por cliente.
- Pagos por cliente y detalle de pago.
- Notas internas.
- Usuarios del tenant.
- Perfil admin: `Mis datos`.
- Gestion de administradores internos para `SUPERADMIN`.
- Configuracion inicial de planes.
- Prototipo visual aprobado para admin y portal cliente.

### Ultima verificacion tecnica

Fecha: 2026-05-24

- Migraciones Prisma: al dia, 9 migraciones aplicadas.
- Prisma Client: regenerado.
- Backend: levantado en `http://localhost:5000`.
- Healthcheck `/health`: OK.
- Frontend: `npm run build` OK.
- Backend syntax check: `node --check src/server.js` OK.

Nota operativa: durante `prisma generate`, fue necesario detener y volver a levantar el backend local porque Windows tenia bloqueado el binario de Prisma.

Ultimo avance:

- Se agrego endpoint `PUT /admin/tenants/:slug/subscription`.
- El detalle de cliente admin ya permite gestionar **Plan y suscripcion**.
- La asignacion de plan se refleja en el resumen del cliente y en el checklist de onboarding.
- La operacion queda restringida a `SUPERADMIN`.
- Se agrego estado de aprobacion al `TenantProfile`: `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`.
- Se agrego migracion `20260525120000_tenant_profile_approval`.
- La migracion fue aplicada en la base local con `npx prisma migrate deploy`.
- Se agrego endpoint `POST /admin/tenants/:slug/profile/review`.
- El detalle de cliente admin ya permite aprobar o rechazar **Datos del cliente**.
- El dashboard puede marcar perfiles completos pendientes de aprobacion como operacion para revisar.

## Hitos de producto

### Hito A - Base operable interna

Dorlando puede administrar clientes, planes, admins, datos fiscales e integraciones desde el panel.

### Hito B - Portal cliente MVP

El cliente puede ingresar, completar datos, ver pagos/facturas y entender acciones pendientes.

### Hito C - Facturacion automatica confiable

El sistema procesa Mercado Pago -> AFIP -> PDF -> Drive/Sheets con reintentos y trazabilidad.

### Hito D - Producto comercializable

Landing, tutoriales, planes, onboarding y soporte listos para captar clientes.

### Hito E - Produccion

Infraestructura, seguridad, monitoreo, backups y despliegue estable.

### Hito F - Canales avanzados

Mobile, OCR y WhatsApp.

## Fase 1 - Definicion funcional y modelo de datos base

Objetivo: ordenar el dominio antes de seguir construyendo pantallas.

- [ ] Definir entidades principales:
  - cliente/tenant;
  - perfil fiscal;
  - integraciones;
  - pagos;
  - facturas;
  - planes;
  - suscripciones;
  - usuarios internos;
  - usuarios cliente;
  - solicitudes de onboarding;
  - trabajos programados;
  - archivos/documentos.
- [x] Crear modelo `TenantProfile` o extender `Tenant` para datos del cliente:
  - razon social;
  - nombre comercial;
  - CUIT;
  - condicion IVA;
  - domicilio fiscal;
  - email;
  - telefono;
  - responsable.
- [ ] Definir modelo de factura propia si hace falta separar `Payment` de `Invoice`.
- [ ] Definir estados canonicos:
  - pago detectado;
  - pendiente de datos;
  - pendiente AFIP;
  - facturado;
  - PDF generado;
  - enviado a Drive;
  - registrado en Sheets;
  - error;
  - requiere accion manual.
- [ ] Definir modelo de servicios incluidos por plan.
- [ ] Definir si features de plan quedan en JSON o en tablas modeladas.
- [ ] Definir modelo de suscripcion:
  - plan;
  - precio;
  - fecha de inicio;
  - estado;
  - vencimiento;
  - historial.
- [ ] Definir diferencias entre:
  - pagos de Mercado Pago;
  - pagos creados manualmente;
  - pagos importados por OCR;
  - pagos originados desde WhatsApp.
- [x] Documentar decisiones en `docs/`.

## Fase 2 - Panel admin Dorlando

Objetivo: que Dorlando pueda operar clientes y configuraciones internas sin tocar la base de datos.

- [ ] Validar dashboard con datos reales.
- [ ] Mejorar cola "Operaciones para revisar":
  - altas pendientes;
  - clientes con datos fiscales incompletos;
  - integraciones incompletas;
  - errores AFIP;
  - errores Mercado Pago;
  - fallas Drive/Sheets;
  - jobs programados fallidos.
- [x] Agregar seccion **Datos del cliente** al detalle:
  - vista resumen;
  - formulario editable;
  - indicadores de completitud.
- [x] Agregar flujo de aprobacion de datos del cliente.
- [x] Agregar gestion de plan y suscripcion en detalle de cliente.
- [ ] Mejorar Configuracion > Planes:
  - servicios incluidos;
  - limites;
  - precio;
  - moneda;
  - ciclo;
  - estado.
- [ ] Agregar configuracion global:
  - datos de Dorlando;
  - datos fiscales propios si aplican;
  - templates;
  - parametros de procesamiento;
  - textos de onboarding.
- [ ] Agregar gestion de administradores:
  - nombre;
  - email;
  - rol;
  - estado;
  - reset/cambio de password.
- [ ] Revisar permisos por rol:
  - Superadmin;
  - Operacion;
  - Solo lectura.
- [ ] Agregar auditoria visible para acciones sensibles.

## Fase 3 - Portal cliente web MVP

Objetivo: que el cliente pueda operar desde web sin asistencia tecnica constante.

- [ ] Crear layout real del portal cliente basado en prototipo aprobado.
- [ ] Login cliente con `TenantUser`.
- [ ] Home del cliente:
  - acciones pendientes;
  - resumen de estado;
  - ultimos movimientos importantes;
  - acceso rapido a facturas.
- [ ] Pantalla **Mis datos**:
  - datos fiscales;
  - datos de contacto;
  - domicilio;
  - responsable.
- [ ] Guardar cambios como solicitud pendiente si requieren aprobacion.
- [ ] Mostrar estado de onboarding:
  - faltan datos;
  - esperando aprobacion;
  - listo para operar.
- [ ] Pantalla de pagos:
  - pagos recibidos de Mercado Pago;
  - estado;
  - filtros;
  - estadisticas basicas.
- [ ] Pantalla de facturas:
  - facturas emitidas;
  - descarga PDF;
  - estado Drive/Sheets si aplica.
- [ ] Acciones manuales permitidas segun plan:
  - facturar pago de MP;
  - crear pago manual;
  - cargar archivo para OCR;
  - iniciar solicitud por WhatsApp cuando exista.
- [ ] Textos orientados a usuario no tecnico.
- [ ] Estados vacios claros.
- [ ] Responsive web mobile.

## Fase 4 - Onboarding y tutoriales

Objetivo: que el cliente sepa como obtener todo lo necesario para operar.

- [ ] Crear seccion publica o dentro del portal: **Tutoriales**.
- [ ] Tutorial Mercado Pago:
  - obtener access token;
  - configurar POS;
  - permisos;
  - dudas frecuentes.
- [ ] Tutorial AFIP:
  - generar certificado;
  - obtener key;
  - punto de venta;
  - tipo de comprobante;
  - CUIT/condicion fiscal.
- [ ] Tutorial Google Drive/Sheets:
  - permisos;
  - carpeta destino;
  - spreadsheet destino.
- [ ] Tutorial uso del portal:
  - ver pagos;
  - descargar facturas;
  - crear facturacion manual.
- [ ] Tutorial OCR:
  - formatos aceptados;
  - calidad de imagen;
  - revision antes de facturar.
- [ ] Tutorial WhatsApp:
  - como enviar datos;
  - formato recomendado;
  - confirmacion.
- [ ] Agregar checklist de onboarding dentro del portal.
- [ ] Agregar checklist de aprobacion dentro del admin.

## Fase 5 - Facturacion automatica Mercado Pago -> AFIP

Objetivo: que el servicio principal sea confiable.

- [ ] Validar integracion Mercado Pago:
  - transferencias;
  - POS;
  - busqueda por fecha;
  - webhooks;
  - checkpoints.
- [ ] Definir modo por cliente/plan:
  - tiempo real;
  - asincronico programado;
  - manual.
- [ ] Implementar configuracion de periodicidad:
  - cada X minutos;
  - diaria;
  - semanal;
  - mensual;
  - horarios permitidos.
- [ ] Validar AFIP:
  - certificados;
  - CAE;
  - numeracion;
  - errores frecuentes;
  - reintentos.
- [ ] Crear trazabilidad completa por pago/factura.
- [ ] Crear reproceso seguro.
- [ ] Evitar duplicados.
- [ ] Generar PDF con datos correctos.
- [ ] Descargar PDF desde portal.
- [ ] Guardar PDF en Drive si el plan lo incluye.
- [ ] Registrar datos en Sheets si el plan lo incluye.

## Fase 6 - Facturacion manual

Objetivo: permitir facturar operaciones que no entran por el flujo automatico.

- [ ] Facturacion manual de pago de Mercado Pago:
  - seleccionar pago;
  - completar datos faltantes;
  - emitir factura.
- [ ] Crear pago manual desde portal:
  - monto;
  - comprador;
  - documento;
  - concepto;
  - fecha;
  - comprobante esperado.
- [ ] Crear factura manual desde admin para soporte.
- [ ] Validaciones antes de AFIP.
- [ ] Historial de quien ejecuto la accion.
- [ ] Permisos por rol/plan.
- [ ] Estados y errores visibles para cliente y admin.

## Fase 7 - OCR de facturas/PDF/imagenes

Objetivo: importar informacion desde documentos para facturacion manual.

- [ ] Definir alcance OCR MVP:
  - PDF;
  - JPG/PNG;
  - datos minimos a extraer.
- [ ] Elegir proveedor/tecnologia OCR.
- [ ] Crear carga de archivo desde portal.
- [ ] Crear procesamiento asincronico.
- [ ] Mostrar resultado extraido para revision humana.
- [ ] Permitir corregir datos antes de facturar.
- [ ] Registrar archivo original.
- [ ] Guardar auditoria de cambios.
- [ ] Manejar errores de baja calidad/no legible.
- [ ] Definir limites por plan.

## Fase 8 - WhatsApp

Objetivo: permitir crear solicitudes/facturas desde chat.

- [ ] Definir proveedor WhatsApp:
  - WhatsApp Business Cloud API;
  - Twilio;
  - otro.
- [ ] Definir flujo conversacional:
  - identificar cliente;
  - recibir datos;
  - confirmar;
  - crear solicitud;
  - emitir o dejar pendiente.
- [ ] Definir seguridad:
  - numeros autorizados;
  - validacion de identidad;
  - permisos por usuario.
- [ ] Crear parser de mensajes.
- [ ] Crear cola de revision manual.
- [ ] Integrar con portal/admin.
- [ ] Notificar resultado por WhatsApp.
- [ ] Registrar auditoria.

## Fase 9 - Google Drive y Google Sheets

Objetivo: ofrecer alternativa para clientes que no quieran usar el portal como fuente principal.

- [ ] Configurar por cliente:
  - carpeta Drive;
  - spreadsheet;
  - hoja;
  - columnas.
- [ ] Guardar PDF en Drive.
- [ ] Guardar link en factura/pago.
- [ ] Registrar fila en Sheets.
- [ ] Evitar duplicados en Sheets.
- [ ] Reintentos ante fallas Google.
- [ ] Accion manual para reenviar a Drive/Sheets.
- [ ] Validar permisos expirados.
- [ ] Mostrar estado en portal y admin.

## Fase 10 - Landing comercial

Objetivo: captar nuevos clientes y explicar claramente el producto.

- [ ] Definir identidad de marca:
  - Facturador;
  - desarrollado por Dorlando;
  - tono visual;
  - logo si falta.
- [ ] Crear landing publica:
  - hero claro;
  - problema que resuelve;
  - servicios;
  - planes;
  - beneficios;
  - preguntas frecuentes;
  - llamada a contacto/demo.
- [ ] Explicar integraciones:
  - Mercado Pago;
  - AFIP;
  - Google Drive;
  - Google Sheets;
  - WhatsApp futuro.
- [ ] Agregar formulario de contacto o solicitud de demo.
- [ ] Agregar pagina de tutoriales publica o semi-publica.
- [ ] Preparar SEO basico.
- [ ] Preparar analytics.

## Fase 11 - Mobile

Objetivo: ofrecer acceso mobile al portal.

- [ ] Definir estrategia:
  - PWA;
  - React Native;
  - wrapper web;
  - app nativa mas adelante.
- [ ] Definir MVP mobile:
  - login;
  - acciones pendientes;
  - pagos;
  - facturas PDF;
  - datos personales.
- [ ] Asegurar responsive del portal web.
- [ ] Evaluar notificaciones push.
- [ ] Definir publicacion en stores si aplica.

## Fase 12 - Seguridad y cuentas

Objetivo: publicar con un nivel razonable de proteccion.

- [ ] Expiracion de tokens.
- [ ] Refresh token o re-login simple.
- [ ] Cambio de contrasena admin.
- [ ] Cambio/restablecimiento de contrasena cliente.
- [ ] Rate limiting en login.
- [ ] Validacion de permisos por endpoint.
- [ ] Secretos cifrados:
  - Mercado Pago;
  - AFIP;
  - Google.
- [ ] Logs sin secretos.
- [ ] Politica de usuarios deshabilitados.
- [ ] Auditoria de acciones sensibles.
- [ ] Politica de backups y retencion.

## Fase 13 - Testing y calidad

Objetivo: reducir regresiones antes de produccion.

- [ ] Tests de servicios criticos:
  - auth;
  - tenants;
  - plans;
  - payments;
  - AFIP;
  - Mercado Pago;
  - Drive/Sheets.
- [ ] Tests de endpoints principales.
- [ ] Smoke test manual documentado.
- [ ] Build frontend en CI.
- [ ] Verificacion backend en CI.
- [ ] Datos demo reproducibles.
- [ ] Pruebas de roles.
- [ ] Pruebas responsive.
- [ ] Pruebas de errores comunes.

## Fase 14 - Infraestructura y produccion

Objetivo: desplegar de forma repetible y recuperable.

- [ ] Elegir hosting backend.
- [ ] Elegir hosting frontend.
- [ ] Provisionar PostgreSQL produccion.
- [ ] Provisionar Redis produccion.
- [ ] Configurar workers en produccion.
- [ ] Configurar variables de entorno.
- [ ] Configurar dominio.
- [ ] Configurar HTTPS.
- [ ] Configurar storage para PDFs si no quedan solo en Drive.
- [ ] Estrategia de migrations.
- [ ] Backups DB.
- [ ] Backups archivos.
- [ ] Monitoreo basico.
- [ ] Logs accesibles.
- [ ] Procedimiento de rollback.

## Fase 15 - Observabilidad y soporte

Objetivo: saber que falla y ayudar rapido.

- [ ] Healthcheck backend real.
- [ ] Healthcheck workers.
- [ ] Estado DB.
- [ ] Estado Redis.
- [ ] Estado Mercado Pago por cliente.
- [ ] Estado AFIP por cliente.
- [ ] Estado Drive/Sheets por cliente.
- [ ] Alertas:
  - backend caido;
  - worker caido;
  - cola creciendo;
  - errores AFIP repetidos;
  - integraciones vencidas;
  - muchos pagos sin facturar.
- [ ] Panel interno de jobs/colas.
- [ ] Procedimiento de reproceso.
- [ ] Panel de soporte interno.

## Fase 16 - Preproduccion

Objetivo: probar como produccion sin clientes reales.

- [ ] Crear ambiente staging.
- [ ] Cargar tenant demo completo.
- [ ] Ejecutar flujo real:
  - MP;
  - AFIP;
  - PDF;
  - Drive;
  - Sheets.
- [ ] Probar portal cliente.
- [ ] Probar admin.
- [ ] Probar landing.
- [ ] Probar tutoriales.
- [ ] Validar roles.
- [ ] Validar responsive.
- [ ] Validar textos no tecnicos.
- [ ] Congelar alcance de primera version.

## Fase 17 - Publicacion inicial

Objetivo: lanzar una primera version comercial operable.

- [ ] Crear DB produccion.
- [ ] Aplicar migraciones.
- [ ] Crear primer Superadmin.
- [ ] Configurar secretos.
- [ ] Deploy backend.
- [ ] Deploy workers.
- [ ] Deploy frontend admin/portal.
- [ ] Deploy landing.
- [ ] Validar healthchecks.
- [ ] Crear cliente piloto.
- [ ] Cargar integraciones reales.
- [ ] Ejecutar procesamiento controlado.
- [ ] Monitorear primeras horas.
- [ ] Documentar incidencias.
- [ ] Ajustar roadmap post-lanzamiento.

## MVP recomendado

Para no demorar indefinidamente, el primer MVP deberia incluir:

- landing simple;
- panel admin Dorlando;
- gestion de clientes;
- datos fiscales del cliente;
- planes y suscripciones basicas;
- portal cliente web;
- onboarding guiado;
- Mercado Pago automatico;
- AFIP;
- PDF descargable;
- Drive/Sheets opcional;
- facturacion manual basica;
- monitoreo minimo.

Quedan para despues del primer MVP:

- OCR;
- WhatsApp;
- mobile app nativa;
- estadisticas avanzadas;
- suscripciones cobradas automaticamente;
- automatizaciones comerciales complejas.

## Backlog posterior

- [ ] OCR avanzado.
- [ ] WhatsApp completo.
- [ ] App mobile nativa.
- [ ] Notificaciones email/push.
- [ ] Reportes comerciales avanzados.
- [ ] Exportaciones configurables.
- [ ] Auditoria avanzada.
- [ ] Plantillas personalizadas de factura.
- [ ] Integraciones contables externas.
- [ ] Centro de ayuda completo.
- [ ] Automatizacion de ventas/onboarding.
