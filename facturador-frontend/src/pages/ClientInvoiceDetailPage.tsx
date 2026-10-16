import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ErrorState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stamp, Ticket, TicketDivider, TicketRow, TicketRows } from "@/components/ui/Ticket";
import { useToast } from "@/components/ui/Toast";
import { BRAND } from "@/config/brand";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { getComprobanteTypeLabel, getPaymentMethodLabel } from "@/lib/fiscalLabels";
import { formatArgentinaDateTime, formatFiscalDate } from "@/lib/formatters";
import { saveBlobAsFile } from "@/lib/portalApi";
import {
  getInvoiceCustomerLabel,
  getInvoiceDisplayState,
  getInvoiceNumberLabel,
  getScheduledIssueAt,
  type PortalInvoice,
} from "@/lib/portalInvoices";
import { getStatusLabel } from "@/lib/statusLabels";
import { useTenantCan } from "@/lib/tenantPermissions";

type Settings = { policy: { entitlements?: Record<string, boolean> } | null };

const BASE = "/portal-cliente/comprobantes";

const stampDate = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

function pdfName(invoice: PortalInvoice) {
  return `factura-${(invoice.cbteNro ?? invoice.id).replace(/[^\d-]/g, "")}.pdf`;
}

/** Compartir el PDF con la hoja nativa del celular (WhatsApp, mail…), si el navegador lo permite. */
function canShareFiles() {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File([""], "test.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

function InvoiceTicket({ invoice, shopName }: { invoice: PortalInvoice; shopName: string }) {
  const state = getInvoiceDisplayState(invoice);
  const number = getInvoiceNumberLabel(invoice);
  const issued = state.key === "issued" || state.key === "voided";
  const stamp = state.key === "voided"
    ? <Stamp label="ANULADA" tone="danger" size="lg" />
    : state.key === "issued"
      ? <Stamp size="lg" sublabel={invoice.issuedAt ? stampDate.format(new Date(invoice.issuedAt)) : undefined} />
      : undefined;
  return (
    <Ticket
      as="div"
      padding="lg"
      className="portal-receipt__ticket"
      eyebrow={
        <>
          <span>{invoice.cbteTipo ? getComprobanteTypeLabel(invoice.cbteTipo) : "Factura"}</span>
          <span>{number?.replace(/^\S+\s/, "") ?? "Sin número"}</span>
        </>
      }
      stamp={stamp}
    >
      <p className="portal-receipt__shop">{shopName}</p>
      <p className="portal-receipt__meta">
        {formatArgentinaDateTime(invoice.issuedAt ?? invoice.createdAt)}
        {invoice.payment?.payment_method_id ? ` · ${getPaymentMethodLabel(invoice.payment.payment_method_id)}` : ""}
      </p>
      <TicketDivider />
      <TicketRows>
        <TicketRow label="Cliente" value={getInvoiceCustomerLabel(invoice)} />
        {invoice.customerDocNumber ? <TicketRow label={invoice.customerDocType ?? "Documento"} value={invoice.customerDocNumber} mono /> : null}
        {issued ? <TicketRow label="CAE" value={invoice.cae ?? "Sin dato"} mono /> : null}
        {issued ? <TicketRow label="Vencimiento" value={formatFiscalDate(invoice.caeVto)} mono /> : null}
        <TicketRow label="Total" value={<Money value={invoice.amount} currency={invoice.currency ?? "ARS"} />} emphasis />
      </TicketRows>
    </Ticket>
  );
}

export function ClientInvoiceDetailPage() {
  const { id = "" } = useParams();
  const { user } = useTenantAuth();
  const api = usePortalApi();
  const toast = useToast();
  const confirm = useConfirm();
  const can = useTenantCan();
  const invoiceQuery = usePortalResource<PortalInvoice>(id ? `/portal/invoices/${id}` : null, { fallbackErrorMessage: "No pudimos cargar la factura." });
  const settings = usePortalResource<Settings>("/portal/invoices/settings");
  const [busy, setBusy] = useState<"pdf" | "share" | "void" | null>(null);
  const invoice = invoiceQuery.data;
  const shopName = user?.tenant?.name ?? BRAND.name;

  async function getPdf() {
    if (!invoice) return null;
    return api.requestBlob(`/portal/invoices/${invoice.id}/pdf`);
  }

  async function download() {
    if (!invoice) return;
    setBusy("pdf");
    try {
      const blob = await getPdf();
      if (blob) saveBlobAsFile(blob, pdfName(invoice));
    } catch (cause) {
      toast.error("No pudimos descargar el PDF", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!invoice) return;
    setBusy("share");
    try {
      const blob = await getPdf();
      if (!blob) return;
      const file = new File([blob], pdfName(invoice), { type: "application/pdf" });
      await navigator.share({ files: [file], title: `Factura ${getInvoiceNumberLabel(invoice) ?? ""}`.trim() });
    } catch (cause) {
      // Cerrar la hoja de compartir no es un error.
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      toast.error("No pudimos compartir el PDF", { description: getPortalErrorMessage(cause, "Probá descargarlo.") });
    } finally {
      setBusy(null);
    }
  }

  async function voidInvoice() {
    if (!invoice) return;
    const ok = await confirm({
      title: "¿Anular esta factura?",
      description: "Emitimos una nota de crédito en ARCA por el total. No se puede deshacer.",
      confirmLabel: "Anular factura",
      tone: "danger",
      requireText: "ANULAR",
    });
    if (!ok) return;
    setBusy("void");
    try {
      await api.request(`/portal/invoices/${invoice.id}/credit-note`, { method: "POST", body: { confirmation: "ANULAR" } });
      toast.success("Pedimos la nota de crédito", { description: "En unos minutos la factura figura como anulada." });
      await invoiceQuery.reload();
    } catch (cause) {
      toast.error("No pudimos anular la factura", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setBusy(null);
    }
  }

  if (invoiceQuery.errorMessage) {
    return (
      <div className="portal-page">
        <PageHeader title="Factura" breadcrumb={[{ label: "Facturas", to: BASE }, { label: "Factura" }]} />
        <ErrorState message={invoiceQuery.errorMessage} onRetry={() => void invoiceQuery.reload()} retrying={invoiceQuery.isRefreshing} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="portal-page" aria-busy="true">
        <Skeleton width="12rem" />
        <Skeleton variant="block" height="24rem" />
      </div>
    );
  }

  const state = getInvoiceDisplayState(invoice);
  const number = getInvoiceNumberLabel(invoice);
  const scheduledAt = getScheduledIssueAt(invoice);
  const note = invoice.creditNotes?.[0];
  const canVoid = state.key === "issued" && can("tenant.manageInvoices") && Boolean(settings.data?.policy?.entitlements?.creditNotes);
  const title = number ? `Factura ${number}` : "Factura sin emitir";
  const celebrating = state.key === "issued";

  const actions = (
    <div className="portal-receipt__actions">
      {state.key === "issued" || state.key === "voided" ? (
        <Button variant={celebrating ? "secondary" : "primary"} size="lg" fullWidth iconLeft="download" onClick={() => void download()} loading={busy === "pdf"} loadingLabel="Preparando PDF…">
          Descargar PDF
        </Button>
      ) : null}
      {(state.key === "issued" || state.key === "voided") && canShareFiles() ? (
        <Button variant="ghost" size="lg" fullWidth onClick={() => void share()} loading={busy === "share"} loadingLabel="Preparando…" className="portal-receipt__share">
          Compartir PDF
        </Button>
      ) : null}
      {state.key === "pending" ? (
        <ButtonLink to={`${BASE}?estado=para-confirmar`} variant="primary" size="lg" fullWidth>
          Ir a confirmar
        </ButtonLink>
      ) : null}
      {canVoid ? (
        <Button variant="danger-soft" fullWidth onClick={() => void voidInvoice()} loading={busy === "void"} loadingLabel="Pidiendo nota de crédito…">
          Anular con nota de crédito
        </Button>
      ) : null}
      <Link to={BASE} className="portal-receipt__back">
        Volver a facturas
      </Link>
    </div>
  );

  return (
    <div className="portal-page portal-receipt-page">
      <PageHeader
        title={title}
        breadcrumb={[{ label: "Facturas", to: BASE }, { label: number ?? "Sin emitir" }]}
        meta={
          <StatusBadge tone={scheduledAt ? "info" : state.tone} stamp={state.stamp}>
            {scheduledAt ? `Programada para ${formatArgentinaDateTime(scheduledAt)}` : state.label}
          </StatusBadge>
        }
      />

      {state.key === "failed" ? (
        <Callout tone="danger" title="ARCA no autorizó esta factura">
          {invoice.error || "No recibimos el motivo."} Si no sabés cómo resolverlo, escribinos a{" "}
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </Callout>
      ) : null}
      {state.key === "voided" && note ? (
        <Callout tone="info" title="Factura anulada">
          Se anuló con la nota de crédito {getInvoiceNumberLabel(note) ?? ""}
          {note.issuedAt ? ` del ${formatArgentinaDateTime(note.issuedAt)}` : ""}.
        </Callout>
      ) : null}
      {state.key === "voiding" ? <Callout tone="info">Estamos emitiendo la nota de crédito en ARCA. En unos minutos la factura figura como anulada.</Callout> : null}

      <section className={`portal-receipt${celebrating ? " portal-receipt--done" : ""}`} aria-label="Comprobante">
        {celebrating ? <p className="portal-receipt__headline">{BRAND.tagline}</p> : null}
        <div className="portal-receipt__body">
          <InvoiceTicket invoice={invoice} shopName={shopName} />
          {actions}
        </div>
      </section>

      {invoice.events && invoice.events.length > 0 ? (
        <section className="portal-section" aria-labelledby="invoice-history-title">
          <div className="portal-section__header">
            <h2 id="invoice-history-title">Historial</h2>
            {invoice.payment ? (
              <Link className="portal-link" to={`/portal-cliente/pagos/${invoice.payment.id}`}>
                Ver la venta
              </Link>
            ) : null}
          </div>
          <ol className="portal-timeline">
            {invoice.events.map((event) => (
              <li key={event.id}>
                <span className="portal-mono portal-muted">{formatArgentinaDateTime(event.createdAt)}</span>
                <span>
                  <strong>{getStatusLabel("invoiceEvent", event.type)}</strong>
                  {event.message ? <span className="portal-muted"> · {event.message}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
