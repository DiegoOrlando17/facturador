import { config } from "../config/index.js";
import crypto from "crypto";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

export function buildVerificationEmail({ businessName, verificationUrl }) {
  const safeName = escapeHtml(businessName);
  const safeUrl = escapeHtml(verificationUrl);
  return {
    subject: "Verifica tu cuenta de Facturador",
    text: `Hola, ${businessName}. Verifica tu email para activar el acceso a Facturador: ${verificationUrl}\n\nEl enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2933"><h1>Verifica tu cuenta</h1><p>Hola, ${safeName}.</p><p>Confirma tu email para activar el acceso a Facturador.</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#1d4f91;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Verificar email</a></p><p>El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.</p></div>`,
  };
}

export async function sendVerificationEmail({ to, businessName, token }) {
  if (!config.EMAIL.RESEND_API_KEY) return { sent: false, reason: "RESEND_API_KEY_NOT_CONFIGURED" };
  const verificationUrl = `${config.EMAIL.PUBLIC_APP_URL.replace(/\/$/, "")}/verificar-email?token=${encodeURIComponent(token)}`;
  const content = buildVerificationEmail({ businessName, verificationUrl });
  const idempotencyKey = crypto.createHash("sha256").update(token).digest("hex");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${config.EMAIL.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `verify-${idempotencyKey}` }, body: JSON.stringify({ from: config.EMAIL.FROM, to: [to], ...content, tags: [{ name: "email_type", value: "contact_verification" }] }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend rechazo el email (${response.status}): ${payload.message || "error sin detalle"}`);
  return { sent: true, id: payload.id };
}
