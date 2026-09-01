export function assertManagedAdminUpdate({ actorId, targetUser, nextRole, nextStatus, activeSuperadminCount }) {
  const isSelf = String(actorId) === String(targetUser.id);
  const resultingRole = nextRole ?? targetUser.role;
  const resultingStatus = nextStatus ?? targetUser.status;

  if (isSelf && resultingStatus !== "ACTIVE") {
    throw new Error("No podes deshabilitar tu propio administrador");
  }
  if (isSelf && resultingRole !== "SUPERADMIN") {
    throw new Error("No podes quitarte el rol SUPERADMIN");
  }

  const removesActiveSuperadmin = targetUser.role === "SUPERADMIN"
    && targetUser.status === "ACTIVE"
    && (resultingRole !== "SUPERADMIN" || resultingStatus !== "ACTIVE");
  if (removesActiveSuperadmin && activeSuperadminCount <= 1) {
    throw new Error("Debe quedar al menos un SUPERADMIN activo");
  }
}
