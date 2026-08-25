import { PrismaClient } from "@prisma/client";
import { encryptJson } from "../utils/crypto.js";

const prisma = new PrismaClient();

async function run() {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
    if (!tenant) throw new Error("Tenant demo no existe");

    await prisma.tenantIntegration.upsert({
        where: { tenantId_provider: { tenantId: tenant.id, provider: "AFIP" } },
        update: { enabled: true, secretEnc: encryptJson({ CUIT: "20123456789", PTO_VTA: 1, CBTE_TIPO: 6, ENV: "prod" }) },
        create: { tenantId: tenant.id, provider: "AFIP", enabled: true, secretEnc: encryptJson({ CUIT: "20123456789", PTO_VTA: 1, CBTE_TIPO: 6, ENV: "prod" }) },
    });

    await prisma.tenantIntegration.upsert({
        where: { tenantId_provider: { tenantId: tenant.id, provider: "MERCADOPAGO" } },
        update: { enabled: true, secretEnc: encryptJson({ ACCESS_TOKEN: "TEST", POS_ID: "TESTPOS", POLLING_MODE: "realtime", POLLING_INTERVAL_MS: 5000 }) },
        create: { tenantId: tenant.id, provider: "MERCADOPAGO", enabled: true, secretEnc: encryptJson({ ACCESS_TOKEN: "TEST", POS_ID: "TESTPOS", POLLING_MODE: "realtime", POLLING_INTERVAL_MS: 5000 }) },
    });

    console.log("Integrations demo OK");
}

run().finally(() => prisma.$disconnect());
