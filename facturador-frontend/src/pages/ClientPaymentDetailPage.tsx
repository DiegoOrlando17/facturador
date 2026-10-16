import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { saveBlobAsFile } from "@/lib/portalApi";
import { formatCurrency, formatDateTime, formatFiscalDate } from "@/lib/formatters";
import { getPaymentEventLabel, getPaymentStatusLabel } from "@/lib/portalStatusLabels";

type PaymentDetail = {
  id: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  payment_method_id: string | null;
  amount: number;
  customer: string | null;
  customer_doc_type: string | null;
  customer_doc_number: string | null;
  date_approved: string | null;
  cae: string | null;
  cae_vto: string | null;
  cbte_nro: string | null;
  cbte_tipo: number | null;
  pto_vta: number | null;
  error: string | null;
  createdAt: string;
  events: Array<{ id: string; type: string; message: string; createdAt: string }>;
  invoice?: { id: string; status: string } | null;
};

export function ClientPaymentDetailPage() {
  const { id } = useParams();
  const api = usePortalApi();
  const { data: payment, isLoading, isRefreshing, errorMessage, reload } = usePortalResource<PaymentDetail>(
    id ? `/portal/payments/${id}` : null,
    { fallbackErrorMessage: "No pudimos cargar la venta. Reintentá." },
  );
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = useState("");

  async function downloadPdf() {
    if (!id) return;
    setIsLoadingPdf(true);
    setPdfErrorMessage("");
    try {
      const blob = await api.requestBlob(`/portal/payments/${id}/pdf?download=true`);
      saveBlobAsFile(blob, `comprobante-${payment?.cbte_nro ?? id}.pdf`);
    } catch (error) {
      setPdfErrorMessage(getPortalErrorMessage(error, "No pudimos descargar el PDF. Reintentá."));
    } finally {
      setIsLoadingPdf(false);
    }
  }

  return (
    <div className="client-main client-payment-detail-page">
      <header className="app-topbar">
        <div>
          <Link to="/portal-cliente/pagos" className="eyebrow">Volver a pagos</Link>
          <strong>{payment?.cbte_nro ?? "Detalle de la venta"}</strong>
          <span>Información fiscal y trazabilidad de la operación.</span>
        </div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void reload()} disabled={isLoading || isRefreshing}>
          <AppIcon name="refresh" /><span>{isRefreshing ? "Actualizando…" : "Actualizar"}</span>
        </button>
      </header>

      {isLoading ? <section className="panel"><div className="panel-state"><strong>Cargando la venta…</strong></div></section>
        : errorMessage ? <section className="panel"><div className="panel-state panel-state--danger"><strong>No pudimos cargar la venta</strong><span>{errorMessage}</span><button type="button" className="secondary-button" onClick={() => void reload()}>Reintentar</button></div></section>
          : payment ? <>
            <section className="content-grid">
              <article className="panel payment-detail-card">
                <span className="eyebrow">Resumen</span><h2>{formatCurrency(payment.amount)}</h2>
                <div className="payment-detail-list">
                  <div><span>Estado</span><strong>{payment.cae ? "Comprobante emitido" : getPaymentStatusLabel(payment.status)}</strong></div>
                  <div><span>Fecha</span><strong>{formatDateTime(payment.date_approved ?? payment.createdAt)}</strong></div>
                  <div><span>Medio de pago</span><strong>{payment.payment_method_id ?? "Mercado Pago"}</strong></div>
                  <div><span>Cliente</span><strong>{payment.customer ?? "Consumidor final"}</strong></div>
                  <div><span>Documento</span><strong>{payment.customer_doc_number ? `${payment.customer_doc_type ?? ""} ${payment.customer_doc_number}`.trim() : "Sin documento"}</strong></div>
                  <div><span>Operación en Mercado Pago</span><strong>{payment.provider_payment_id ?? "Sin dato"}</strong></div>
                </div>
              </article>
              <article className="panel accent-panel">
                <span className="eyebrow">Comprobante</span><h2>{payment.cbte_nro ?? "Pendiente"}</h2>
                <div className="payment-detail-list">
                  <div><span>CAE</span><strong>{payment.cae ?? "Todavía no emitido"}</strong></div>
                  <div><span>Vencimiento del CAE</span><strong>{formatFiscalDate(payment.cae_vto)}</strong></div>
                  <div><span>Punto de venta</span><strong>{payment.pto_vta ?? "Sin dato"}</strong></div>
                  <div><span>Tipo</span><strong>{payment.cbte_tipo ?? "Sin dato"}</strong></div>
                </div>
                {payment.cae ? <button type="button" className="primary-button" disabled={isLoadingPdf} onClick={() => void downloadPdf()}><AppIcon name="download" />{isLoadingPdf ? "Preparando PDF…" : "Descargar PDF"}</button> : <p className="client-empty-state">El PDF va a estar disponible cuando ARCA emita el comprobante.</p>}
                {pdfErrorMessage ? <p className="form-error" role="alert">{pdfErrorMessage}</p> : null}
                {payment.error ? <div className="panel-state panel-state--danger"><strong>Error registrado</strong><span>{payment.error}</span></div> : null}
              </article>
            </section>
            <section className="panel payment-events-panel">
              <div className="panel-heading"><div><span className="eyebrow">Trazabilidad</span><h2>Actividad de la venta</h2></div></div>
              {payment.events.length ? <div className="payment-events-list">{payment.events.map((event) => <article className="payment-event-card" key={event.id}><div className="payment-event-card__header"><strong>{getPaymentEventLabel(event.type)}</strong><span>{formatDateTime(event.createdAt)}</span></div><p>{event.message}</p></article>)}</div> : <div className="panel-state"><strong>Todavía no hay actividad registrada</strong></div>}
            </section>
          </> : null}
    </div>
  );
}
