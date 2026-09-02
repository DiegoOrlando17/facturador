import { db } from "../models/db.js";
import { listAdminAttentionItems } from "./adminMonitor.service.js";
import { createTenantAuditLog } from "./tenantSupport.service.js";
import { mergeAlertAssignments } from "../domain/operationalAlert.js";

const ALERT_ENTITY_TYPE = "OperationalAlert";

async function getCurrentAlert(alertKey) {
  const items = await listAdminAttentionItems({ take: 100 });
  return items.find((item) => item.id === alertKey) ?? null;
}

export async function listOperationalAlerts() {
  const items = await listAdminAttentionItems({ take: 100 });
  if (items.length === 0) return { items: [], total: 0 };

  const events = await db.tenantAuditLog.findMany({
    where: {
      entityType: ALERT_ENTITY_TYPE,
      entityId: { in: items.map((item) => item.id) },
      action: { in: ["operational_alert_claimed", "operational_alert_released"] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      adminUser: { select: { id: true, name: true, email: true, role: true } },
    },
  });
  return {
    items: mergeAlertAssignments(items, events),
    total: items.length,
  };
}

export async function claimOperationalAlert(alertKey, adminUser) {
  const alert = await getCurrentAlert(alertKey);
  if (!alert) {
    const error = new Error("La alerta ya no esta activa");
    error.statusCode = 404;
    throw error;
  }

  await createTenantAuditLog({
    tenantId: alert.tenant.id,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: "operational_alert_claimed",
    entityType: ALERT_ENTITY_TYPE,
    entityId: alert.id,
    after: { assignedAdminUserId: String(adminUser.id), assignedEmail: adminUser.email },
  });
  return { ok: true, alertKey: alert.id };
}

export async function releaseOperationalAlert(alertKey, adminUser) {
  const alert = await getCurrentAlert(alertKey);
  if (!alert) {
    const error = new Error("La alerta ya no esta activa");
    error.statusCode = 404;
    throw error;
  }

  await createTenantAuditLog({
    tenantId: alert.tenant.id,
    adminUserId: BigInt(adminUser.id),
    actorType: "admin",
    actorId: String(adminUser.id),
    action: "operational_alert_released",
    entityType: ALERT_ENTITY_TYPE,
    entityId: alert.id,
    after: { releasedByAdminUserId: String(adminUser.id) },
  });
  return { ok: true, alertKey: alert.id };
}
