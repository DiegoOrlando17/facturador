import { db } from "../models/db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const VALID_ADMIN_ROLES = new Set(["SUPERADMIN", "OPERATOR", "VIEWER"]);
const VALID_ADMIN_STATUSES = new Set(["ACTIVE", "DISABLED"]);

function normalizeAdminJson(adminUser) {
  if (!adminUser) return null;

  return {
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
    status: adminUser.status,
    lastLoginAt: adminUser.lastLoginAt,
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
  };
}

function normalizeRole(role, fallback = "VIEWER") {
  const normalized = String(role || fallback).trim().toUpperCase();
  if (!VALID_ADMIN_ROLES.has(normalized)) {
    throw new Error("role invalido");
  }
  return normalized;
}

function normalizeStatus(status, fallback = "ACTIVE") {
  const normalized = String(status || fallback).trim().toUpperCase();
  if (!VALID_ADMIN_STATUSES.has(normalized)) {
    throw new Error("status invalido");
  }
  return normalized;
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

export async function createAdminUser({ name = null, email, password, role = "SUPERADMIN", status = "ACTIVE" }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("email es obligatorio");

  const passwordHash = await hashPassword(password);

  const adminUser = await db.adminUser.create({
    data: {
      name: String(name || "").trim() || null,
      email: normalizedEmail,
      passwordHash,
      role: normalizeRole(role, "SUPERADMIN"),
      status: normalizeStatus(status),
    },
  });

  return normalizeAdminJson(adminUser);
}

export async function listAdminUsers() {
  const users = await db.adminUser.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  return users.map(normalizeAdminJson);
}

export async function updateOwnAdminProfile(id, { name, email }) {
  const data = {};

  if (name !== undefined) {
    data.name = String(name || "").trim() || null;
  }

  if (email !== undefined) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("email es obligatorio");
    data.email = normalizedEmail;
  }

  const adminUser = await db.adminUser.update({
    where: { id: BigInt(id) },
    data,
  });

  return normalizeAdminJson(adminUser);
}

export async function createManagedAdminUser({ name = null, email, password, role = "VIEWER", status = "ACTIVE" }) {
  return createAdminUser({
    name,
    email,
    password,
    role: normalizeRole(role, "VIEWER"),
    status: normalizeStatus(status),
  });
}

export async function updateManagedAdminUser(id, { name, email, role, status, password }) {
  const data = {};

  if (name !== undefined) {
    data.name = String(name || "").trim() || null;
  }

  if (email !== undefined) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("email es obligatorio");
    data.email = normalizedEmail;
  }

  if (role !== undefined) {
    data.role = normalizeRole(role);
  }

  if (status !== undefined) {
    data.status = normalizeStatus(status);
  }

  if (password !== undefined && String(password || "").length > 0) {
    data.passwordHash = await hashPassword(password);
  }

  const adminUser = await db.adminUser.update({
    where: { id: BigInt(id) },
    data,
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
