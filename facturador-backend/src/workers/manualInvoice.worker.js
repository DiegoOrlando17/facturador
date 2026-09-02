import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { getInvoiceById, markInvoiceFailed, markInvoiceIssued, markInvoiceIssuing } from "../models/Invoice.js";
import { getNextCbteNro, setLastCbteNro } from "../models/InvoiceSequence.js";
import { createInvoiceAFIP } from "../services/afip.service.js";
import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { toBigIntId } from "../utils/bigint.js";
import logger from "../utils/logger.js";

const worker = new Worker("manual-invoices", async (job) => {
  const tenantId = toBigIntId(job.data.tenantId, "tenantId");
  const invoiceId = toBigIntId(job.data.invoiceId, "invoiceId");
  let invoice = await getInvoiceById(tenantId, invoiceId);
  if (!invoice || invoice.type !== "INVOICE" || invoice.paymentId) throw new Error("Factura manual no encontrada");
  if (invoice.status === "ISSUED" && invoice.cae) return;
  try {
    if (invoice.status !== "ISSUING") await markInvoiceIssuing(tenantId, invoice.id, invoice.status);
    const afipCfg = await getTenantIntegrationConfig(tenantId, "AFIP");
    const ptoVta = Number(afipCfg.PTO_VTA); const cbteTipo = Number(afipCfg.CBTE_TIPO);
    if (!ptoVta || !cbteTipo) throw new Error("AFIP config incompleta (PTO_VTA/CBTE_TIPO)");
    const seq = await getNextCbteNro(tenantId, ptoVta, cbteTipo, afipCfg);
    if (!seq) throw new Error("No se pudo obtener el ultimo comprobante");
    const response = await createInvoiceAFIP(seq.next, invoice.amount, afipCfg);
    if (response.error) throw new Error(String(response.error));
    invoice = await markInvoiceIssued(tenantId, invoice.id, { cae: response.cae, caeVto: response.fechaVtoCae, cbteNro: response.nroComprobante, cbteTipo, ptoVta });
    await setLastCbteNro(seq.id, seq.next);
    return { invoiceId: String(invoice.id), status: invoice.status };
  } catch (error) {
    const current = await getInvoiceById(tenantId, invoiceId);
    if (current && current.status !== "ISSUED" && current.status !== "FAILED") await markInvoiceFailed(tenantId, invoiceId, error.message || String(error), { source: "manual_invoice_worker" });
    throw error;
  }
}, { concurrency: 1, connection, lockDuration: 30000, stalledInterval: 60000, lockRenewTime: 15000 });
worker.on("ready", () => logger.info("Worker de facturas manuales listo"));
worker.on("error", (error) => logger.error(`Error en worker manual: ${error}`));
