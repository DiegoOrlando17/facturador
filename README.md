# Facturador

Monorepo del SaaS multitenant para convertir ventas de Mercado Pago POS en comprobantes de ARCA.

## Estructura

- `facturador-backend/`: API Express, workers BullMQ, Prisma y servicios de integracion.
- `facturador-frontend/`: panel web React/Vite y prototipo del portal cliente.
- `docs/ai/`: contexto, decisiones, operacion y contratos tecnicos vigentes.
- `IMPLEMENTATION_PLAN.md`: alcance, estado y orden de implementacion.

Backend y frontend forman parte de un unico repositorio Git. Los comandos de cada aplicacion se ejecutan desde su directorio.

## Inicio local

Requisitos: Node.js 18 o superior, npm, PostgreSQL y Redis.

```powershell
cd facturador-backend
npm install
npm start
```

En terminales separadas:

```powershell
cd facturador-backend
npm run start:workers
```

```powershell
cd facturador-frontend
npm install
npm run dev
```

La configuracion completa, las variables de entorno y las precauciones para integraciones externas estan en [`docs/ai/RUNBOOK.md`](docs/ai/RUNBOOK.md).

## Administracion de planes

El panel `Configuracion` permite a `SUPERADMIN` crear y editar planes, precio, moneda, ciclo, estado, servicios habilitados y limites opcionales. Dejar un limite vacio conserva el valor comercial como no definido.

El panel de administradores permite asignar roles, activar o desactivar cuentas y restablecer passwords. Cada administrador puede cambiar su propia password desde `Mi cuenta`, confirmando primero la actual.

La seccion `Auditoria` muestra las acciones administrativas registradas, con filtros por tenant y accion. Los datos sensibles se ocultan en el backend antes de enviarse al navegador.

La seccion `Alertas` funciona como cola operativa: permite tomar o liberar casos, filtrar alertas sin asignar o propias y abrir directamente el pago, onboarding, perfil o integracion que origina el problema. La alerta desaparece solo cuando se corrige su causa real.

La seccion `Integraciones` muestra diagnosticos reales y de solo lectura para configuraciones de tenants, API, PostgreSQL, Redis, workers y colas BullMQ. Sus alcances y limitaciones estan detallados en el runbook.

Desde el detalle de un pago, un operador puede encolar una factura pendiente o solicitar la anulacion total de una factura emitida mediante una nota de credito asociada. La anulacion exige escribir `ANULAR`, un plan con `creditNotes` y el worker `creditNote.worker.js` activo.

## Portal del cliente

`/portal-cliente/login` permite ingresar con identificador de empresa, email y password de `TenantUser`. La sesion del cliente se almacena de forma independiente de la sesion administrativa y protege `/portal-cliente`.

El dashboard inicial consume datos reales del tenant autenticado y muestra importes y pagos procesados, pendientes o con alertas. La seccion `Pagos y facturas` permite buscar y filtrar operaciones, abrir su detalle, revisar la trazabilidad, descargar el PDF cuando ARCA ya emitio el comprobante y exportar hasta 10.000 pagos filtrados en CSV.

La seccion `Reportes` resume cantidad, importe y ticket promedio para un rango de fechas, con evolucion agrupada por dia, semana o mes.

La seccion `Integraciones` muestra Mercado Pago, ARCA, Drive y Sheets. Los roles tenant `owner/admin` pueden probar conexiones y, cuando el plan incluye Google, configurar los IDs de carpeta y planilla sin acceder ni modificar credenciales OAuth. La autorizacion OAuth inicial permanece a cargo de un administrador del sistema.

Perfil fiscal y onboarding se incorporaran en los siguientes cortes de la Fase 4.

## Validacion

```powershell
cd facturador-backend
npm test
npx prisma validate
```

```powershell
cd facturador-frontend
npm run build
```

No ejecutar pruebas contra ARCA, Mercado Pago o recursos Google de produccion.

## Documentacion vigente

- [`docs/ai/CONTEXT.md`](docs/ai/CONTEXT.md): arquitectura y reglas durables.
- [`docs/ai/DECISIONS.md`](docs/ai/DECISIONS.md): decisiones tecnicas.
- [`docs/ai/RUNBOOK.md`](docs/ai/RUNBOOK.md): setup, operacion y validacion.
- [`docs/ai/DOCUMENT_STATUS.md`](docs/ai/DOCUMENT_STATUS.md): precedencia documental.
