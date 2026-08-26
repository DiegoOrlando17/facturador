import logger from "../utils/logger.js";
import { buildQueueJobId, toQueueId } from "../utils/bigint.js";

import { DateTime } from "luxon";
import { fetchNewPayments, getPaymentInfoMP, fetchLastPayment, normalizeMpConfig } from "../services/mercadopago.service.js";
import { upsertPayment, getPaymentByProviderPaymentId } from "../models/Payment.js";
import { paymentsQueue } from "../queues/payments.queue.js";
import {
    listEnabledTenantsByIntegration,
    getIntegrationCheckpoint,
    setIntegrationCheckpoint,
} from "../services/tenantConfig.service.js";
import { getTenantSubscriptionPolicy } from "../services/subscriptionPolicy.service.js";
import { evaluateTenantSchedule, normalizeTenantSchedule } from "../domain/tenantScheduler.js";
import { claimDistributedSlot } from "../services/distributedLock.service.js";
import { connection } from "../config/redis.js";

let isRunning = false;
const tenantRuntime = new Map();

const LOOP_INTERVAL_MS = 5000;

async function shouldRunNow(tenantId, mpCfg) {
    const subscription = await getTenantSubscriptionPolicy(tenantId);
    const schedule = normalizeTenantSchedule(normalizeMpConfig(mpCfg), subscription?.policy);
    const now = DateTime.utc();
    const runtimeKey = String(tenantId);
    const state = tenantRuntime.get(runtimeKey) ?? {};
    const decision = evaluateTenantSchedule(schedule, state, now);
    return {
        ...decision,
        runtimeKey,
        lockTtlMs: schedule.mode === "realtime" ? Math.max(schedule.intervalMs * 2, 60_000) : 120_000,
    };
}

async function pollTenant(tenantId, mpCfg) {
    const checkpoint = await getIntegrationCheckpoint(tenantId, "MERCADOPAGO");
    let lastTimestamp = checkpoint?.timestamp || null;
    let lastPaymentId = checkpoint?.lastPaymentId || 0;

    if (!lastTimestamp) {
        logger.warn(`⚠️ [t=${tenantId}] No hay checkpoint MP, inicializando con el ultimo pago aprobado...`);
        const lastPayment = await fetchLastPayment(mpCfg);

        if (lastPayment) {
            await setIntegrationCheckpoint(tenantId, "MERCADOPAGO", {
                timestamp: lastPayment.date_approved,
                lastPaymentId: String(lastPayment.id),
            });
            logger.info(`🧭 [t=${tenantId}] Checkpoint inicial MP creado -> id=${lastPayment.id.toString()}, date=${lastPayment.date_approved}`);
        }

        return;
    }

    const newPayments = await fetchNewPayments(lastTimestamp, mpCfg);
    if (!Array.isArray(newPayments) || newPayments.length === 0) {
        return;
    }

    const lastTimestampMs = lastTimestamp ? new Date(lastTimestamp).getTime() : null;
    const filtered = newPayments.filter((p) => {
        if (!p.date_approved) return false;

        const tsMs = new Date(p.date_approved).getTime();
        const id = Number(p.id);

        if (Number.isNaN(tsMs)) return false;
        if (lastTimestampMs === null) return true;
        if (tsMs > lastTimestampMs) return true;
        if (tsMs === lastTimestampMs && id > Number(lastPaymentId)) return true;
        return false;
    });

    if (filtered.length === 0) {
        return;
    }

    for (const p of filtered) {
        const existing = await getPaymentByProviderPaymentId(tenantId, "mercadopago", String(p.id));
        if (existing) {
            continue;
        }

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

    const newest = filtered.sort((a, b) => {
        const aTs = new Date(a.date_approved).getTime();
        const bTs = new Date(b.date_approved).getTime();

        if (aTs !== bTs) {
            return aTs - bTs;
        }
        return Number(a.id) - Number(b.id);
    }).at(-1);

    if (newest) {
        lastTimestamp = newest.date_approved;
        lastPaymentId = Number(newest.id);

        await setIntegrationCheckpoint(tenantId, "MERCADOPAGO", {
            timestamp: lastTimestamp,
            lastPaymentId: String(lastPaymentId),
        });
    }
}

export async function startMercadopagoWorker() {
    logger.info(`✅ Mercadopago worker multitenant iniciado (loop: ${LOOP_INTERVAL_MS} ms)`);

    setInterval(async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const tenants = await listEnabledTenantsByIntegration("MERCADOPAGO");

            for (const row of tenants) {
                let slotClaim = null;
                try {
                    const decision = await shouldRunNow(row.tenantId, row.config);
                    if (!decision.shouldRun) continue;

                    const lockKey = `facturador:mp-poll:${row.tenantId}:${decision.slotKey}`;
                    slotClaim = await claimDistributedSlot(connection, lockKey, decision.lockTtlMs);
                    if (!slotClaim.claimed) continue;

                    await pollTenant(row.tenantId, row.config);
                    tenantRuntime.set(decision.runtimeKey, decision.runtime);
                } catch (error) {
                    if (slotClaim?.claimed) {
                        try {
                            await slotClaim.release();
                        } catch (releaseError) {
                            logger.error(`Error liberando lock MP tenant=${row.tenantId}: ${releaseError.message}`);
                        }
                    }
                    logger.error(`❌ Error en polling MP tenant=${row.tenantId}: ${error.message}`);
                }
            }
        } catch (error) {
            logger.error("❌ Error en Mercadopago worker:", error.message);
        } finally {
            isRunning = false;
        }
    }, LOOP_INTERVAL_MS);
}

if (process.argv[1].includes("mercadopago.worker.js")) {
    startMercadopagoWorker();
}
