import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { FiscalNumber, Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { BRAND } from "@/config/brand";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { getComprobanteTypeLabel, getDocumentTypeLabel, getPaymentMethodLabel } from "@/lib/fiscalLabels";
import { formatArgentinaDateTime, formatFiscalDate } from "@/lib/formatters";
import { saveBlobAsFile } from "@/lib/portalApi";
import { getInvoiceNumberLabel } from "@/lib/portalInvoices";
import { getPaymentGroup, type PortalPayment } from "@/lib/portalPayments";
import { getPaymentEventLabel } from "@/lib/statusLabels";

type PaymentDetail = PortalPayment & {
  events: { id: string; type: string; message: string | null; createdAt: string }[];
};

const BASE = "/portal-cliente/pagos";

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="portal-detail__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ClientPaymentDetailPage() {
  const { id = "" } = useParams();
  const api = usePortalApi();
  const toast = useToast();
  const query = usePortalResource<PaymentDetail>(id ? `/portal/payments/${id}` : null, { fallbackErrorMessage: "No pudimos cargar la venta." });
  const [downloading, setDownloading] = useState(false);
  const payment = query.data;

  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await api.requestBlob(`/portal/payments/${id}/pdf?download=true`);
      saveBlobAsFile(blob, `factura-${(payment?.cbte_nro ?? id).replace(/[^\d-]/g, "")}.pdf`);
    } catch (cause) {
      toast.error("No pudimos descargar el PDF", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setDownloading(false);
    }
  }

  if (query.errorMessage) {
    return (
      <div className="portal-page">
        <PageHeader title="Venta" breadcrumb={[{ label: "Ventas", to: BASE }, { label: "Venta" }]} />
        <ErrorState message={query.errorMessage} onRetry={() => void query.reload()} retrying={query.isRefreshing} />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="portal-page" aria-busy="true">
        <Skeleton width="12rem" />
        <Skeleton variant="block" height="20rem" />
      </div>
    );
  }

  const group = getPaymentGroup(payment.status);
  const number = getInvoiceNumberLabel({ cbteNro: payment.cbte_nro, cbteTipo: payment.cbte_tipo });
  const when = payment.date_approved ?? payment.createdAt;
  const voided = payment.invoice?.creditNotes?.some((note) => note.status === "ISSUED");

  return (
    <div className="portal-page portal-payment-detail">
      <PageHeader
        title={`Venta del ${formatArgentinaDateTime(when)}`}
        breadcrumb={[{ label: "Ventas", to: BASE }, { label: "Venta" }]}
        meta={<StatusBadge tone={group.tone}>{group.label}</StatusBadge>}
      />

      {payment.error ? (
        <Callout tone="danger" title="No pudimos facturar esta venta">
          {payment.error} Si no sabés cómo resolverlo, escribinos a <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </Callout>
      ) : null}

      <div className="portal-detail-grid">
        <Card title="La venta">
          <p className="portal-detail__amount">
            <Money value={payment.amount} currency={payment.currency ?? "ARS"} size="lg" />
          </p>
          <dl className="portal-detail">
            <DetailRow label="Fecha">{formatArgentinaDateTime(when)}</DetailRow>
            <DetailRow label="Medio de pago">{getPaymentMethodLabel(payment.payment_method_id, "Mercado Pago")}</DetailRow>
            <DetailRow label="Cliente">{payment.customer?.trim() || "Consumidor final"}</DetailRow>
            {payment.customer_doc_number ? (
              <DetailRow label={getDocumentTypeLabel(payment.customer_doc_type, "Documento")}>
                <FiscalNumber kind={["CUIT", "CUIL"].includes(getDocumentTypeLabel(payment.customer_doc_type)) ? "cuit" : "plain"} value={payment.customer_doc_number} />
              </DetailRow>
            ) : null}
            <DetailRow label="Operación en Mercado Pago">
              <FiscalNumber kind="plain" value={payment.provider_payment_id} />
            </DetailRow>
          </dl>
        </Card>

        <Card title="La factura">
          {number ? (
            <>
              <dl className="portal-detail">
                <DetailRow label="Comprobante">
                  <FiscalNumber kind="plain" value={number} className={voided ? "portal-voided" : undefined} />
                </DetailRow>
                <DetailRow label="Tipo">{getComprobanteTypeLabel(payment.cbte_tipo)}</DetailRow>
                <DetailRow label="CAE">
                  <FiscalNumber kind="cae" value={payment.cae} />
                </DetailRow>
                <DetailRow label="Vencimiento del CAE">{formatFiscalDate(payment.cae_vto)}</DetailRow>
              </dl>
              {voided ? <Callout tone="info">Esta factura se anuló con una nota de crédito.</Callout> : null}
              <div className="portal-detail__actions">
                <Button variant="primary" iconLeft="download" onClick={() => void downloadPdf()} loading={downloading} loadingLabel="Preparando PDF…">
                  Descargar PDF
                </Button>
                {payment.invoice ? (
                  <ButtonLink to={`/portal-cliente/comprobantes/${payment.invoice.id}`} variant="secondary">
                    Ver factura
                  </ButtonLink>
                ) : null}
              </div>
            </>
          ) : (
            <p className="portal-muted">
              {group.key === "failed"
                ? "Esta venta no se facturó. Revisá el motivo arriba."
                : payment.invoice?.status === "PENDING_CONFIRMATION"
                  ? "La factura espera tu confirmación."
                  : "La factura todavía no se emitió. Aparece acá apenas ARCA la autorice."}
            </p>
          )}
          {!number && payment.invoice?.status === "PENDING_CONFIRMATION" ? (
            <ButtonLink to="/portal-cliente/comprobantes?estado=para-confirmar" variant="primary">
              Ir a confirmar
            </ButtonLink>
          ) : null}
        </Card>
      </div>

      <section className="portal-section" aria-labelledby="payment-history-title">
        <div className="portal-section__header">
          <h2 id="payment-history-title">Historial</h2>
        </div>
        {payment.events.length ? (
          <ol className="portal-timeline">
            {payment.events.map((event) => (
              <li key={event.id}>
                <span className="portal-mono portal-muted">{formatArgentinaDateTime(event.createdAt)}</span>
                <span>
                  <strong>{getPaymentEventLabel(event.type)}</strong>
                  {event.message ? <span className="portal-muted"> · {event.message}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="portal-muted">Todavía no hay movimientos registrados.</p>
        )}
      </section>
    </div>
  );
}
