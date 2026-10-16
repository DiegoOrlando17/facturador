/**
 * Códigos fiscales de ARCA y medios de pago de Mercado Pago, en lenguaje del
 * comerciante. Para estados de procesamiento usar lib/statusLabels.ts.
 */

/** Tipos de comprobante (CbteTipo de ARCA). */
export const COMPROBANTE_TYPES: Record<number, { label: string; short: string; kind: "invoice" | "debit_note" | "credit_note" | "receipt" }> = {
  1: { label: "Factura A", short: "FA", kind: "invoice" },
  2: { label: "Nota de débito A", short: "NDA", kind: "debit_note" },
  3: { label: "Nota de crédito A", short: "NCA", kind: "credit_note" },
  4: { label: "Recibo A", short: "RA", kind: "receipt" },
  6: { label: "Factura B", short: "FB", kind: "invoice" },
  7: { label: "Nota de débito B", short: "NDB", kind: "debit_note" },
  8: { label: "Nota de crédito B", short: "NCB", kind: "credit_note" },
  9: { label: "Recibo B", short: "RB", kind: "receipt" },
  11: { label: "Factura C", short: "FC", kind: "invoice" },
  12: { label: "Nota de débito C", short: "NDC", kind: "debit_note" },
  13: { label: "Nota de crédito C", short: "NCC", kind: "credit_note" },
  15: { label: "Recibo C", short: "RC", kind: "receipt" },
  51: { label: "Factura M", short: "FM", kind: "invoice" },
  52: { label: "Nota de débito M", short: "NDM", kind: "debit_note" },
  53: { label: "Nota de crédito M", short: "NCM", kind: "credit_note" },
  201: { label: "Factura de crédito electrónica A", short: "FCE A", kind: "invoice" },
  203: { label: "Nota de crédito electrónica A", short: "NC FCE A", kind: "credit_note" },
  206: { label: "Factura de crédito electrónica B", short: "FCE B", kind: "invoice" },
  208: { label: "Nota de crédito electrónica B", short: "NC FCE B", kind: "credit_note" },
  211: { label: "Factura de crédito electrónica C", short: "FCE C", kind: "invoice" },
  213: { label: "Nota de crédito electrónica C", short: "NC FCE C", kind: "credit_note" },
};

export function getComprobanteTypeLabel(code: number | string | null | undefined, fallback = "Comprobante") {
  if (code === null || code === undefined || code === "") return fallback;
  return COMPROBANTE_TYPES[Number(code)]?.label ?? fallback;
}

/** Nota de crédito que anula cada tipo de factura (igual que el backend). */
export const CREDIT_NOTE_FOR: Record<number, number> = { 1: 3, 6: 8, 11: 13, 51: 53 };

/** Alícuotas de IVA (Id de ARCA). */
export const IVA_RATES: Record<number, { label: string; rate: number }> = {
  3: { label: "0 %", rate: 0 },
  9: { label: "2,5 %", rate: 2.5 },
  8: { label: "5 %", rate: 5 },
  4: { label: "10,5 %", rate: 10.5 },
  5: { label: "21 %", rate: 21 },
  6: { label: "27 %", rate: 27 },
};

export function getIvaRateLabel(id: number | string | null | undefined, fallback = "Sin dato") {
  if (id === null || id === undefined || id === "") return fallback;
  return IVA_RATES[Number(id)]?.label ?? fallback;
}

/** Tipos de documento del receptor (DocTipo de ARCA). */
export const DOCUMENT_TYPES: Record<number, { label: string; code: string }> = {
  80: { label: "CUIT", code: "CUIT" },
  86: { label: "CUIL", code: "CUIL" },
  87: { label: "CDI", code: "CDI" },
  89: { label: "Libreta de enrolamiento", code: "LE" },
  90: { label: "Libreta cívica", code: "LC" },
  91: { label: "Cédula extranjera", code: "CI_EXT" },
  94: { label: "Pasaporte", code: "PASAPORTE" },
  96: { label: "DNI", code: "DNI" },
  99: { label: "Consumidor final", code: "CONSUMIDOR_FINAL" },
};

/** Acepta el código numérico de ARCA o el código de texto que usa el backend ("CUIT", "DNI"…). */
export function getDocumentTypeLabel(value: number | string | null | undefined, fallback = "Sin documento") {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && DOCUMENT_TYPES[numeric]) return DOCUMENT_TYPES[numeric].label;
  const code = String(value).trim().toUpperCase().replace(/\s+/g, "_");
  const found = Object.values(DOCUMENT_TYPES).find((item) => item.code === code);
  return found?.label ?? fallback;
}

/** Condición frente al IVA del receptor. */
export const IVA_CONDITIONS: Record<number, string> = {
  1: "Responsable inscripto",
  4: "Exento",
  5: "Consumidor final",
  6: "Monotributista",
  7: "Sujeto no categorizado",
  8: "Proveedor del exterior",
  9: "Cliente del exterior",
  10: "IVA liberado",
  13: "Monotributista social",
  15: "IVA no alcanzado",
  16: "Monotributista trabajador independiente promovido",
};

/** Tipo de medio de pago de Mercado Pago (payment_type_id). */
export const PAYMENT_TYPES: Record<string, string> = {
  account_money: "Dinero en cuenta de Mercado Pago",
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  prepaid_card: "Tarjeta prepaga",
  bank_transfer: "Transferencia",
  ticket: "Pago en efectivo",
  atm: "Cajero automático",
  digital_currency: "Moneda digital",
  digital_wallet: "Billetera digital",
  voucher_card: "Tarjeta de beneficios",
  crypto_transfer: "Transferencia cripto",
};

/** Medio de pago puntual de Mercado Pago (payment_method_id). */
export const PAYMENT_METHODS: Record<string, string> = {
  account_money: "Dinero en cuenta",
  visa: "Visa",
  debvisa: "Visa Débito",
  master: "Mastercard",
  debmaster: "Mastercard Débito",
  maestro: "Maestro",
  amex: "American Express",
  cabal: "Cabal",
  debcabal: "Cabal Débito",
  naranja: "Naranja X",
  argencard: "Argencard",
  cencosud: "Cencosud",
  cmr: "CMR",
  diners: "Diners",
  tarshop: "Tarjeta Shopping",
  rapipago: "Rapipago",
  pagofacil: "Pago Fácil",
  cvu: "Transferencia (CVU)",
  qr: "QR",
};

/** Etiqueta del medio de pago. Acepta payment_method_id o payment_type_id. */
export function getPaymentMethodLabel(value: string | null | undefined, fallback = "Otro medio de pago") {
  if (!value) return fallback;
  const key = value.trim().toLowerCase();
  return PAYMENT_METHODS[key] ?? PAYMENT_TYPES[key] ?? fallback;
}

/** "00001-00000042". Acepta números o strings; si falta algo devuelve el fallback. */
export function formatComprobanteNumber(
  ptoVta: number | string | null | undefined,
  nro: number | string | null | undefined,
  fallback = "Sin número",
) {
  if (nro === null || nro === undefined || nro === "") return fallback;
  const digitsNro = String(nro).replace(/\D/g, "");
  if (!digitsNro) return fallback;
  const digitsPto = ptoVta === null || ptoVta === undefined ? "" : String(ptoVta).replace(/\D/g, "");
  const number = digitsNro.padStart(8, "0");
  return digitsPto ? `${digitsPto.padStart(5, "0")}-${number}` : number;
}

/**
 * Normaliza un número de comprobante que ya viene armado ("1-42", "0001-00000042")
 * o separado. Útil cuando el backend guarda `cbteNro` como texto.
 */
export function parseComprobanteNumber(value: string | number | null | undefined, fallback = "Sin número") {
  if (value === null || value === undefined || value === "") return fallback;
  const parts = String(value).split("-");
  if (parts.length === 2) return formatComprobanteNumber(parts[0], parts[1], fallback);
  return formatComprobanteNumber(null, value, fallback);
}

/** CUIT/CUIL "20123456789" → "20-12345678-9". Si no tiene 11 dígitos lo devuelve tal cual. */
export function formatCuit(value: string | number | null | undefined, fallback = "Sin CUIT") {
  if (value === null || value === undefined || value === "") return fallback;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return String(value);
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/** Verifica el dígito verificador de un CUIT/CUIL. */
export function isValidCuit(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const remainder = 11 - (sum % 11);
  const check = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;
  return check === Number(digits[10]);
}
