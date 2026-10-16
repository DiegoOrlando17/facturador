import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { classifyPasswordReset, normalizePasswordResetConfirm, normalizePasswordResetRequest, PASSWORD_RESET_TTL_MS } from "../domain/passwordReset.js";
import { PublicRequestError, shouldExposeDevVerification } from "../domain/publicRegistration.js";
import { hashPassword } from "../utils/password.js";
import { sendPasswordResetEmail } from "./email.service.js";

const prisma = new PrismaClient();

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Genera un enlace por cada acceso activo con ese email (uno por empresa, o
 * solo el de la empresa indicada). La respuesta es la misma exista o no la
 * cuenta, para no revelar qué emails están registrados.
 */
export async function requestPasswordReset(payload, { exposeResetToken = shouldExposeDevVerification() } = {}) {
  const { email, tenantSlug } = normalizePasswordResetRequest(payload);
  const users = await prisma.tenantUser.findMany({
    where: { email, status: "ACTIVE", tenant: { status: "ACTIVE", ...(tenantSlug ? { slug: tenantSlug } : {}) } },
    include: { tenant: { select: { name: true, slug: true } } },
  });

  let firstToken = null;
  let emailSent = true;
  for (const user of users) {
    const token = crypto.randomBytes(32).toString("base64url");
    firstToken ??= token;
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { tenantUserId: user.id, usedAt: null }, data: { expiresAt: new Date(0) } }),
      prisma.passwordResetToken.create({ data: { tenantUserId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) } }),
    ]);
    try {
      const delivery = await sendPasswordResetEmail({ to: email, businessName: user.tenant.name, tenantSlug: user.tenant.slug, token });
      emailSent &&= delivery.sent;
    } catch (error) {
      console.error("[password-reset] email", error.message);
      emailSent = false;
    }
  }

  // emailSent solo se informa si hubo envíos, para no distinguir cuentas inexistentes.
  return { accepted: true, ...(users.length && !emailSent ? { emailSent: false } : {}), ...(exposeResetToken && firstToken ? { resetToken: firstToken } : {}) };
}

export async function confirmPasswordReset(payload) {
  const { token, password } = normalizePasswordResetConfirm(payload);
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { tenantUser: { include: { tenant: { select: { slug: true } } } } },
  });
  const state = classifyPasswordReset(reset);
  if (state === "invalid") throw new PublicRequestError("El enlace no es válido. Pedí uno nuevo con tu email.", { code: "RESET_INVALID" });
  if (state === "used") throw new PublicRequestError("Este enlace ya se usó. Si necesitás cambiar la contraseña otra vez, pedí uno nuevo.", { code: "RESET_USED" });
  if (state === "expired") throw new PublicRequestError("El enlace venció. Pedí uno nuevo con tu email.", { code: "RESET_EXPIRED" });

  const passwordHash = await hashPassword(password);
  const now = new Date();
  await prisma.$transaction([
    prisma.tenantUser.update({ where: { id: reset.tenantUserId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: now } }),
    prisma.passwordResetToken.updateMany({ where: { tenantUserId: reset.tenantUserId, usedAt: null, id: { not: reset.id } }, data: { expiresAt: new Date(0) } }),
  ]);
  return { reset: true, tenantSlug: reset.tenantUser.tenant?.slug ?? null, email: reset.tenantUser.email };
}
