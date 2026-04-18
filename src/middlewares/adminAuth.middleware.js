import { findAdminUserById, sanitizeAdminUser } from "../services/adminUser.service.js";
import { verifyAdminToken } from "../utils/adminToken.js";

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
