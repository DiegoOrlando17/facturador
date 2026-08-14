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
      (
        SELECT COUNT(*)
        FROM "Payment"
        WHERE "cae" IS NOT NULL AND "cbte_nro" IS NOT NULL
      )::int AS "paymentsWithCae",
      (SELECT COUNT(*) FROM "Invoice" WHERE "status" = 'ISSUED')::int AS "issuedInvoices"
  `);

  const errors = [];
  if (result.payments !== result.linkedInvoices) errors.push("No todos los pagos tienen una factura vinculada");
  if (result.duplicateGroups !== 0) errors.push("Hay pagos con mas de una factura principal");
  if (result.issuedWithoutCae !== 0) errors.push("Hay facturas ISSUED sin CAE o numero de comprobante");
  if (result.paymentsWithCae !== result.issuedInvoices) errors.push("El total emitido no coincide con los pagos que tienen CAE");

  console.log(JSON.stringify({ ...result, valid: errors.length === 0, errors }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
