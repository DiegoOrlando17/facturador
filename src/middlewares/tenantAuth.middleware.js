import { getTenantPortalUserById } from "../services/tenantPortal.service.js";
import { verifyTenantToken } from "../utils/tenantToken.js";

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function requireTenantAuth(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Falta Authorization Bearer token" });
    }

    const payload = verifyTenantToken(token);
    const tenantUser = await getTenantPortalUserById(BigInt(payload.sub));

    if (!tenantUser || tenantUser.status !== "ACTIVE" || tenantUser.tenant?.status !== "ACTIVE") {
      return res.status(401).json({ error: "Sesion portal invalida" });
    }

    req.tenantAuth = {
      tokenPayload: payload,
      tenantUser,
      tenantId: BigInt(tenantUser.tenantId),
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: error.message || "No autorizado" });
  }
}
