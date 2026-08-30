const POST_AFIP_PAYMENT_STATUSES = new Set([
  "processing",
  "pdf_pending",
  "drive_pending",
  "sheets_pending",
]);

export function resolveAutomaticRetryStep(paymentStatus, invoiceStatus) {
  if (invoiceStatus === "ISSUED" && POST_AFIP_PAYMENT_STATUSES.has(paymentStatus)) {
    return "post";
  }
  if (paymentStatus === "afip_pending" && invoiceStatus !== "ISSUED") {
    return "afip";
  }
  return null;
}

export function resolveManualRetryStep(requestedStep, invoiceStatus) {
  const step = requestedStep === "auto"
    ? invoiceStatus === "ISSUED" ? "post" : "afip"
    : requestedStep;

  if (!["afip", "post"].includes(step)) {
    throw new Error("step invalido");
  }
  if (step === "afip" && invoiceStatus === "ISSUED") {
    throw new Error("La factura ya fue emitida; solo se permite reprocesar el postproceso");
  }
  if (step === "post" && invoiceStatus !== "ISSUED") {
    throw new Error("El postproceso requiere una factura emitida");
  }
  return step;
}

export async function addOrReplaceFailedJob(queue, name, data, options) {
  const existing = options.jobId ? await queue.getJob(options.jobId) : null;
  if (!existing) {
    await queue.add(name, data, options);
    return "added";
  }

  const state = await existing.getState();
  if (state !== "failed") return "existing";

  await existing.remove();
  await queue.add(name, data, options);
  return "replaced_failed";
}
