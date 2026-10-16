import type { StatusTone } from "@/lib/statusLabels";

/**
 * Grupos de estado de una venta en el portal. El chip del filtro y la etiqueta
 * de cada fila usan el mismo nombre.
 */
export const PAYMENT_GROUPS = [
  { key: "all", slug: "todas", label: "Todas", statuses: [] as string[], tone: "neutral" as StatusTone },
  { key: "invoiced", slug: "facturadas", label: "Facturada", chip: "Facturadas", statuses: ["pdf_pending", "drive_pending", "sheets_pending", "complete"], tone: "success" as StatusTone },
  { key: "processing", slug: "en-proceso", label: "En proceso", chip: "En proceso", statuses: ["pending", "processing", "afip_pending"], tone: "info" as StatusTone },
  { key: "failed", slug: "con-error", label: "Con error", chip: "Con error", statuses: ["failed"], tone: "danger" as StatusTone },
] as const;

export type PaymentGroupKey = (typeof PAYMENT_GROUPS)[number]["key"];

export function getPaymentGroup(status: string | null | undefined) {
  return PAYMENT_GROUPS.find((group) => group.key !== "all" && (group.statuses as readonly string[]).includes(String(status))) ?? PAYMENT_GROUPS[2];
}

/** Venta tal como la devuelve /portal/payments (pago + datos de su factura). */
export type PortalPayment = {
  id: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  payment_method_id: string | null;
  amount: number | null;
  currency: string | null;
  customer: string | null;
  customer_doc_type: string | null;
  customer_doc_number: string | null;
  date_approved: string | null;
  createdAt: string;
  error: string | null;
  cae: string | null;
  cae_vto: string | null;
  cbte_nro: string | null;
  cbte_tipo: number | null;
  pto_vta: number | null;
  invoice?: { id: string; status: string; creditNotes?: { status: string }[] } | null;
};
