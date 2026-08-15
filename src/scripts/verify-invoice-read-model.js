import { buildPaymentsCsv } from "../services/csvExport.service.js";
import { db } from "../models/db.js";
import {
  getAdminPaymentDetail,
  listAdminPayments,
} from "../services/adminMonitor.service.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const result = await listAdminPayments({ page: 1, pageSize: 5 });
  assert(result.items.length > 0, "No hay pagos para validar");

  const payment = result.items.find((item) => item.invoice?.status === "ISSUED");
  assert(payment, "No hay una factura emitida para validar");
  assert(payment.cae === payment.invoice.cae, "CAE no proviene de Invoice");
  assert(payment.cbte_nro === payment.invoice.cbteNro, "Numero de comprobante no proviene de Invoice");
  assert(payment.cae_vto === payment.invoice.caeVto, "Vencimiento CAE no proviene de Invoice");

  const detail = await getAdminPaymentDetail(payment.id, payment.tenantId);
  assert(detail?.invoice, "El detalle no incluye Invoice");
  assert(Array.isArray(detail.invoice.events), "El detalle no incluye InvoiceEvent");
  assert(Array.isArray(detail.invoice.documents), "El detalle no incluye InvoiceDocument");
  assert(detail.cbte_nro === detail.invoice.cbteNro, "El detalle no prioriza Invoice");

  const crossTenant = await getAdminPaymentDetail(payment.id, 0n);
  assert(crossTenant === null, "El detalle no respeta el aislamiento por tenant");

  const csv = buildPaymentsCsv([payment], { includeTenant: true });
  assert(csv.includes("cbte_nro"), "El CSV no contiene la columna fiscal");
  assert(csv.includes(String(payment.invoice.cbteNro)), "El CSV no usa el numero de Invoice");

  console.log(JSON.stringify({
    valid: true,
    checkedPaymentId: payment.id.toString(),
    checkedInvoiceId: payment.invoice.id.toString(),
    listItems: result.items.length,
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
