import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { ApiError, apiBlobRequest, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

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
  const navigate = useNavigate();
  const { invalidateSession, token } = useTenantAuth();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfErrorMessage, setPdfErrorMessage] = useState("");

  const handleUnauthorized = useCallback(() => {
    invalidateSession();
    navigate("/portal-cliente/login", { replace: true });
  }, [invalidateSession, navigate]);

  const loadPayment = useCallback(async () => {
    if (!id || !token) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      setPayment(await apiRequest<PaymentDetail>(`/portal/payments/${id}`, { token, skipAuthHandling: true }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setErrorMessage(getApiErrorMessage(error, "No se pudo cargar el pago."));
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized, id, token]);

  useEffect(() => { void loadPayment(); }, [loadPayment]);

  async function downloadPdf() {
    if (!id || !token) return;
    setIsLoadingPdf(true);
    setPdfErrorMessage("");
    try {
      const blob = await apiBlobRequest(`/portal/payments/${id}/pdf?download=true`, { token, skipAuthHandling: true });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `comprobante-${payment?.cbte_nro ?? id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setPdfErrorMessage(getApiErrorMessage(error, "No se pudo descargar el PDF."));
    } finally {
      setIsLoadingPdf(false);
    }
  }

  return (
    <main className="client-main client-payment-detail-page">
      <header className="app-topbar">
        <div><Link to="/portal-cliente/pagos" className="eyebrow">Volver a pagos</Link><strong>{payment?.cbte_nro ?? (id ? `Pago ${id}` : "Detalle del pago")}</strong><span>Informacion fiscal y trazabilidad de la operacion.</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadPayment()} disabled={isLoading}><AppIcon name="refresh" /><span>Actualizar</span></button>
      </header>

      {isLoading ? <section className="panel"><div className="panel-state"><strong>Cargando pago...</strong></div></section>
        : errorMessage ? <section className="panel"><div className="panel-state panel-state--danger"><strong>No pudimos cargar el pago</strong><span>{errorMessage}</span><button type="button" className="secondary-button" onClick={() => void loadPayment()}>Reintentar</button></div></section>
          : payment ? <>
            <section className="content-grid">
              <article className="panel payment-detail-card">
                <span className="eyebrow">Resumen</span><h2>{formatCurrency(payment.amount)}</h2>
                <div className="payment-detail-list">
                  <div><span>Estado</span><strong>{payment.status.replace(/_/g, " ")}</strong></div>
                  <div><span>Fecha</span><strong>{formatDateTime(payment.date_approved ?? payment.createdAt)}</strong></div>
                  <div><span>Medio de pago</span><strong>{payment.payment_method_id ?? payment.provider}</strong></div>
                  <div><span>Cliente</span><strong>{payment.customer ?? "Consumidor final"}</strong></div>
                  <div><span>Documento</span><strong>{payment.customer_doc_number ? `${payment.customer_doc_type ?? ""} ${payment.customer_doc_number}`.trim() : "Sin documento"}</strong></div>
                  <div><span>ID proveedor</span><strong>{payment.provider_payment_id ?? "Sin dato"}</strong></div>
                </div>
              </article>
              <article className="panel accent-panel">
                <span className="eyebrow">Comprobante</span><h2>{payment.cbte_nro ?? "Pendiente"}</h2>
                <div className="payment-detail-list">
                  <div><span>CAE</span><strong>{payment.cae ?? "Todavia no emitido"}</strong></div>
                  <div><span>Vencimiento CAE</span><strong>{payment.cae_vto ? formatDateTime(payment.cae_vto) : "Sin dato"}</strong></div>
                  <div><span>Punto de venta</span><strong>{payment.pto_vta ?? "Sin dato"}</strong></div>
                  <div><span>Tipo</span><strong>{payment.cbte_tipo ?? "Sin dato"}</strong></div>
                </div>
                {payment.cae ? <button type="button" className="primary-button" disabled={isLoadingPdf} onClick={() => void downloadPdf()}><AppIcon name="download" />{isLoadingPdf ? "Preparando PDF..." : "Descargar PDF"}</button> : <p className="client-empty-state">El PDF estara disponible cuando ARCA emita el comprobante.</p>}
                {pdfErrorMessage ? <p className="form-error">{pdfErrorMessage}</p> : null}
                {payment.error ? <div className="panel-state panel-state--danger"><strong>Error registrado</strong><span>{payment.error}</span></div> : null}
              </article>
            </section>
            <section className="panel payment-events-panel">
              <div className="panel-heading"><div><span className="eyebrow">Trazabilidad</span><h2>Actividad del pago</h2></div></div>
              {payment.events.length ? <div className="payment-events-list">{payment.events.map((event) => <article className="payment-event-card" key={event.id}><div className="payment-event-card__header"><strong>{event.type.replace(/_/g, " ")}</strong><span>{formatDateTime(event.createdAt)}</span></div><p>{event.message}</p></article>)}</div> : <div className="panel-state"><strong>Sin eventos registrados</strong></div>}
            </section>
          </> : null}
    </main>
  );
}
