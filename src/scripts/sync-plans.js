import { PrismaClient } from "@prisma/client";
import { PLAN_CATALOG } from "../config/planCatalog.js";

const prisma = new PrismaClient();

async function main() {
  const results = [];

  for (const { features: _features, ...plan } of PLAN_CATALOG) {
    const saved = await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
      select: { id: true, code: true, name: true, status: true },
    });
    results.push({ ...saved, id: saved.id.toString() });
  }

  console.log("Planes sincronizados", results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
