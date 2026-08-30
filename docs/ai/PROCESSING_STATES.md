# Estados de procesamiento

Ultima revision: 2026-08-22

## Responsabilidades

- `Payment.status` representa el procesamiento operativo del cobro externo y sus entregas.
- `Invoice.status` representa exclusivamente el ciclo fiscal del comprobante.
- Un error ARCA deja `Payment.afip_pending` para reintento e `Invoice.FAILED` con el detalle fiscal.
- `Invoice.ISSUED` es terminal: una entrega PDF, Drive o Sheets nunca vuelve a emitir en ARCA.

## Payment

| Estado | Significado | Salidas permitidas |
| --- | --- | --- |
| `pending` | Pago detectado y listo para procesar. | `processing`, `failed` |
| `processing` | Worker fiscal o postproceso activo. | `processing`, `afip_pending`, `pdf_pending`, `drive_pending`, `sheets_pending`, `complete`, `failed` |
| `afip_pending` | Emision ARCA incompleta y reintentable. | `processing`, `failed` |
| `pdf_pending` | Generacion PDF pendiente. | `drive_pending`, `sheets_pending`, `complete`, `failed` |
| `drive_pending` | Entrega Drive pendiente. | `drive_pending`, `sheets_pending`, `complete`, `failed` |
| `sheets_pending` | Registro Sheets pendiente. | `drive_pending`, `sheets_pending`, `complete`, `failed` |
| `complete` | Procesamiento requerido finalizado. | `complete` |
| `failed` | Fallo terminal que requiere intervencion. | `pending` mediante reproceso explicito |

Los auto-reintentos solo toman `afip_pending`, `pdf_pending`, `drive_pending` y `sheets_pending`. El estado `complete` puede conservarse durante una redelivery idempotente de Google.

## Invoice

| Estado | Significado | Salidas permitidas |
| --- | --- | --- |
| `DRAFT` | Borrador editable, aun no aprobado. | `PENDING_CONFIRMATION`, `QUEUED` |
| `PENDING_CONFIRMATION` | Espera aprobacion del cliente. | `DRAFT`, `QUEUED` |
| `QUEUED` | Lista para emision fiscal. | `ISSUING`, `FAILED` |
| `ISSUING` | Un worker adquirio la emision ARCA. | `ISSUED`, `FAILED` |
| `ISSUED` | ARCA autorizo y se guardaron CAE y numeracion. | Ninguna |
| `FAILED` | Emision fallida y reintentable. | `QUEUED`, `ISSUING` |

## Idempotencia y concurrencia

1. Un pago se identifica por `(tenantId, provider, provider_payment_id)`.
2. Un pago tiene como maximo una factura principal por `(paymentId, tenantId)`.
3. Adquirir `Invoice.ISSUING` compara el estado anterior; un segundo worker no puede reclamar la misma version.
4. Una factura `ISSUED` con CAE, numero y vencimiento omite ARCA y continua solo con el postproceso.
5. Drive usa una entrega unica por factura, tipo y proveedor; Sheets reutiliza `Payment.sheets_row`.
6. Los reprocesos se encolan con un `jobId` deterministico por tenant, pago y paso.
7. Toda solicitud manual de reproceso debe dejar `PaymentEvent` y `TenantAuditLog`.
8. El postproceso externo de una factura se serializa con un lock Redis por tenant y pago; una ejecucion concurrente no vuelve a escribir Drive o Sheets.

## Reproceso

- Paso `afip`: valido para `Payment.afip_pending` cuando la factura no esta emitida.
- Paso `post`: valido cuando `Invoice.ISSUED` ya tiene CAE, numero y vencimiento.
- La seleccion automatica debe basarse primero en `Invoice.status`; `Payment.status` solo indica el punto operativo observado.
- No se permite volver a emitir una factura `ISSUED`; anulaciones futuras se representan mediante una `CREDIT_NOTE` relacionada.
