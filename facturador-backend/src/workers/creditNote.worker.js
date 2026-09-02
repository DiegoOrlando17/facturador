import { Worker } from "bullmq";
import { connection } from "../config/redis.js";
import { getCreditNoteType, parseIssuedInvoiceNumber } from "../domain/creditNote.js";
import { getInvoiceById, markInvoiceFailed, markInvoiceIssued, markInvoiceIssuing } from "../models/Invoice.js";
import { getNextCbteNro, setLastCbteNro } from "../models/InvoiceSequence.js";
import { createInvoiceAFIP } from "../services/afip.service.js";
import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { toBigIntId } from "../utils/bigint.js";
import logger from "../utils/logger.js";

const worker = new Worker("credit-notes", async (job) => {
  const tenantId = toBigIntId(job.data.tenantId, "tenantId");
  const invoiceId = toBigIntId(job.data.invoiceId, "invoiceId");
  let creditNote = await getInvoiceById(tenantId, invoiceId, { includeRelated: true });
  if (!creditNote || creditNote.type !== "CREDIT_NOTE") throw new Error("Nota de credito no encontrada");
  if (creditNote.status === "ISSUED" && creditNote.cae) return;
  if (!creditNote.relatedInvoice) throw new Error("Factura original no encontrada");

  try {
    if (creditNote.status !== "ISSUING") {
      await markInvoiceIssuing(tenantId, creditNote.id, creditNote.status);
    }
    const originalNumber = parseIssuedInvoiceNumber(creditNote.relatedInvoice.cbteNro);
    const cbteTipo = getCreditNoteType(creditNote.relatedInvoice.cbteTipo);
    const afipCfg = await getTenantIntegrationConfig(tenantId, "AFIP");
    const ptoVta = Number(afipCfg.PTO_VTA);
    if (!ptoVta) throw new Error("AFIP config incompleta (PTO_VTA)");

    const seq = await getNextCbteNro(tenantId, ptoVta, cbteTipo, { ...afipCfg, CBTE_TIPO: cbteTipo });
    if (!seq) throw new Error("No se pudo obtener el ultimo numero de nota de credito");
    const response = await createInvoiceAFIP(seq.next, creditNote.amount, { ...afipCfg, CBTE_TIPO: cbteTipo }, {
      associatedInvoice: {
        cbteTipo: creditNote.relatedInvoice.cbteTipo,
        ptoVta: originalNumber.ptoVta,
        cbteNro: originalNumber.number,
      },
    });
    if (response.error) throw new Error(String(response.error));

    creditNote = await markInvoiceIssued(tenantId, creditNote.id, {
      cae: response.cae,
      caeVto: response.fechaVtoCae,
      cbteNro: response.nroComprobante,
      cbteTipo,
      ptoVta,
    });
    await setLastCbteNro(seq.id, seq.next);
    return { invoiceId: String(creditNote.id), status: creditNote.status };
  } catch (error) {
    const current = await getInvoiceById(tenantId, invoiceId);
    if (current && current.status !== "ISSUED" && current.status !== "FAILED") {
      await markInvoiceFailed(tenantId, invoiceId, error.message || String(error), { source: "credit_note_worker" });
    }
    throw error;
  }
}, {
  concurrency: 1,
  connection,
  lockDuration: 30000,
  stalledInterval: 60000,
  lockRenewTime: 15000,
});

worker.on("ready", () => logger.info("Worker de notas de credito listo"));
worker.on("error", (error) => logger.error(`Error en worker de notas de credito: ${error}`));
worker.on("failed", (job, error) => logger.error(`Nota de credito ${job?.id} fallo: ${error}`));
