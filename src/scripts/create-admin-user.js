import { PrismaClient } from "@prisma/client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { hashPassword } from "../utils/password.js";

const prisma = new PrismaClient();

const VALID_ROLES = new Set(["SUPERADMIN", "OPERATOR", "VIEWER"]);
const VALID_STATUS = new Set(["ACTIVE", "DISABLED"]);

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("email", {
      type: "string",
      demandOption: true,
      describe: "Email del admin",
    })
    .option("password", {
      type: "string",
      demandOption: true,
      describe: "Password del admin",
    })
    .option("role", {
      type: "string",
      default: "SUPERADMIN",
      describe: "Rol del admin: SUPERADMIN, OPERATOR o VIEWER",
    })
    .option("status", {
      type: "string",
      default: "ACTIVE",
      describe: "Estado del admin: ACTIVE o DISABLED",
    })
    .strict()
    .parseAsync();

  const email = String(argv.email || "").trim().toLowerCase();
  const password = String(argv.password || "");
  const role = String(argv.role || "SUPERADMIN").trim().toUpperCase();
  const status = String(argv.status || "ACTIVE").trim().toUpperCase();

  if (!email) throw new Error("email es obligatorio");
  if (!VALID_ROLES.has(role)) throw new Error(`role invalido: ${role}`);
  if (!VALID_STATUS.has(status)) throw new Error(`status invalido: ${status}`);

  const passwordHash = await hashPassword(password);

  const adminUser = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
      status,
    },
    create: {
      email,
      passwordHash,
      role,
      status,
    },
  });

  console.log("Admin user listo", {
    id: adminUser.id.toString(),
    email: adminUser.email,
    role: adminUser.role,
    status: adminUser.status,
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
