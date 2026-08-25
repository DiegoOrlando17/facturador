export function toQueueId(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function toBigIntId(value, fieldName = "id") {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${fieldName} vacio`);
  }

  if (typeof value === "bigint") return value;

  try {
    return BigInt(value);
  } catch {
    throw new Error(`${fieldName} invalido: ${value}`);
  }
}

export function buildQueueJobId({ tenantId, paymentId, step }) {
  return `t-${String(tenantId)}-p-${String(paymentId)}-${String(step)}`;
}
