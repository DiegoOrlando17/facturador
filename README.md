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

