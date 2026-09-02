# Contrato de seguridad y permisos

Ultima revision: 2026-08-22

## Principios

1. Autenticacion y autorizacion son controles separados.
2. El backend decide permisos; ocultar controles en UI no concede ni revoca acceso.
3. El rol vigente se lee de base de datos en cada request autenticado, no del rol incluido en el token.
4. Todo acceso tenant usa el `tenantId` del usuario cargado desde base de datos.
5. `passwordHash` y secretos cifrados no forman parte de respuestas API.
6. Los secretos se muestran enmascarados por defecto; solo `SUPERADMIN` puede solicitar revelarlos.

## Administradores

| Capacidad | SUPERADMIN | OPERATOR | VIEWER |
| --- | --- | --- | --- |
| Dashboard, tenants, pagos, reportes y PDF | Si | Si | Si |
| Reprocesar y entregar a Google | Si | Si | No |
| Crear/editar tenants, perfiles, integraciones y usuarios tenant | Si | Si | No |
| Revisar onboarding y perfiles | Si | Si | No |
| Administrar suscripciones | Si | No | No |
| Administrar planes y admins | Si | No | No |
| Eliminar tenants | Si | No | No |
| Revelar secretos | Si | No | No |

Todos los roles admin pueden consultar el historial de auditoria. Los campos con nombres asociados a tokens, secretos, claves, passwords o certificados se reemplazan por `[REDACTED]` antes de responder.

## Portal tenant

| Capacidad vigente | owner | admin | approver | viewer |
| --- | --- | --- | --- | --- |
| Dashboard, pagos, reportes, PDF e integraciones enmascaradas | Si | Si | Si | Si |
| Probar integraciones | Si | Si | No | No |
| Configurar destinos Drive/Sheets sin modificar credenciales OAuth | Si | Si | No | No |
| Editar perfil fiscal y enviarlo nuevamente a revision | Si | Si | No | No |
| Confirmar o programar comprobantes pendientes | Si | Si | Si | No |
| Crear facturas manuales y solicitar notas de credito | Si | Si | No | No |
| Enviar onboarding | Si | Si | No | No |

`approver` puede leer y confirmar comprobantes pendientes mediante la capacidad especifica `tenant.confirmInvoices`; no hereda permisos para crear facturas manuales, configurar el tenant ni solicitar notas de credito.

## Sesiones

- Tokens admin y tenant tienen firma HMAC y expiracion configurable.
- Logout sigue siendo logico: no existe revocacion server-side ni refresh token.
- Deshabilitar el usuario o tenant invalida efectivamente la siguiente request autenticada porque el middleware consulta la base.
- Cada administrador puede cambiar su password validando el actual; `SUPERADMIN` puede restablecer el de otros administradores sin conocerlo.
- Un superadmin no puede deshabilitarse ni quitarse su propio rol, y el sistema conserva al menos un `SUPERADMIN` activo.
- Revocacion explicita de sesiones, rotacion de secretos y rate limiting permanecen pendientes de la fase de seguridad operativa. Cambiar una password no revoca tokens ya emitidos antes de su expiracion.
