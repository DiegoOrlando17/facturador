# Estado de la documentacion historica

Ultima revision: 2026-08-26

Este inventario clasifica la documentacion anterior a `IMPLEMENTATION_PLAN.md`. No reemplaza al codigo como fuente de contratos implementados.

## Fuentes vigentes

| Documento | Uso |
| --- | --- |
| `IMPLEMENTATION_PLAN.md` | Estado, secuencia de trabajo y criterios de aceptacion vigentes. |
| `docs/ai/SCOPE.md` | Alcance funcional del producto. |
| `docs/ai/CONTEXT.md` | Resumen de arquitectura, stack y reglas durables. |
| `docs/ai/DECISIONS.md` | Decisiones tecnicas vigentes y pendientes. |
| `docs/ai/RUNBOOK.md` | Operacion y validaciones comprobadas. |
| `docs/ai/ERRORS.md` | Errores recurrentes y soluciones reutilizables. |
| `README.md` | Entrada operativa y estructura del monorepo. |

## Referencias tecnicas conservadas

Estos documentos siguen siendo utiles para entender contratos o implementaciones existentes, pero pueden estar incompletos. Antes de cambiar o consumir un endpoint, se debe validar el contrato contra las rutas, controladores y esquema actuales.

| Documento | Clasificacion |
| --- | --- |
| `facturador-backend/docs/API_ENDPOINTS.md` | Referencia general de API. |
| `facturador-backend/docs/ADMIN_MONITOR_API.md` | Referencia del contrato del panel admin. |
| `facturador-backend/docs/PORTAL_API.md` | Referencia del contrato del portal cliente. |
| `facturador-frontend/docs/API_ENDPOINTS.md` | Copia de referencia usada por el frontend; no es fuente canonica. |
| `facturador-backend/docs/OPERACION_MULTITENANT.md` | Referencia operativa; `docs/ai/RUNBOOK.md` tiene precedencia. |

## Referencias historicas

| Documento o directorio | Motivo |
| --- | --- |
| `facturador-backend/docs/ROADMAP_PRODUCCION.md` | Roadmap anterior, reemplazado por `IMPLEMENTATION_PLAN.md`. |
| `facturador-backend/docs/MULTITENANT.md` | Checklist historico, reemplazado por el plan y contexto centrales. |
| `facturador-backend/docs/DOMAIN_DECISIONS.md` | Antecedentes de dominio; las decisiones vigentes estan en `docs/ai/DECISIONS.md`. |
| `facturador-backend/docs/MONITOR_PORTAL.md` | Propuesta inicial de producto y UI; no define el alcance vigente. |
| `files for review/` | Capturas, analisis y contexto visual de referencia; no son implementacion ni criterios de aceptacion. |
| `ToDo.md` | Lista informal de incidencias; debe convertirse en tareas verificables antes de implementar. |

## Precedencia

Ante contradicciones, aplicar este orden:

1. Instruccion explicita actual del usuario.
2. `AGENTS.md` para la forma de trabajo.
3. `docs/ai/SCOPE.md` e `IMPLEMENTATION_PLAN.md` para alcance y secuencia.
4. `docs/ai/DECISIONS.md` para decisiones aprobadas.
5. Codigo y esquema actuales para contratos implementados.
6. Referencias tecnicas e historicas de este inventario.
