export function mergeAlertAssignments(items, events) {
  const latestByKey = new Map();
  for (const event of events) {
    if (!latestByKey.has(event.entityId)) latestByKey.set(event.entityId, event);
  }

  return items.map((item) => {
    const latest = latestByKey.get(item.id);
    const assigned = latest?.action === "operational_alert_claimed";
    return {
      ...item,
      assignment: assigned ? {
        adminUser: latest.adminUser,
        assignedAt: latest.createdAt,
      } : null,
    };
  });
}
