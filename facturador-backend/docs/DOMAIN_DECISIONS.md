# Decisiones de dominio

## Perfil fiscal y datos del cliente

Fecha: 2026-05-24

Decision: crear una entidad `TenantProfile` separada de `Tenant`.

Motivo:

- `Tenant` queda como identidad tecnica/multitenant: nombre, slug, estado.
- `TenantProfile` agrupa datos fiscales, comerciales y de contacto.
- El perfil sera usado por admin, portal cliente, onboarding y facturacion.
- Permite medir completitud y aprobacion sin cargar de responsabilidades al modelo base.

Campos iniciales:

- razon social (`legalName`);
- nombre comercial (`tradeName`);
- CUIT (`cuit`);
- condicion IVA (`ivaCondition`);
- domicilio fiscal (`fiscalAddress`);
- email de contacto (`contactEmail`);
- telefono de contacto (`contactPhone`);
- responsable (`responsibleName`);
- email del responsable (`responsibleEmail`).

Actualizacion 2026-05-25:

- Se agrego estado de aprobacion (`approvalStatus`): `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`.
- Al guardar datos completos, el perfil queda `PENDING`.
- Al editar un perfil aprobado o rechazado, vuelve a requerir revision.
- La aprobacion registra admin revisor, fecha y notas.

Pendiente futuro:

- historial de cambios;
- validaciones especificas de CUIT/IVA;
- documentos adjuntos.
