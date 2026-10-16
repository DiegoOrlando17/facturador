export function resolveInvoiceSchedule(issueAt, now = new Date()) {
  if (!issueAt) return { scheduledAt: null, delay: 0 };
  const scheduledAt = new Date(issueAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) throw new Error("Elegí un horario futuro para la emisión.");
  const delay = scheduledAt.getTime() - now.getTime();
  if (delay > 30 * 24 * 60 * 60 * 1000) throw new Error("La emisión se puede programar hasta 30 días hacia adelante.");
  return { scheduledAt, delay };
}

/** Dígito verificador de CUIT/CUIL (módulo 11). */
export function isValidCuit(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const remainder = 11 - (sum % 11);
  const check = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return check === Number(digits[10]);
}

const DOC_TYPES = new Set(["CUIT", "DNI"]);

/**
 * Factura manual. El documento del cliente es opcional e informativo (figura en
 * el PDF); si se indica, se valida según el tipo.
 */
export function normalizeManualInvoiceInput(body = {}) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El importe tiene que ser mayor a cero.");
  const rawType = String(body.customerDocType || "").trim().toUpperCase();
  const customerDocType = DOC_TYPES.has(rawType) ? rawType : null;
  const customerDocNumber = customerDocType ? String(body.customerDocNumber || "").replace(/\D/g, "") || null : null;
  if (customerDocType === "CUIT" && !isValidCuit(customerDocNumber)) throw new Error("Revisá el CUIT del cliente: no es válido.");
  if (customerDocType === "DNI" && !/^\d{7,8}$/.test(customerDocNumber || "")) throw new Error("El DNI tiene que tener 7 u 8 dígitos.");
  return {
    amount: Math.round(amount * 100) / 100,
    currency: String(body.currency || "ARS").trim().toUpperCase(),
    customer: String(body.customer || "").trim() || null,
    customerDocType,
    customerDocNumber,
  };
}
