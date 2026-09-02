const CREDIT_NOTE_TYPES = Object.freeze({ 1: 3, 6: 8, 11: 13, 51: 53 });

export function getCreditNoteType(invoiceType) {
  const creditNoteType = CREDIT_NOTE_TYPES[Number(invoiceType)];
  if (!creditNoteType) throw new Error(`Tipo de factura no soportado para nota de credito: ${invoiceType}`);
  return creditNoteType;
}

export function parseIssuedInvoiceNumber(value) {
  const match = String(value || "").match(/^(\d{1,5})-(\d{1,8})$/);
  if (!match) throw new Error("Numero de factura original invalido");
  return { ptoVta: Number(match[1]), number: Number(match[2]) };
}

export function assertCreditNoteEligible(invoice, hasEntitlement) {
  if (!hasEntitlement) throw new Error("El plan del tenant no incluye notas de credito");
  if (!invoice || invoice.type !== "INVOICE" || invoice.status !== "ISSUED" || !invoice.cae) {
    throw new Error("Solo se puede anular una factura emitida en ARCA");
  }
  getCreditNoteType(invoice.cbteTipo);
  parseIssuedInvoiceNumber(invoice.cbteNro);
}
