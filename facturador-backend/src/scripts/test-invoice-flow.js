import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { config } from "../config/index.js";
import { db } from "../models/db.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";
import { normalizeAfipConfig } from "../services/afip.service.js";
import { generateInvoicePdfForPayment } from "../services/invoicePdf.service.js";
import { getTenantIntegrationConfig } from "../services/tenantConfig.service.js";
import { logPaymentEvent } from "../services/paymentEvent.service.js";

const POLL_INTERVAL_MS = 2000;

function parseBoolean(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function assertLocalDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!localHosts.has(databaseUrl.hostname)) {
    throw new Error("invoice:test-flow solo puede ejecutarse contra PostgreSQL local");
  }
}

function assertHomologation(afipConfig) {
  const normalized = normalizeAfipConfig(afipConfig);
  const environment = String(afipConfig.ENV || "").trim().toLowerCase();
  const urls = [normalized.WSAA_URL, normalized.WSFE_URL].filter(Boolean).map(String);

  if (parseBoolean(config.AFIP.PRODUCTION)) {
    throw new Error("AFIP_PRODUCTION debe ser false para ejecutar invoice:test-flow");
  }
  if (["prod", "production", "produccion"].includes(environment)) {
    throw new Error("La integracion AFIP del tenant esta marcada como produccion");
  }
  if (urls.length !== 2 || urls.some((url) => !/homo|test/i.test(url))) {
    throw new Error("Las URLs WSAA/WSFE no parecen corresponder a homologacion");
  }

  return normalized;
}

async function enqueuePayment(tenantId, paymentId, runId, step) {
  await paymentsQueue.add(`invoice-test-${runId}-${step}`, {
    tenantId: toQueueId(tenantId),
    paymentId: toQueueId(paymentId),
  }, {
    jobId: buildQueueJobId({ tenantId, paymentId, step: `invoice-test-${runId}-${step}` }),
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: true,
    removeOnFail: 50,
  });
}

async function getFlowState(tenantId, paymentId) {
  return db.payment.findUnique({
    where: { id_tenantId: { id: paymentId, tenantId } },
    include: {
      events: { orderBy: [{ createdAt: "asc" }] },
      invoice: {
        include: {
          events: { orderBy: [{ createdAt: "asc" }] },
          documents: { orderBy: [{ createdAt: "asc" }] },
        },
      },
    },
  });
}

async function waitForCompletion(tenantId, paymentId, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastState = "";

  while (Date.now() < deadline) {
    const payment = await getFlowState(tenantId, paymentId);
    const currentState = `${payment?.status || "missing"}/${payment?.invoice?.status || "missing"}`;
    if (currentState !== lastState) {
      console.log(`[${label}] ${currentState}`);
      lastState = currentState;
    }

    if (payment?.status === "complete" && payment.invoice?.status === "ISSUED") {
      return payment;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const payment = await getFlowState(tenantId, paymentId);
  throw new Error(
    `${label} no completo dentro del timeout: Payment=${payment?.status || "missing"}, Invoice=${payment?.invoice?.status || "missing"}, error=${payment?.error || payment?.invoice?.error || "sin detalle"}`
  );
}

function validateCompletedFlow(payment, { requireDrive, requireSheets }) {
  if (!payment.invoice) throw new Error("No se creo Invoice");
  if (!payment.invoice.cae || !payment.invoice.cbteNro || !payment.invoice.caeVto) {
    throw new Error("Invoice ISSUED no tiene datos fiscales completos");
  }
  const driveDocuments = payment.invoice.documents.filter((document) => (
    document.type === "PDF"
    && document.storageProvider === "GOOGLE_DRIVE"
    && document.status === "AVAILABLE"
  ));
  if (requireDrive && driveDocuments.length !== 1) {
    throw new Error(`Se esperaba un documento Drive y se encontraron ${driveDocuments.length}`);
  }
  if (requireSheets && !payment.sheets_row) {
    throw new Error("Sheets era obligatorio pero el pago no tiene sheets_row");
  }

  return driveDocuments;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("tenant", {
      type: "string",
      demandOption: true,
      describe: "Slug del tenant de prueba",
    })
    .option("amount", {
      type: "number",
      default: 100,
      describe: "Importe del pago sintetico en ARS",
    })
    .option("timeout-seconds", {
      type: "number",
      default: 180,
      describe: "Tiempo maximo por pasada",
    })
    .option("require-drive", {
      type: "boolean",
      default: false,
      describe: "Falla si no se registra exactamente un PDF en Drive",
    })
    .option("require-sheets", {
      type: "boolean",
      default: false,
      describe: "Falla si no se registra una fila en Sheets",
    })
    .option("verify-idempotency", {
      type: "boolean",
      default: true,
      describe: "Reencola el mismo pago y comprueba que no se vuelva a emitir",
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Valida tenant, base local y homologacion sin crear ni encolar el pago",
    })
    .strict()
    .parseAsync();

  assertLocalDatabase();
  if (!Number.isFinite(argv.amount) || argv.amount <= 0) throw new Error("amount debe ser mayor que cero");
  if (!Number.isFinite(argv.timeoutSeconds) || argv.timeoutSeconds < 30) {
    throw new Error("timeout-seconds debe ser al menos 30");
  }

  const tenant = await db.tenant.findUnique({
    where: { slug: argv.tenant.trim().toLowerCase() },
    select: { id: true, slug: true, name: true, status: true },
  });
  if (!tenant || tenant.status !== "ACTIVE") throw new Error("Tenant inexistente o inactivo");

  const afipConfig = await getTenantIntegrationConfig(tenant.id, "AFIP");
  const normalizedAfip = assertHomologation(afipConfig);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const providerPaymentId = `99${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  const timeoutMs = argv.timeoutSeconds * 1000;

  if (argv.dryRun) {
    console.log(JSON.stringify({
      valid: true,
      dryRun: true,
      tenant: tenant.slug,
      database: "local",
      afip: {
        environment: "homologation",
        ptoVta: normalizedAfip.PTO_VTA,
        cbteTipo: normalizedAfip.CBTE_TIPO,
      },
    }, null, 2));
    return;
  }

  const payment = await db.payment.create({
    data: {
      tenantId: tenant.id,
      provider: "mercadopago",
      provider_payment_id: providerPaymentId,
      status: "pending",
      payment_method_id: "test_flow",
      amount: argv.amount,
      currency: "ARS",
      customer: "invoice-flow@test.local",
      customer_doc_type: "OTRO",
      customer_doc_number: runId.replace(/\D/g, "").slice(-8) || "0",
      date_approved: new Date(),
    },
  });

  await logPaymentEvent(tenant.id, payment.id, "payment_detected", "Pago sintetico creado por invoice:test-flow", {
    runId,
    homologation: true,
  });

  console.log(JSON.stringify({
    runId,
    tenant: tenant.slug,
    paymentId: payment.id.toString(),
    providerPaymentId,
    amount: argv.amount,
    afip: {
      environment: "homologation",
      ptoVta: normalizedAfip.PTO_VTA,
      cbteTipo: normalizedAfip.CBTE_TIPO,
    },
  }, null, 2));

  await enqueuePayment(tenant.id, payment.id, runId, "initial");
  let completed = await waitForCompletion(tenant.id, payment.id, timeoutMs, "initial");
  const initialDocuments = validateCompletedFlow(completed, argv);
  const initialInvoiceId = completed.invoice.id;
  const initialCae = completed.invoice.cae;
  const initialCbteNro = completed.invoice.cbteNro;
  const initialDriveCount = initialDocuments.length;

  const { pdfBuffer } = await generateInvoicePdfForPayment(tenant.id, payment.id);
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("No se pudo generar el PDF desde Invoice");
  }

  if (argv.verifyIdempotency) {
    await db.payment.update({
      where: { id_tenantId: { id: payment.id, tenantId: tenant.id } },
      data: {
        status: "afip_pending",
        error: null,
      },
    });
    await logPaymentEvent(tenant.id, payment.id, "retried", "Reproceso sintetico para validar idempotencia", { runId });
    await enqueuePayment(tenant.id, payment.id, runId, "idempotency");
    completed = await waitForCompletion(tenant.id, payment.id, timeoutMs, "idempotency");
    const replayDocuments = validateCompletedFlow(completed, argv);
    const invoiceCount = await db.invoice.count({
      where: { tenantId: tenant.id, paymentId: payment.id },
    });

    if (invoiceCount !== 1) throw new Error(`Se encontraron ${invoiceCount} facturas para el mismo pago`);
    if (completed.invoice.id !== initialInvoiceId) throw new Error("El reproceso creo otra Invoice");
    if (completed.invoice.cae !== initialCae || completed.invoice.cbteNro !== initialCbteNro) {
      throw new Error("El reproceso modifico el comprobante fiscal emitido");
    }
    if (replayDocuments.length !== initialDriveCount) {
      throw new Error("El reproceso duplico documentos Drive");
    }
  }

  console.log(JSON.stringify({
    valid: true,
    paymentId: payment.id.toString(),
    invoiceId: completed.invoice.id.toString(),
    status: completed.status,
    invoiceStatus: completed.invoice.status,
    cbteNro: completed.invoice.cbteNro,
    cae: completed.invoice.cae,
    pdfBytes: pdfBuffer.length,
    driveDocuments: completed.invoice.documents.filter((document) => document.storageProvider === "GOOGLE_DRIVE").length,
    sheetsRow: completed.sheets_row,
    idempotencyVerified: argv.verifyIdempotency,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await paymentsQueue.close();
    await db.$disconnect();
  });
