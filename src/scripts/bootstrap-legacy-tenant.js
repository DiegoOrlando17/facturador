import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { config } from "../config/index.js";
import { encryptJson } from "../utils/crypto.js";

const prisma = new PrismaClient();

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, current]) =>
      current !== undefined &&
      current !== null &&
      current !== ""
    )
  );
}

function readGoogleTokenFile() {
  if (!config.GOOGLE.TOKEN) return null;

  const tokenPath = path.isAbsolute(config.GOOGLE.TOKEN)
    ? config.GOOGLE.TOKEN
    : path.resolve(process.cwd(), config.GOOGLE.TOKEN);

  if (!fs.existsSync(tokenPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function buildTenantIntegrationsFromEnv() {
  const integrations = [];

  const mpConfig = compactObject({
    ACCESS_TOKEN: config.MP.ACCESS_TOKEN,
    POS_ID: config.MP.POS_ID,
    API_URL: config.MP.API_URL,
    POLLING_MODE: "realtime",
    POLLING_INTERVAL_MS: config.MP.POLLING_INTERVAL ? Number(config.MP.POLLING_INTERVAL) : undefined,
  });
  if (mpConfig.ACCESS_TOKEN && mpConfig.POS_ID) {
    integrations.push({ provider: "MERCADOPAGO", config: mpConfig });
  }

  const afipConfig = compactObject({
    CUIT: String(config.CUIT || "").replace(/\D/g, ""),
    PTO_VTA: config.AFIP.PTO_VTA,
    CBTE_TIPO: config.AFIP.CBTE_TIPO,
    ALIC_IVA: config.AFIP.ALIC_IVA,
    WSAA_URL: config.AFIP.WSAA_URL,
    WSFE_URL: config.AFIP.WSFE_URL,
    CERT_PATH: config.AFIP.CERT,
    KEY_PATH: config.AFIP.KEY,
    CERT_B64: config.AFIP.CERT_B64,
    KEY_B64: config.AFIP.KEY_B64,
  });
  if (afipConfig.CUIT && afipConfig.PTO_VTA && afipConfig.CBTE_TIPO) {
    integrations.push({ provider: "AFIP", config: afipConfig });
  }

  const googleToken = readGoogleTokenFile();
  const googleShared = compactObject({
    CLIENT_ID: config.GOOGLE.CLIENT_ID,
    CLIENT_SECRET: config.GOOGLE.CLIENT_SECRET,
    REFRESH_TOKEN: googleToken?.refresh_token,
    SCOPES: typeof googleToken?.scope === "string"
      ? googleToken.scope.split(" ").filter(Boolean)
      : undefined,
    TOKEN_TYPE: googleToken?.token_type,
  });

  const driveConfig = compactObject({
    ...googleShared,
    DRIVE_FOLDER_ID: config.GOOGLE.DRIVE_FOLDER_ID,
  });
  if (driveConfig.REFRESH_TOKEN) {
    integrations.push({ provider: "DRIVE", config: driveConfig });
  }

  const sheetsConfig = compactObject({
    ...googleShared,
    SHEETS_ID: config.GOOGLE.SHEETS_ID,
    SHEET_NAME: config.GOOGLE.SHEET_NAME,
  });
  if (sheetsConfig.REFRESH_TOKEN) {
    integrations.push({ provider: "SHEETS", config: sheetsConfig });
  }

  return integrations;
}

async function ensurePlan(code) {
  return prisma.plan.upsert({
    where: { code },
    update: {},
    create: { code, name: code === "A" ? "Realtime MP -> AFIP" : `Plan ${code}` },
  });
}

async function ensureSubscription(tenantId, planCode) {
  const plan = await ensurePlan(planCode);

  const existing = await prisma.subscription.findFirst({
    where: { tenantId },
  });

  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        status: "ACTIVE",
      },
    });
  }

  return prisma.subscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: "ACTIVE",
    },
  });
}

async function migrateTableToTenant({
  modelName,
  targetTenantId,
  distinctTenantIds,
  targetCount,
  updateMany,
}) {
  const ids = distinctTenantIds.map((row) => row.tenantId);
  if (ids.length === 0) {
    return { migrated: 0, alreadyAssigned: true };
  }

  if (ids.length === 1 && String(ids[0]) === String(targetTenantId)) {
    return { migrated: 0, alreadyAssigned: true };
  }

  if (ids.length > 1) {
    throw new Error(
      `${modelName}: se encontraron multiples tenantId (${ids.map(String).join(", ")}) y no es seguro reasignar automaticamente`
    );
  }

  if (targetCount > 0) {
    throw new Error(
      `${modelName}: el tenant destino ya tiene datos y existe otro tenantId previo; abortando para evitar conflictos`
    );
  }

  const result = await updateMany(ids[0], targetTenantId);
  return { migrated: result.count, alreadyAssigned: false };
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("slug", { type: "string", demandOption: true })
    .option("name", { type: "string", demandOption: true })
    .option("status", { type: "string", default: "ACTIVE" })
    .option("plan", { type: "string", default: "A" })
    .option("owner-email", { type: "string" })
    .strict()
    .parseAsync();

  const tenant = await prisma.tenant.upsert({
    where: { slug: argv.slug },
    update: {
      name: argv.name,
      status: String(argv.status).toUpperCase(),
    },
    create: {
      slug: argv.slug,
      name: argv.name,
      status: String(argv.status).toUpperCase(),
    },
  });

  await ensureSubscription(tenant.id, String(argv.plan).toUpperCase());

  if (argv.ownerEmail) {
    await prisma.tenantUser.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: String(argv.ownerEmail).toLowerCase(),
        },
      },
      update: { role: "owner" },
      create: {
        tenantId: tenant.id,
        email: String(argv.ownerEmail).toLowerCase(),
        role: "owner",
      },
    });
  }

  const integrations = buildTenantIntegrationsFromEnv();
  for (const integration of integrations) {
    await prisma.tenantIntegration.upsert({
      where: {
        tenantId_provider: {
          tenantId: tenant.id,
          provider: integration.provider,
        },
      },
      update: {
        enabled: true,
        secretEnc: encryptJson(integration.config),
      },
      create: {
        tenantId: tenant.id,
        provider: integration.provider,
        enabled: true,
        secretEnc: encryptJson(integration.config),
      },
    });
  }

  const paymentTenantIds = await prisma.payment.groupBy({
    by: ["tenantId"],
  });
  const sequenceTenantIds = await prisma.invoiceSequence.groupBy({
    by: ["tenantId"],
  });
  const paymentTargetCount = await prisma.payment.count({
    where: { tenantId: tenant.id },
  });
  const sequenceTargetCount = await prisma.invoiceSequence.count({
    where: { tenantId: tenant.id },
  });

  const paymentMigration = await migrateTableToTenant({
    modelName: "Payment",
    targetTenantId: tenant.id,
    distinctTenantIds: paymentTenantIds,
    targetCount: paymentTargetCount,
    updateMany: (fromTenantId, toTenantId) =>
      prisma.payment.updateMany({
        where: { tenantId: fromTenantId },
        data: { tenantId: toTenantId },
      }),
  });

  const sequenceMigration = await migrateTableToTenant({
    modelName: "InvoiceSequence",
    targetTenantId: tenant.id,
    distinctTenantIds: sequenceTenantIds,
    targetCount: sequenceTargetCount,
    updateMany: (fromTenantId, toTenantId) =>
      prisma.invoiceSequence.updateMany({
        where: { tenantId: fromTenantId },
        data: { tenantId: toTenantId },
      }),
  });

  console.log("Legacy tenant bootstrap OK", {
    tenantId: tenant.id.toString(),
    slug: tenant.slug,
    integrations: integrations.map((item) => item.provider),
    paymentMigration,
    sequenceMigration,
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
