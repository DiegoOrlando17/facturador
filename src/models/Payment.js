import { db } from "./db.js";

/**
 * Inserta o actualiza un pago (idempotente).
 * Si no existe, lo crea. Si ya existe, actualiza los campos nuevos.
 */
export async function upsertPayment(tenantId, provider, provider_payment_id, data = {}) {
  return db.payment.upsert({
    where: { tenantId_provider_provider_payment_id: { tenantId, provider, provider_payment_id } },
    update: {
      ...data,
      updatedAt: new Date(),
    },
    create: {
      tenantId, 
      provider,
      provider_payment_id,
      ...data,
      createdAt: new Date(),
    },
  });
}

/**
 * Actualiza un pago existente. Si no existe, lanza error.
 */
export async function updatePayment(tenantId, id, data = {}) {
  return db.payment.update({
    where: { id_tenantId: { id, tenantId } },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Actualiza solo el estado (status) de un pago.
 */
export async function updatePaymentStatus(tenantId, id, newStatus, error = null) {
  return db.payment.update({
    where: { id_tenantId: { id, tenantId} },
    data: {
      status: newStatus,
      error,
      updatedAt: new Date(),
    },
    select: { id: true, tenantId: true, status: true, error: true, updatedAt: true },
  });
}

/**
 * Obtiene un pago por id.
 */
export async function getPayment(tenantId, id) {
  return db.payment.findFirst({
    where: { tenantId, id },
  });
}

export async function getPaymentByProviderPaymentId(tenantId, provider, provider_payment_id) {
  return db.payment.findUnique({
    where: {
      tenantId_provider_provider_payment_id: {
        tenantId,
        provider,
        provider_payment_id: String(provider_payment_id),
      },
    },
  });
}

/**
 * Lista los pagos por estado (ej: RECEIVED, AFIP_OK, DONE, etc.)
 */
export async function getPaymentsByStatus(tenantId, status) {
  return db.payment.findMany({
    where: { tenantId, status },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingPayments(tenantId = null) {
  return db.payment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: {
        in: [
          "afip_pending",
          "pdf_pending",
          "drive_pending",
          "sheets_pending",
        ],
      },
    },
    select: {
      id: true,
      tenantId: true, 
      provider_payment_id: true,
      status: true,
    },
  });
}

export async function getAllPaymentsIds(tenantId, provider) {
  return db.payment.findMany({
    where: { tenantId, provider },
    select: { provider_payment_id: true }
  });
}
