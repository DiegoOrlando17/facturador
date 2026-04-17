import { PrismaClient } from "@prisma/client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const prisma = new PrismaClient();

function normalizeBigInt(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} vacio`);
  }

  try {
    return BigInt(value);
  } catch {
    throw new Error(`${fieldName} invalido: ${value}`);
  }
}

function normalizeTimestamp(value) {
  if (!value) {
    throw new Error("from-timestamp vacio");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`from-timestamp invalido: ${value}`);
  }

  return date.toISOString();
}

function shouldDeletePayment(payment, fromTimestamp, fromPaymentId) {
  if (!payment.date_approved) {
    return false;
  }

  const paymentTimestamp = payment.date_approved.toISOString();
  const providerPaymentId = normalizeBigInt(payment.provider_payment_id, "provider_payment_id");

  if (paymentTimestamp > fromTimestamp) return true;
  if (paymentTimestamp === fromTimestamp && providerPaymentId > fromPaymentId) return true;
  return false;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("tenant-slug", {
      type: "string",
      demandOption: true,
      describe: "Slug del tenant a limpiar",
    })
    .option("from-timestamp", {
      type: "string",
      demandOption: true,
      describe: "Fecha/hora ISO del ultimo pago que queres conservar como procesado",
    })
    .option("from-payment-id", {
      type: "string",
      demandOption: true,
      describe: "ID del ultimo pago que queres conservar como procesado",
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Solo muestra que borraria y que checkpoint dejaria, sin aplicar cambios",
    })
    .strict()
    .parseAsync();

  const tenantSlug = argv["tenant-slug"];
  const fromTimestamp = normalizeTimestamp(argv["from-timestamp"]);
  const fromPaymentId = normalizeBigInt(argv["from-payment-id"], "from-payment-id");

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant no encontrado: ${tenantSlug}`);
  }

  const candidatePayments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      provider: "mercadopago",
      date_approved: {
        gte: new Date(fromTimestamp),
      },
    },
    select: {
      id: true,
      provider_payment_id: true,
      date_approved: true,
      status: true,
    },
    orderBy: [
      { date_approved: "asc" },
      { provider_payment_id: "asc" },
    ],
  });

  const paymentsToDelete = candidatePayments.filter((payment) =>
    shouldDeletePayment(payment, fromTimestamp, fromPaymentId)
  );

  const paymentIdsToDelete = paymentsToDelete.map((payment) => payment.id);

  const preview = paymentsToDelete.slice(0, 20).map((payment) => ({
    id: payment.id.toString(),
    provider_payment_id: payment.provider_payment_id,
    date_approved: payment.date_approved?.toISOString() ?? null,
    status: payment.status,
  }));

  console.log("Reset MP checkpoint", {
    tenantSlug: tenant.slug,
    tenantId: tenant.id.toString(),
    fromTimestamp,
    fromPaymentId: fromPaymentId.toString(),
    dryRun: argv["dry-run"],
    deleteCount: paymentsToDelete.length,
    preview,
  });

  if (argv["dry-run"]) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (paymentIdsToDelete.length > 0) {
      await tx.payment.deleteMany({
        where: {
          tenantId: tenant.id,
          id: {
            in: paymentIdsToDelete,
          },
        },
      });
    }

    await tx.integrationCheckpoint.upsert({
      where: {
        tenantId_provider: {
          tenantId: tenant.id,
          provider: "MERCADOPAGO",
        },
      },
      update: {
        valueJson: JSON.stringify({
          timestamp: fromTimestamp,
          lastPaymentId: fromPaymentId.toString(),
        }),
      },
      create: {
        tenantId: tenant.id,
        provider: "MERCADOPAGO",
        valueJson: JSON.stringify({
          timestamp: fromTimestamp,
          lastPaymentId: fromPaymentId.toString(),
        }),
      },
    });
  });

  console.log("Reset MP aplicado", {
    tenantSlug: tenant.slug,
    tenantId: tenant.id.toString(),
    deletedPayments: paymentIdsToDelete.length,
    checkpoint: {
      timestamp: fromTimestamp,
      lastPaymentId: fromPaymentId.toString(),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
