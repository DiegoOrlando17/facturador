import logger from "../utils/logger.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";

import { DateTime } from "luxon";
import { upsertPayment, getAllPaymentsIds } from "../models/Payment.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import { fetchLast24HsPayments, getPaymentInfoMP } from "../services/mercadopago.service.js";
import { listEnabledTenantsByIntegration } from "../services/tenantConfig.service.js";

const CHECK_INTERVAL_MIN = 1;
let lastRunSlot = null;

async function addMissingPayments(tenantId, payments) {
    if (payments.length === 0) {
        logger.info(`[t=${tenantId}] No hay pagos faltantes en ultimas 24h.`);
        return;
    }

    logger.error(`[t=${tenantId}] Detectados ${payments.length} pagos faltantes -> generando upsert...`);

    for (const p of payments) {
        const data = getPaymentInfoMP(p);
        data.status = "pending";

        const payment = await upsertPayment(tenantId, "mercadopago", String(p.id || ""), data);

        await paymentsQueue.add(`payments-${tenantId}-${payment.provider_payment_id.toString()}`, { tenantId: toQueueId(tenantId), paymentId: toQueueId(payment.id) }, {
            jobId: buildQueueJobId({ tenantId, paymentId: payment.id, step: "afip" }),
            attempts: 10,
            backoff: { type: "exponential", delay: 3000 },
            removeOnComplete: true,
            removeOnFail: 50,
        });
    }
}

async function auditTenant(tenantId, mpCfg) {
    const mpPayments = await fetchLast24HsPayments(mpCfg);
    const dbIds = (await getAllPaymentsIds(tenantId, "mercadopago"))
        .map((row) => Number(row.provider_payment_id));

    const dbSet = new Set(dbIds);
    const missing = mpPayments.filter((payment) => !dbSet.has(Number(payment.id)));

    await addMissingPayments(tenantId, missing);
}

async function startAuditWorker() {
    console.log("Audit worker iniciado.");

    setInterval(async () => {
        try {
            const now = DateTime.now().setZone("America/Argentina/Buenos_Aires");
            const hour = now.hour;
            const minute = now.minute;
            const validMinutes = [0, 10, 20, 30, 40, 50];

            if (hour === 9 && validMinutes.includes(minute)) {
                const slotKey = `${now.toISODate()}-${hour}-${minute}`;

                if (lastRunSlot !== slotKey) {
                    lastRunSlot = slotKey;
                    const tenants = await listEnabledTenantsByIntegration("MERCADOPAGO");
                    for (const row of tenants) {
                        await auditTenant(row.tenantId, row.config);
                    }
                }
            }
        } catch (err) {
            logger.error("Error en Audit worker:", err);
        }
    }, CHECK_INTERVAL_MIN * 60 * 1000);
}

startAuditWorker().catch((error) => {
    logger.error("Error fatal en el Audit worker:", error);
    process.exit(1);
});
