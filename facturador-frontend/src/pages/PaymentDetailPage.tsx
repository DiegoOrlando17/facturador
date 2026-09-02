import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { useApiResource } from "@/hooks/useApiResource";
import { apiBlobRequest, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

type PaymentDetailResponse = {
  id: string;
  tenantId: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  payment_method_id?: string | null;
  amount: number;
  currency?: string | null;
  customer?: string | null;
  customer_doc_type?: string | null;
  customer_doc_number?: string | null;
  date_approved?: string | null;
  cae?: string | null;
  cae_vto?: string | null;
  cbte_nro?: string | null;
  cbte_tipo?: number | null;
  pto_vta?: number | null;
  pdf_path?: string | null;
  drive_file_link?: string | null;
  sheets_row?: string | null;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    subscriptions: unknown[];
  };
  invoice?: {
    id: string;
    status: string;
    creditNotes?: Array<{ id: string; status: string; cbteNro: string | null; cae: string | null; error: string | null }>;
  } | null;
  events: Array<{
    id: string;
    tenantId: string;
    paymentId: string;
    type: string;
    message: string;
    payloadJson: string | null;
    createdAt: string;
  }>;
};

type ReprocessStep = "auto" | "afip" | "post";

function prettifyStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatPayload(payload: string | null) {
  if (!payload) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export function PaymentDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isDeliveringGoogle, setIsDeliveringGoogle] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [reprocessErrorMessage, setReprocessErrorMessage] = useState<string | null>(null);
  const [reprocessSuccessMessage, setReprocessSuccessMessage] = useState<string | null>(null);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);
  const [isFiscalActionPending, setIsFiscalActionPending] = useState(false);
  const [cancellationConfirmation, setCancellationConfirmation] = useState("");
  const {
    data: payment,
    errorMessage,
    isLoading,
    reload,
  } = useApiResource<PaymentDetailResponse>(`/admin/payments/${id}`, {
    enabled: Boolean(id),
    fallbackErrorMessage: "No se pudo cargar el detalle del pago.",
  });

  async function handleReprocess(step: ReprocessStep) {
    if (!id || !token) {
      setReprocessErrorMessage("No tenemos una sesion o pago valido para reprocesar.");
      return;
    }

    setIsReprocessing(true);
    setReprocessErrorMessage(null);
    setReprocessSuccessMessage(null);

    try {
      await apiRequest(`/admin/payments/${id}/reprocess`, {
        method: "POST",
        token,
        body: { step },
      });

      setReprocessSuccessMessage(`Reproceso ${step} solicitado correctamente.`);
      await reload();
    } catch (error) {
      setReprocessErrorMessage(getApiErrorMessage(error, "No se pudo solicitar el reproceso."));
    } finally {
      setIsReprocessing(false);
    }
  }

  async function handlePdfAction(shouldDownload: boolean) {
    if (!id || !token) {
      setPdfErrorMessage("No tenemos una sesion o pago valido para obtener el PDF.");
      return;
    }

    setIsLoadingPdf(true);
    setPdfErrorMessage(null);

    try {
      const blob = await apiBlobRequest(`/admin/payments/${id}/pdf${shouldDownload ? "?download=true" : ""}`, {
        token,
      });
      const objectUrl = URL.createObjectURL(blob);

      if (shouldDownload) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `payment-${id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }
    } catch (error) {
      setPdfErrorMessage(getApiErrorMessage(error, "No se pudo obtener el PDF del pago."));
    } finally {
      setIsLoadingPdf(false);
    }
  }

  async function handleGoogleDelivery() {
    if (!id || !token) {
      setReprocessErrorMessage("No tenemos una sesion o pago valido para entregar a Google.");
      return;
    }

    setIsDeliveringGoogle(true);
    setReprocessErrorMessage(null);
    setReprocessSuccessMessage(null);

    try {
      const result = await apiRequest<{ queued: boolean; reason?: string }>(`/admin/payments/${id}/deliver-google`, {
        method: "POST",
        token,
      });
      setReprocessSuccessMessage(
        result.queued
          ? "Entrega a Drive y Sheets solicitada correctamente."
          : "El comprobante ya estaba entregado en Drive y Sheets."
      );
      await reload();
    } catch (error) {
      setReprocessErrorMessage(getApiErrorMessage(error, "No se pudo solicitar la entrega a Google."));
    } finally {
      setIsDeliveringGoogle(false);
    }
  }

  async function handleFiscalAction(action: "issue" | "credit-note") {
    if (!id || !token) return;
    setIsFiscalActionPending(true);
    setReprocessErrorMessage(null);
    setReprocessSuccessMessage(null);
    try {
      const result = await apiRequest<{ queued: boolean; status?: string }>(`/admin/payments/${id}/${action}`, {
        method: "POST",
        token,
        body: action === "credit-note" ? { confirmation: cancellationConfirmation } : {},
      });
      setReprocessSuccessMessage(action === "issue"
        ? "Emision fiscal encolada correctamente."
        : result.queued ? "Nota de credito encolada correctamente." : "La nota de credito ya estaba creada o emitida.");
      setCancellationConfirmation("");
      await reload();
    } catch (error) {
      setReprocessErrorMessage(getApiErrorMessage(error, "No se pudo solicitar la accion fiscal."));
    } finally {
      setIsFiscalActionPending(false);
    }
  }

  return (
    <main className="shell shell--app">
      <section className="panel detail-header">
        <div>
          <Link to={payment ? `/tenants/${payment.tenant.slug}` : "/tenants"} className="eyebrow">
            Volver al tenant
          </Link>
          <h2>{payment ? `Pago ${payment.id}` : "Detalle del pago"}</h2>
          <p className="detail-header__copy">
            {payment
              ? `${payment.provider} - ${payment.tenant.name} - ${prettifyStatus(payment.status)}`
              : "Estamos consultando el estado operativo del pago."}
          </p>
        </div>
        <div className="detail-header__actions">
          <button type="button" className="secondary-button" onClick={() => void reload()}>
            Actualizar
          </button>
        </div>
      </section>

      {isLoading ? (
        <section className="panel">
          <div className="panel-state">
            <strong>Cargando pago...</strong>
            <span>Estamos trayendo detalle, tenant y eventos.</span>
          </div>
        </section>
      ) : errorMessage ? (
        <section className="panel">
          <div className="panel-state panel-state--danger">
            <strong>No pudimos cargar el pago</strong>
            <span>{errorMessage}</span>
          </div>
        </section>
      ) : payment ? (
        <>
          <section className="content-grid">
            <article className="panel payment-detail-card">
              <span className="eyebrow">Resumen</span>
              <h2>{formatCurrency(payment.amount)}</h2>
              <div className="tenant-card__grid">
                <div>
                  <span>Estado</span>
                  <strong>{prettifyStatus(payment.status)}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{payment.provider}</strong>
                </div>
                <div>
                  <span>Metodo</span>
                  <strong>{payment.payment_method_id ?? "Sin dato"}</strong>
                </div>
                <div>
                  <span>Creado</span>
                  <strong>{formatDateTime(payment.createdAt)}</strong>
                </div>
              </div>

              <div className="payment-detail-list">
                <div>
                  <span>ID proveedor</span>
                  <strong>{payment.provider_payment_id ?? "Sin dato"}</strong>
                </div>
                <div>
                  <span>Cliente</span>
                  <strong>{payment.customer ?? "Sin cliente informado"}</strong>
                </div>
                <div>
                  <span>Documento</span>
                  <strong>
                    {payment.customer_doc_number
                      ? `${payment.customer_doc_type ?? ""} ${payment.customer_doc_number}`.trim()
                      : "Sin documento"}
                  </strong>
                </div>
                <div>
                  <span>Comprobante</span>
                  <strong>{payment.cbte_nro ?? "Sin comprobante"}</strong>
                </div>
                <div>
                  <span>CAE</span>
                  <strong>{payment.cae ?? "Sin CAE"}</strong>
                </div>
                <div>
                  <span>Sheets row</span>
                  <strong>{payment.sheets_row ?? "Sin fila"}</strong>
                </div>
              </div>
            </article>

            <article className="panel accent-panel">
              <span className="eyebrow">Acciones</span>
              <h2>Reproceso</h2>
              <p className="detail-header__copy">
                Usa estas acciones para reintentar pasos del circuito cuando un pago queda pendiente o fallido.
              </p>
              <PermissionGate
                permission="payments:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol no puede solicitar reprocesos.</span>
                  </div>
                }
              >
                <div className="reprocess-actions">
                  {!payment.cae ? (
                    <button type="button" className="primary-button" disabled={isFiscalActionPending} onClick={() => void handleFiscalAction("issue")}>
                      {isFiscalActionPending ? "Encolando..." : "Emitir ahora"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="primary-button"
                    disabled={isReprocessing}
                    onClick={() => void handleReprocess("auto")}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isReprocessing}
                    onClick={() => void handleReprocess("afip")}
                  >
                    ARCA
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isReprocessing}
                    onClick={() => void handleReprocess("post")}
                  >
                    Postproceso
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={isReprocessing || isDeliveringGoogle}
                    onClick={() => void handleGoogleDelivery()}
                  >
                    {isDeliveringGoogle
                      ? "Encolando..."
                      : payment.cae
                        ? "Subir a Drive y Sheets"
                        : "Registrar error en Sheets"}
                  </button>
                </div>
                {payment.cae ? (
                  <div className="danger-zone-form">
                    <strong>Anulacion fiscal</strong>
                    <span>La anulacion total crea una nota de credito asociada en ARCA. No modifica ni elimina la factura original.</span>
                    {payment.invoice?.creditNotes?.[0] ? (
                      <>
                        <span>{`Nota de credito ${payment.invoice.creditNotes[0].status}${payment.invoice.creditNotes[0].cbteNro ? ` - ${payment.invoice.creditNotes[0].cbteNro}` : ""}`}</span>
                        {payment.invoice.creditNotes[0].error ? <span className="form-error">{payment.invoice.creditNotes[0].error}</span> : null}
                        {payment.invoice.creditNotes[0].status === "FAILED" ? (
                          <>
                            <label className="field">
                              <span>Escribi ANULAR para reintentar</span>
                              <input value={cancellationConfirmation} onChange={(event) => setCancellationConfirmation(event.target.value)} disabled={isFiscalActionPending} />
                            </label>
                            <button type="button" className="secondary-button secondary-button--danger" disabled={isFiscalActionPending || cancellationConfirmation !== "ANULAR"} onClick={() => void handleFiscalAction("credit-note")}>
                              {isFiscalActionPending ? "Encolando..." : "Reintentar nota de credito"}
                            </button>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <label className="field">
                          <span>Escribi ANULAR para confirmar</span>
                          <input value={cancellationConfirmation} onChange={(event) => setCancellationConfirmation(event.target.value)} disabled={isFiscalActionPending} />
                        </label>
                        <button type="button" className="secondary-button secondary-button--danger" disabled={isFiscalActionPending || cancellationConfirmation !== "ANULAR"} onClick={() => void handleFiscalAction("credit-note")}>
                          {isFiscalActionPending ? "Encolando..." : "Crear nota de credito"}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
                {reprocessErrorMessage ? <p className="form-error">{reprocessErrorMessage}</p> : null}
                {reprocessSuccessMessage ? <p className="form-success">{reprocessSuccessMessage}</p> : null}
              </PermissionGate>
              <div className="document-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isLoadingPdf}
                  onClick={() => void handlePdfAction(false)}
                >
                  {isLoadingPdf ? "Preparando PDF..." : "Ver PDF"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isLoadingPdf}
                  onClick={() => void handlePdfAction(true)}
                >
                  Descargar PDF
                </button>
              </div>
              {pdfErrorMessage ? <p className="form-error">{pdfErrorMessage}</p> : null}
              {payment.drive_file_link ? (
                <a href={payment.drive_file_link} target="_blank" rel="noreferrer" className="secondary-button payment-external-link">
                  Ver archivo en Drive
                </a>
              ) : null}
              {payment.error ? (
                <div className="panel-state panel-state--danger">
                  <strong>Error registrado</strong>
                  <span>{payment.error}</span>
                </div>
              ) : null}
            </article>
          </section>

          <section className="panel payment-events-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Trazabilidad</span>
                <h2>Eventos del pago</h2>
              </div>
            </div>

            {payment.events.length > 0 ? (
              <div className="payment-events-list">
                {payment.events.map((event) => (
                  <article key={event.id} className="payment-event-card">
                    <div className="payment-event-card__header">
                      <div>
                        <strong>{prettifyStatus(event.type)}</strong>
                        <span>{formatDateTime(event.createdAt)}</span>
                      </div>
                      <span className="badge badge--muted">{event.id}</span>
                    </div>
                    <p>{event.message}</p>
                    {event.payloadJson ? <pre>{formatPayload(event.payloadJson)}</pre> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="panel-state">
                <strong>Sin eventos registrados</strong>
                <span>Cuando el backend registre actividad del pago, va a aparecer aca.</span>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
