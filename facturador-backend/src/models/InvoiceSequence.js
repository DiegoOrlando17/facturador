import logger from "../utils/logger.js";

import { db } from "./db.js";
import { getLastInvoiceAFIP } from "../services/afip.service.js";

export async function getLastCbteSeq(tx, tenantId, pto_vta, cbte_tipo, lastFromAfip = null) {
    let seq = await tx.$queryRaw`
        SELECT * FROM "InvoiceSequence"
        WHERE "tenantId" = ${tenantId} AND "pto_vta" = ${pto_vta} AND "cbte_tipo" = ${cbte_tipo}
        FOR UPDATE
    `;

    seq = seq[0];

    if (!seq) {
        if (lastFromAfip === null || lastFromAfip === undefined) return null;

        seq = await tx.invoiceSequence.create({
            data: {
                tenantId,
                pto_vta,
                cbte_tipo,
                last_nro: lastFromAfip,
            },
        });
    }

    return seq;
}

export async function getNextCbteNro(tenantId, pto_vta, cbte_tipo, afipCfg) {
    try {
        const existing = await db.invoiceSequence.findUnique({
            where: {
                tenantId_pto_vta_cbte_tipo: { tenantId, pto_vta, cbte_tipo },
            },
        });
        const lastFromAfip = existing
            ? null
            : await getLastInvoiceAFIP(afipCfg, pto_vta, cbte_tipo);

        return db.$transaction(async (tx) => {
            const seq = await getLastCbteSeq(tx, tenantId, pto_vta, cbte_tipo, lastFromAfip);
            
            if (!seq) return null;
            return { id: seq.id, next: seq.last_nro + 1n };
        });
    }
    catch (err) {
        logger.error("Error en getNextCbteNro: " + err);
        return null;
    }
}

export async function setLastCbteNro(id, nro) {
    return db.invoiceSequence.update({
        where: { id },
        data: { last_nro: nro },
    });
}

export async function resyncCbteNro(tenantId, pto_vta, cbte_tipo, afipCfg) {
    try {
        const lastFromAfip = await getLastInvoiceAFIP(afipCfg, pto_vta, cbte_tipo);
        if (!lastFromAfip) return null;

        await db.$transaction(async (tx) => {
            await tx.invoiceSequence.updateMany({
                where: { tenantId, pto_vta, cbte_tipo },
                data: { last_nro: lastFromAfip },
            });
        });

        return lastFromAfip;
    }
    catch (err) {
        logger.error("Error en resyncCbteNro: " + err);
        return null;
    }
}
