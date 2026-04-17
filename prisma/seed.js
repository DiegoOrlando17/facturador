import { PrismaClient } from "@prisma/client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const prisma = new PrismaClient();

function normalizeBigInt(value, fieldName) {
    if (value === undefined || value === null || value === "") return null;

    try {
        return BigInt(value);
    } catch {
        throw new Error(`${fieldName} invalido: ${value}`);
    }
}

async function seedMercadoPagoCheckpoint(argv) {

    const tenantSlug = argv["mp-tenant-slug"] || process.env.SEED_MP_TENANT_SLUG;
    const checkpointTimestamp = argv["mp-checkpoint-timestamp"] || process.env.SEED_MP_CHECKPOINT_TIMESTAMP;
    const checkpointPaymentIdRaw = argv["mp-checkpoint-payment-id"] || process.env.SEED_MP_CHECKPOINT_PAYMENT_ID;

    console.log("Sembrando checkpoint MP...", {
        tenantSlug,
        checkpointTimestamp,
        checkpointPaymentIdRaw,
    });

    const providedValues = [tenantSlug, checkpointTimestamp, checkpointPaymentIdRaw].filter(Boolean).length;
    if (providedValues === 0) return;

    if (providedValues !== 3) {
        throw new Error("Para sembrar el checkpoint de Mercado Pago tenes que indicar tenant slug, checkpoint timestamp y checkpoint payment id.");
    }

    const checkpointPaymentId = String(normalizeBigInt(checkpointPaymentIdRaw, "mp-checkpoint-payment-id"));

    const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
    });

    if (!tenant) {
        throw new Error(`Tenant no encontrado para checkpoint MP: ${tenantSlug}`);
    }

    try {
        await prisma.integrationCheckpoint.upsert({
            where: {
                tenantId_provider: {
                    tenantId: tenant.id,
                    provider: "MERCADOPAGO",
                },
            },
            update: {
                valueJson: JSON.stringify({
                    timestamp: checkpointTimestamp,
                    lastPaymentId: checkpointPaymentId,
                }),
            },
            create: {
                tenantId: tenant.id,
                provider: "MERCADOPAGO",
                valueJson: JSON.stringify({
                    timestamp: checkpointTimestamp,
                    lastPaymentId: checkpointPaymentId,
                }),
            },
        });
    } catch (e) {
        console.error("Error sembrando checkpoint MP", e);
        throw new Error("Error sembrando checkpoint MP: " + e.message);
    }

    console.log("Seed MP checkpoint OK", {
        tenantSlug,
        timestamp: checkpointTimestamp,
        lastPaymentId: checkpointPaymentId,
    });
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("mp-tenant-slug", {
            type: "string",
            describe: "Slug del tenant al que se le va a sembrar el checkpoint de Mercado Pago",
        })
        .option("mp-checkpoint-timestamp", {
            type: "string",
            describe: "Fecha/hora ISO del ultimo pago que queres dejar como procesado",
        })
        .option("mp-checkpoint-payment-id", {
            type: "string",
            describe: "ID del ultimo pago que queres dejar como procesado",
        })
        .strict()
        .parseAsync();
        
    // Plans
    const planA = await prisma.plan.upsert({
        where: { code: "A" },
        update: {},
        create: { code: "A", name: "Realtime MP → AFIP" },
    });

    await prisma.plan.upsert({
        where: { code: "B" },
        update: {},
        create: { code: "B", name: "Realtime + Monitor" },
    });

    // Tenant demo
    const tenant = await prisma.tenant.upsert({
        where: { slug: "demo" },
        update: {},
        create: { slug: "demo", name: "Cliente Demo" },
    });

    // Subscription
    const subExists = await prisma.subscription.findFirst({
        where: { tenantId: tenant.id },
    });

    if (!subExists) {
        await prisma.subscription.create({
            data: {
                tenantId: tenant.id,
                planId: planA.id,
                status: "ACTIVE",
            },
        });
    }

    await seedMercadoPagoCheckpoint(argv);

    console.log("Seed OK", { tenantId: tenant.id.toString() });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
