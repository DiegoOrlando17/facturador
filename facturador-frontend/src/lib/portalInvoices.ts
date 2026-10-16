import { COMPROBANTE_TYPES, parseComprobanteNumber } from "@/lib/fiscalLabels";
import { ARGENTINA_TIMEZONE } from "@/lib/formatters";
import type { StatusTone } from "@/lib/statusLabels";

/** Comprobante tal como lo devuelve /portal/invoices. */
export type PortalInvoice = {
  id: string;
  type: "INVOICE" | "CREDIT_NOTE";
  source: "AUTOMATIC" | "CONFIRMATION" | "MANUAL" | "OCR";
  status: "DRAFT" | "PENDING_CONFIRMATION" | "QUEUED" | "ISSUING" | "ISSUED" | "FAILED";
  amount: number | null;
  currency: string | null;
  customer: string | null;
  customerDocType: string | null;
  customerDocNumber: string | null;
  cae: string | null;
  caeVto: string | null;
  cbteNro: string | null;
  cbteTipo: number | null;
  ptoVta: number | null;
  issuedAt: string | null;
  error: string | null;
  createdAt: string;
  payment?: { id: string; provider_payment_id: string; payment_method_id?: string | null } | null;
  creditNotes?: PortalInvoice[];
  events?: { id: string; type: string; message: string | null; payloadJson?: string | null; createdAt: string }[];
};

export type InvoiceDisplayState = {
  key: "voided" | "voiding" | "issued" | "pending" | "queued" | "issuing" | "failed" | "draft";
  label: string;
  tone: StatusTone;
  /** Se muestra como sello (CAE OK, ANULADA). */
  stamp: boolean;
};

/** Estado visible de una factura, teniendo en cuenta su nota de crédito. */
export function getInvoiceDisplayState(invoice: Pick<PortalInvoice, "status" | "creditNotes" | "type">): InvoiceDisplayState {
  const note = invoice.creditNotes?.[0];
  if (invoice.type === "INVOICE" && note?.status === "ISSUED") return { key: "voided", label: "Anulada", tone: "danger", stamp: true };
  if (invoice.type === "INVOICE" && note && note.status !== "FAILED") return { key: "voiding", label: "Anulando", tone: "info", stamp: false };
  switch (invoice.status) {
    case "ISSUED":
      return { key: "issued", label: "CAE OK", tone: "success", stamp: true };
    case "PENDING_CONFIRMATION":
      return { key: "pending", label: "Para confirmar", tone: "warning", stamp: false };
    case "QUEUED":
      return { key: "queued", label: "En cola", tone: "info", stamp: false };
    case "ISSUING":
      return { key: "issuing", label: "Emitiendo", tone: "info", stamp: false };
    case "FAILED":
      return { key: "failed", label: "ARCA la rechazó", tone: "danger", stamp: false };
    default:
      return { key: "draft", label: "Borrador", tone: "neutral", stamp: false };
  }
}

/** "C 00003-00001842" para emitidas; null si todavía no tiene número. */
export function getInvoiceNumberLabel(invoice: Pick<PortalInvoice, "cbteNro" | "cbteTipo">) {
  if (!invoice.cbteNro) return null;
  const type = invoice.cbteTipo ? COMPROBANTE_TYPES[invoice.cbteTipo] : undefined;
  const letter = type?.label.match(/\b([ABCM])$/)?.[1];
  const prefix = type?.kind === "credit_note" ? `NC${letter ? ` ${letter}` : ""}` : letter ?? "";
  const number = parseComprobanteNumber(invoice.cbteNro);
  return prefix ? `${prefix} ${number}` : number;
}

/** Horario de emisión programada, si el backend lo registró en los eventos. */
export function getScheduledIssueAt(invoice: Pick<PortalInvoice, "status" | "events">) {
  if (invoice.status !== "QUEUED") return null;
  for (const event of invoice.events ?? []) {
    if (!event.payloadJson) continue;
    try {
      const payload = JSON.parse(event.payloadJson) as { kind?: string; scheduledAt?: string };
      if (payload.kind === "scheduled_issue" && payload.scheduledAt) return payload.scheduledAt;
    } catch {
      // payload que no es JSON: se ignora
    }
  }
  return null;
}

/** Vistas del listado (backend: domain/invoiceViews.js) y su slug en la URL. */
export const INVOICE_VIEWS = [
  { view: "all", slug: "todas", label: "Todas" },
  { view: "pending", slug: "para-confirmar", label: "Para confirmar" },
  { view: "issued", slug: "emitidas", label: "Emitidas" },
  { view: "failed", slug: "con-error", label: "Con error" },
  { view: "voided", slug: "anuladas", label: "Anuladas" },
] as const;

export type InvoiceView = (typeof INVOICE_VIEWS)[number]["view"];

export function getInvoiceCustomerLabel(invoice: Pick<PortalInvoice, "customer">) {
  return invoice.customer?.trim() || "Consumidor final";
}

const shortDateTime = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ARGENTINA_TIMEZONE });

/** "15/10 10:42" en hora argentina. */
export function formatShortDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : shortDateTime.format(date).replace(",", "");
}
