import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  const [result] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM "Payment")::int AS "payments",
      (SELECT COUNT(*) FROM "Invoice" WHERE "paymentId" IS NOT NULL)::int AS "linkedInvoices",
      (
        SELECT COUNT(*)
        FROM (
          SELECT "paymentId", "tenantId"
          FROM "Invoice"
          WHERE "paymentId" IS NOT NULL
          GROUP BY "paymentId", "tenantId"
          HAVING COUNT(*) > 1
        ) duplicates
      )::int AS "duplicateGroups",
      (
        SELECT COUNT(*)
        FROM "Invoice"
        WHERE "status" = 'ISSUED' AND ("cae" IS NULL OR "cbteNro" IS NULL)
      )::int AS "issuedWithoutCae",
      (SELECT COUNT(*) FROM "Invoice")::int AS "invoices",
      (SELECT COUNT(*) FROM "Invoice" WHERE "status" = 'ISSUED')::int AS "issuedInvoices",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Payment'
          AND column_name IN ('cae', 'cae_vto', 'cbte_nro', 'cbte_tipo', 'pto_vta', 'pdf_path', 'drive_file_link')
      )::int AS "remainingPaymentFiscalColumns"
  `);

  const errors = [];
  if (result.payments !== result.linkedInvoices) errors.push("No todos los pagos tienen una factura vinculada");
  if (result.duplicateGroups !== 0) errors.push("Hay pagos con mas de una factura principal");
  if (result.issuedWithoutCae !== 0) errors.push("Hay facturas ISSUED sin CAE o numero de comprobante");
  if (result.payments !== result.invoices) errors.push("El total de pagos no coincide con el total de facturas migradas");
  if (result.remainingPaymentFiscalColumns !== 0) errors.push("Payment todavia conserva columnas fiscales heredadas");

  console.log(JSON.stringify({ ...result, valid: errors.length === 0, errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
