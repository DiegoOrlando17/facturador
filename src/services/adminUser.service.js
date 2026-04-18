import { db } from "../models/db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

function normalizeAdminJson(adminUser) {
  if (!adminUser) return null;

  return {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    status: adminUser.status,
    lastLoginAt: adminUser.lastLoginAt,
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  };
}

export async function findAdminUserByEmail(email) {
  return db.adminUser.findUnique({
    where: { email: String(email || "").trim().toLowerCase() },
  });
}

export async function findAdminUserById(id) {
  return db.adminUser.findUnique({
    where: { id },
  });
}

export async function createAdminUser({ email, password, role = "SUPERADMIN", status = "ACTIVE" }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("email es obligatorio");

  const passwordHash = await hashPassword(password);

  const adminUser = await db.adminUser.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role,
      status,
    },
  });

  return normalizeAdminJson(adminUser);
}

export async function authenticateAdminUser(email, password) {
  const adminUser = await findAdminUserByEmail(email);
  if (!adminUser) return null;
  if (adminUser.status !== "ACTIVE") return null;

  const passwordOk = await verifyPassword(password, adminUser.passwordHash);
  if (!passwordOk) return null;

  const updated = await db.adminUser.update({
    where: { id: adminUser.id },
    data: {
      lastLoginAt: new Date(),
    },
  });

  return normalizeAdminJson(updated);
}

export function sanitizeAdminUser(adminUser) {
  return normalizeAdminJson(adminUser);
}
