Sistema de facturacion en ARCA (ex AFIP) para ventas hechas mediante POS de mercado pago para multiples clientes.

Modelo de suscripcion para clientes, con diferentes tiers y precios:

Tiers (cada tier incluye tambien lo de las tiers anteriores):

- Envio automatico de comprobantes a ARCA. Opcion realtime (no es extamente realtime, es cada pocos segundos, pero se ve realtime para el cliente) y opcion de cantidad de veces por dia u horarios predeterminados. Todo lo que se vende por el POS se envia a ARCA. Una vez facturados en ARCA, los comprobantes se pueden descargar en formato PDF desde el portal.

- Todo lo que se vende por POS crea un comprobante en el portal, pero no se envia hasta que no lo confirme el cliente. Puede incluir envio automatico a ARCA despues de X tiempo de creado el comprobante o a X horario. Permite que el cliente cree notas credito para ventas que por algun motivo fueron canceladas.

- Permite que el cliente genere comprobantes de manera manual para enviar a AFIP ademas de ventas recibidas por el POS de mercado pago. Desde esta tier tambien se ofrece, de manera opcional, una integracion con Google Drive y Google Sheets del cliente. El cliente puede configurar una carpeta de su Drive donde se guardan los PDF de los comprobantes ya facturados y una planilla de Google Sheets donde se registra el estado de todos los pagos procesados, tanto los facturados correctamente como los que tuvieron errores. Los reintentos actualizan la misma fila del pago.

- Permite subir comrpobantes en pdf/imagen/word/etc para que con OCR, se genere un comprobante en el portal.

Tiene un portal de administradores para alta de clientes, resolucion de problemas y administracion interna de la operatoria del sistema. Se tiene que poder resolver cualquier problema desde aca sin necesidad de revisar base de datos/codigo. Dicho portal tendra aplicacion web y aplicacion para celular (Android/iOS).

Tiene un portal de clientes para que el cliente pueda realizar las operatorias disponibles segun su tier. Dicho portal tendra aplicacion web y aplicacion para celular (Android/iOS).

Tiene una landing page que explica el alcance de la aplicacion, los diferentes tiers, y permite registrarse y setear el debito automatico para comenzar a utilizar el sistema. Tambien ofrece tutoriales con videos y explicaciones de como obtener todo lo necesario para empezar a utilizar la aplicacion.
