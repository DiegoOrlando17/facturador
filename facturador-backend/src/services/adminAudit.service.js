import { db } from "../models/db.js";

const SENSITIVE_KEY = /token|secret|key|password|sign|cert/i;

function sanitizeAuditValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, current]) => [
    key,
    SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeAuditValue(current),
  ]));
}

export function sanitizeAuditJson(value) {
  if (!value) return null;
  try {
    return sanitizeAuditValue(JSON.parse(value));
  } catch {
    return { unavailable: true };
  }
}

function normalizeTake(value) {
  const parsed = Number(value ?? 50);
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

export async function listAdminAuditLogs({ tenantSlug, action, take } = {}) {
  const normalizedTenantSlug = String(tenantSlug || "").trim();
  const normalizedAction = String(action || "").trim();
  const where = {
    ...(normalizedTenantSlug ? { tenant: { is: { slug: normalizedTenantSlug } } } : {}),
    ...(normalizedAction ? { action: { contains: normalizedAction, mode: "insensitive" } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.tenantAuditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: normalizeTake(take),
      include: {
        tenant: { select: { id: true, slug: true, name: true } },
        adminUser: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    db.tenantAuditLog.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      tenant: row.tenant,
      actorType: row.actorType,
      actorId: row.actorId,
      adminUser: row.adminUser,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: sanitizeAuditJson(row.beforeJson),
      after: sanitizeAuditJson(row.afterJson),
      createdAt: row.createdAt,
    })),
    total,
  };
}
