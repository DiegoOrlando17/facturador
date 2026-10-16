# Voz y glosario

Guía para todo texto visible: interfaz, mensajes de error del backend que llegan al usuario, emails y sitio público.

## Principios

1. **Voseo rioplatense, siempre.** Consultá, Completá, Elegí, Ingresá, ¿Confirmás?, Tenés. Nunca "Consulta / Puedes / Tienes".
2. **Tildes y eñes completas.** Facturación, sesión, contraseña, guía, último, sí. Signos de apertura: ¿…? ¡…!
3. **Hablale al comerciante, no al sistema.** Describí lo que pasa con sus ventas y comprobantes, no lo que hace el servidor.
4. **Cortito y con el siguiente paso.** Todo error dice qué pasó y qué hacer: "No pudimos conectar con ARCA. Reintentá en unos minutos o revisá el certificado."
5. **Nada de enums, IDs internos ni nombres de campo.** Nunca `PAST_DUE`, `afip pending`, `POLLING_INTERVAL_MS`, "Pago 1234567890".
6. **Cálido en los momentos buenos, sobrio en los problemas.** Éxito: "Listo, ya está facturado." Problema: "3 ventas necesitan revisión."

## Glosario

| Usar | No usar | Nota |
|---|---|---|
| empresa / cliente (admin) | tenant | En el admin, "cliente" es la empresa que contrata el servicio. |
| identificador de empresa | slug | Con ayuda: "Lo vas a usar para ingresar". |
| contraseña | password, contrasena | |
| ventas | pagos (en el portal) | Del lado del comerciante son ventas cobradas con Mercado Pago. En el admin se puede decir "pago". |
| factura, nota de crédito, comprobante | invoice, NC (salvo en tablas angostas) | "Comprobante" como genérico. |
| ARCA | AFIP | AFIP solo para explicar el cambio de nombre. |
| lectura automática / revisar ventas cada X minutos | polling, realtime, ms | Intervalos en segundos o minutos. |
| conectar tu cuenta de Google | OAuth, refresh token | |
| planilla | spreadsheet | |
| puesta en marcha | onboarding | |
| plan Profesional (nombre comercial) | tier 3, TIER_3 | |
| equipo / usuarios de tu empresa | owner, admin, approver, viewer | Roles: Dueño, Administrador, Aprobador, Solo lectura. |
| emitida, pendiente de confirmar, programada, con error, anulada | ISSUED, PENDING_CONFIRMATION, QUEUED, FAILED | Etiquetas centralizadas en `src/lib/statusLabels.ts`. |
| suscripción al día / pago pendiente / pausada / cancelada | ACTIVE, PAST_DUE, paused, CANCELED | |

## Estados y tono visual

| Tono | Cuándo | Ejemplos |
|---|---|---|
| éxito (verde) | Terminó bien, no requiere nada | Emitida, Conectado, Al día |
| atención (ámbar) | Requiere una acción del usuario pronto | Pendiente de confirmar, Falta configurar |
| error (rojo) | Algo falló y bloquea | Con error, Rechazado, Pago vencido |
| informativo (azul) | En curso, sin acción requerida | Procesando, Programada |
| neutro (gris) | Inactivo o sin datos | Sin configurar, Pausada |

## Fórmulas recurrentes

- Carga: "Cargando ventas…" (nombrar qué se carga).
- Vacío: qué falta + siguiente paso. "Todavía no hay ventas. Cuando Mercado Pago registre la primera, la vas a ver acá."
- Error de red: "No pudimos cargar los datos. Reintentá."
- Sesión vencida: "Tu sesión venció. Ingresá de nuevo."
- Sin permiso: "Tu usuario no puede hacer esto. Pedile acceso a un administrador de tu empresa."
- Sin plan: "Disponible en el plan Profesional." + enlace a Plan y suscripción.
- Confirmación irreversible: decir la consecuencia. "Se va a emitir la factura en ARCA. No se puede deshacer; para anularla vas a tener que emitir una nota de crédito."
