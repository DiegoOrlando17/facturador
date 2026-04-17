import { Router } from "express";
import { upsertPayment } from "../models/Payment.js";
import { webhooksQueue } from "../queues/webhooks.queue.js";
import { resolveTenantIdBySlug } from "../services/tenantConfig.service.js";
import { config } from "../config/index.js";
import { toQueueId } from "../utils/bigint.js";

const router = Router();

router.post("/mercadopago", async (req, res) => {

  try {
    const { type, data } = req.body;

    if (type === "payment" && data && data.id) {

      const tenantId = await resolveTenantIdBySlug(config.DEFAULT_TENANT_SLUG);

      const payment = await upsertPayment(tenantId, "mercadopago", String(data.id || ""), { status: "pending" });

      const job = await webhooksQueue.add(`webhooks-${data.id}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
        jobId: `job-webhooks-${data.id}`,
        attempts: 8,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 50,
      }); 
            
    }
    
    res.sendStatus(200);
  } catch (err) {
    console.error("Error en webhook:", err);
    res.sendStatus(500);
  }
});

export default router;
