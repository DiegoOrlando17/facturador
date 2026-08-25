import { findAdminUserById, sanitizeAdminUser } from "../services/adminUser.service.js";
import { verifyAdminToken } from "../utils/adminToken.js";
import { adminRoleHasPermission } from "../domain/permissions.js";

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function requireAdminAuth(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Falta Authorization Bearer token" });
    }

    const payload = verifyAdminToken(token);
    const adminUserId = BigInt(payload.sub);
    const adminUser = await findAdminUserById(adminUserId);

    if (!adminUser || adminUser.status !== "ACTIVE") {
      return res.status(401).json({ error: "Sesion admin invalida" });
    }

    req.adminAuth = {
      tokenPayload: payload,
      adminUser: sanitizeAdminUser(adminUser),
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: error.message || "No autorizado" });
  }
}

export function assertAdminPermission(req, permission) {
  if (!adminRoleHasPermission(req.adminAuth?.adminUser?.role, permission)) {
    const error = new Error("Permiso admin insuficiente");
    error.statusCode = 403;
    throw error;
  }
}

export function requireAdminPermission(permission) {
  return (req, res, next) => {
    try {
      assertAdminPermission(req, permission);
      return next();
    } catch (error) {
      return res.status(403).json({ error: error.message });
    }
  };
}
