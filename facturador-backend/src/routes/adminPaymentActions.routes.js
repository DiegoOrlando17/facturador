import { Router } from "express";
import { ADMIN_PERMISSIONS } from "../domain/permissions.js";
import { toBigIntId } from "../utils/bigint.js";

function normalizeJsonBigInts(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeJsonBigInts);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeJsonBigInts(item)])
  );
}

export function createAdminPaymentActionsRouter({
  requireAdminPermission,
  getAdminPaymentDetail,
  reprocessPaymentAsAdmin,
  deliverPaymentToGoogleAsAdmin,
  issuePaymentAsAdmin,
  cancelInvoiceAsAdmin,
}) {
  const router = Router();
  const requireOperate = requireAdminPermission(ADMIN_PERMISSIONS.OPERATE);

  router.post("/payments/:id/reprocess", requireOperate, async (req, res) => {
    try {
      const paymentId = toBigIntId(req.params.id, "paymentId");
      const payment = await getAdminPaymentDetail(paymentId);

      if (!payment) {
        return res.status(404).json({ error: "Pago no encontrado" });
      }

      const result = await reprocessPaymentAsAdmin(
        payment,
        req.adminAuth.adminUser,
        String(req.body.step || "auto").trim().toLowerCase()
      );

      return res.status(202).json(normalizeJsonBigInts({
        ok: true,
        paymentId,
        tenantId: payment.tenantId,
        ...result,
      }));
    } catch (error) {
      return res.status(400).json({ error: error.message || "No se pudo solicitar reproceso" });
    }
  });

  router.post("/payments/:id/deliver-google", requireOperate, async (req, res) => {
    try {
      const paymentId = toBigIntId(req.params.id, "paymentId");
      const payment = await getAdminPaymentDetail(paymentId);

      if (!payment) {
        return res.status(404).json({ error: "Pago no encontrado" });
      }

      const result = await deliverPaymentToGoogleAsAdmin(payment, req.adminAuth.adminUser);
      return res.status(result.queued ? 202 : 200).json(normalizeJsonBigInts({
        ok: true,
        paymentId,
        tenantId: payment.tenantId,
        ...result,
      }));
    } catch (error) {
      return res.status(400).json({ error: error.message || "No se pudo solicitar la entrega Google" });
    }
  });

  router.post("/payments/:id/issue", requireOperate, async (req, res) => {
    try {
      const paymentId = toBigIntId(req.params.id, "paymentId");
      const payment = await getAdminPaymentDetail(paymentId);
      if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
      const result = await issuePaymentAsAdmin(payment, req.adminAuth.adminUser);
      return res.status(202).json(normalizeJsonBigInts({ ok: true, paymentId, ...result }));
    } catch (error) {
      return res.status(400).json({ error: error.message || "No se pudo solicitar la emision" });
    }
  });

  router.post("/payments/:id/credit-note", requireOperate, async (req, res) => {
    try {
      const paymentId = toBigIntId(req.params.id, "paymentId");
      const payment = await getAdminPaymentDetail(paymentId);
      if (!payment) return res.status(404).json({ error: "Pago no encontrado" });
      if (req.body.confirmation !== "ANULAR") throw new Error("Debes confirmar la anulacion escribiendo ANULAR");
      const result = await cancelInvoiceAsAdmin(payment, req.adminAuth.adminUser);
      return res.status(result.queued ? 202 : 200).json(normalizeJsonBigInts({ ok: true, paymentId, ...result }));
    } catch (error) {
      return res.status(400).json({ error: error.message || "No se pudo solicitar la nota de credito" });
    }
  });

  return router;
}
