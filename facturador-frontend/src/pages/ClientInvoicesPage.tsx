import { useState, type FormEvent } from "react";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { getPortalErrorMessage, usePortalApi, usePortalQuery } from "@/hooks/usePortalResource";
import { saveBlobAsFile } from "@/lib/portalApi";
import {
  argentinaLocalInputToIso,
  formatArgentinaDateTime,
  formatCurrency,
  formatDateTime,
  toArgentinaLocalInput,
} from "@/lib/formatters";

type InvoiceStatus = "DRAFT" | "PENDING_CONFIRMATION" | "QUEUED" | "ISSUING" | "ISSUED" | "FAILED";
type InvoiceEvent = { id: string; type: string; message: string | null; payloadJson: string | null; createdAt: string };
type Invoice = {
  id: string;
  type: "INVOICE" | "CREDIT_NOTE";
  source: string;
  status: InvoiceStatus | string;
  amount: number;
  currency: string;
  customer: string | null;
  cae: string | null;
  cbteNro: string | null;
  error: string | null;
  createdAt: string;
  creditNotes: Array<{ id: string; status: string; cbteNro: string | null }>;
  events?: InvoiceEvent[];
};
type InvoicesResponse = { items: Invoice[]; pagination: { total: number } };
type Settings = { mode: "automatic" | "confirmation"; policy: { entitlements?: Record<string, boolean> } | null };
type InvoicesData = { items: Invoice[]; settings: Settings };

const MAX_SCHEDULE_DAYS = 30;
const emptyManualForm = { amount: "", customer: "", customerDocType: "CUIT", customerDocNumber: "" };

const statusPresentation: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Borrador", tone: "muted" },
  PENDING_CONFIRMATION: { label: "Pendiente de confirmar", tone: "warning" },
  QUEUED: { label: "En cola de emisión", tone: "info" },
  ISSUING: { label: "Emitiendo", tone: "info" },
  ISSUED: { label: "Emitido", tone: "success" },
  FAILED: { label: "Con error", tone: "danger" },
};

const sourceLabels: Record<string, string> = {
  AUTOMATIC: "Venta POS",
  CONFIRMATION: "Venta POS con confirmación",
  MANUAL: "Manual",
  OCR: "Desde documento",
};

function getStatusPresentation(status: string) {
  return statusPresentation[status] ?? { label: "En proceso", tone: "muted" };
}

/** Horario de emisión programada, si el backend lo registró en los eventos. */
function getScheduledIssueAt(invoice: Invoice) {
  for (const event of invoice.events ?? []) {
    if (!event.payloadJson) continue;
    try {
      const payload = JSON.parse(event.payloadJson) as { kind?: string; scheduledAt?: string };
      if (payload.kind === "scheduled_issue" && payload.scheduledAt) return payload.scheduledAt;
    } catch {
      // payload no JSON: se ignora
    }
  }
  return null;
}

function scheduleBounds() {
  const now = new Date();
  const min = new Date(now.getTime() + 60_000);
  const max = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
  return { min: toArgentinaLocalInput(min), max: toArgentinaLocalInput(max), minDate: min, maxDate: max };
}

export function ClientInvoicesPage() {
  const { user } = useTenantAuth();
  const api = usePortalApi();
  const { data, setData, isLoading, isRefreshing, errorMessage: loadError, reload } = usePortalQuery<InvoicesData>(
    "invoices",
    async (portal, signal) => {
      const [list, settings] = await Promise.all([
        portal.request<InvoicesResponse>("/portal/invoices?pageSize=100", { signal }),
        portal.request<Settings>("/portal/invoices/settings", { signal }),
      ]);
      return { items: list.items, settings };
    },
    { fallbackErrorMessage: "No pudimos cargar los comprobantes. Reintentá." },
  );

  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [manual, setManual] = useState(emptyManualForm);
  const [manualError, setManualError] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [scheduleError, setScheduleError] = useState("");

  const items = data?.items ?? [];
  const settings = data?.settings ?? null;
  const entitlements = settings?.policy?.entitlements ?? {};
  const canManage = user?.role === "owner" || user?.role === "admin";
  const canConfirm = canManage || user?.role === "approver";

  function resetFeedback() {
    setActionError("");
    setSuccessMessage("");
  }

  async function runAction(path: string, id: string, body: unknown, successText: string) {
    setPending(id);
    resetFeedback();
    try {
      await api.request(path, { method: "POST", body });
      setSuccessMessage(successText);
      await reload();
      return true;
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos completar la acción. Reintentá."));
      return false;
    } finally {
      setPending(null);
    }
  }

  async function createManual(event: FormEvent) {
    event.preventDefault();
    setPending("manual");
    setManualError("");
    resetFeedback();
    try {
      await api.request("/portal/invoices/manual", {
        method: "POST",
        body: { ...manual, amount: Number(manual.amount), currency: "ARS" },
      });
      // Solo se limpia el formulario si la factura se creó.
      setManual(emptyManualForm);
      setSuccessMessage("Listo, creamos la factura. La emisión en ARCA se procesa en unos minutos.");
      await reload();
    } catch (error) {
      setManualError(getPortalErrorMessage(error, "No pudimos crear la factura. Revisá los datos y reintentá."));
    } finally {
      setPending(null);
    }
  }

  async function changeMode(mode: "automatic" | "confirmation") {
    setPending("settings");
    resetFeedback();
    try {
      await api.request("/portal/invoices/settings", { method: "PUT", body: { mode } });
      setData((current) => (current ? { ...current, settings: { ...current.settings, mode } } : current));
      setSuccessMessage(mode === "confirmation"
        ? "Listo, las nuevas ventas van a esperar tu confirmación antes de emitirse."
        : "Listo, las nuevas ventas se van a facturar automáticamente.");
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos guardar la modalidad. Reintentá."));
    } finally {
      setPending(null);
    }
  }

  async function downloadPdf(invoice: Invoice) {
    setPending(invoice.id);
    resetFeedback();
    try {
      const blob = await api.requestBlob(`/portal/invoices/${invoice.id}/pdf`);
      saveBlobAsFile(blob, `comprobante-${invoice.cbteNro ?? invoice.id}.pdf`);
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos descargar el PDF. Reintentá."));
    } finally {
      setPending(null);
    }
  }

  function openSchedule(invoiceId: string) {
    setCancelId(null);
    setScheduleError("");
    setScheduleId(invoiceId);
  }

  function closeSchedule() {
    setScheduleId(null);
    setScheduleError("");
  }

  async function confirmSchedule(invoiceId: string) {
    const draft = scheduleDrafts[invoiceId] ?? "";
    const issueAt = argentinaLocalInputToIso(draft);
    const { minDate, maxDate } = scheduleBounds();
    if (!issueAt) {
      setScheduleError("Elegí la fecha y la hora de emisión.");
      return;
    }
    const issueDate = new Date(issueAt);
    if (issueDate < minDate || issueDate > maxDate) {
      setScheduleError(`Elegí un horario entre ahora y los próximos ${MAX_SCHEDULE_DAYS} días.`);
      return;
    }
    setScheduleError("");
    const ok = await runAction(
      `/portal/invoices/${invoiceId}/confirm`,
      invoiceId,
      { issueAt },
      `Listo, la emisión quedó programada para el ${formatArgentinaDateTime(issueAt)} (hora de Argentina).`,
    );
    if (ok) {
      setScheduleId(null);
      setScheduleDrafts((current) => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
    }
  }

  async function requestCreditNote(invoiceId: string) {
    const ok = await runAction(
      `/portal/invoices/${invoiceId}/credit-note`,
      invoiceId,
      { confirmation },
      "Pedimos la nota de crédito. La vas a ver en la lista cuando ARCA la emita.",
    );
    if (ok) {
      setCancelId(null);
      setConfirmation("");
    }
  }

  const bounds = scheduleBounds();

  return (
    <div className="client-main client-invoices-page">
      <header className="app-topbar">
        <div>
          <strong>Comprobantes</strong>
          <span>Facturas, confirmaciones y notas de crédito de tu empresa.</span>
        </div>
        <button type="button" className="secondary-button" onClick={() => void reload()} disabled={isLoading || isRefreshing}>
          {isRefreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {loadError ? (
        <section className="section-table__state section-table__state--danger" role="alert">
          <span>{loadError}</span>
          <button type="button" className="section-button" onClick={() => void reload()}>Reintentar</button>
        </section>
      ) : null}
      {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
      {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}

      <section className="panel client-invoice-settings">
        <div>
          <strong>Modalidad para nuevas ventas POS</strong>
          <p>Con confirmación, no se emite nada hasta que un usuario autorizado apruebe el comprobante.</p>
        </div>
        <select
            aria-label="Modalidad de facturación"
            value={settings?.mode ?? "automatic"}
            disabled={!canManage || pending === "settings" || !settings}
            onChange={(event) => void changeMode(event.target.value as "automatic" | "confirmation")}
          >
            <option value="automatic">Automática</option>
            {entitlements.clientApproval ? <option value="confirmation">Con confirmación</option> : null}
          </select>
      </section>

      {canManage && entitlements.manualInvoicing ? (
        <form className="panel client-manual-invoice" onSubmit={(event) => void createManual(event)}>
          <div className="section-subheading">
            <h2>Nueva factura manual</h2>
            <p>La emisión en ARCA se procesa en segundo plano: la vas a ver en la lista en unos minutos.</p>
          </div>
          <div className="client-profile-form__grid">
            <label className="field">
              <span>Importe *</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={manual.amount}
                onChange={(event) => setManual((value) => ({ ...value, amount: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Cliente</span>
              <input value={manual.customer} onChange={(event) => setManual((value) => ({ ...value, customer: event.target.value }))} />
            </label>
            <label className="field">
              <span>Tipo de documento</span>
              <select value={manual.customerDocType} onChange={(event) => setManual((value) => ({ ...value, customerDocType: event.target.value }))}>
                <option value="CUIT">CUIT</option>
                <option value="DNI">DNI</option>
                <option value="CONSUMIDOR_FINAL">Consumidor final</option>
              </select>
            </label>
            <label className="field">
              <span>Documento</span>
              <input
                inputMode="numeric"
                value={manual.customerDocNumber}
                onChange={(event) => setManual((value) => ({ ...value, customerDocNumber: event.target.value.replace(/\D/g, "") }))}
              />
            </label>
          </div>
          {manualError ? <p className="form-error" role="alert">{manualError}</p> : null}
          <button type="submit" className="primary-button" disabled={pending === "manual"}>
            {pending === "manual" ? "Creando…" : "Crear y emitir"}
          </button>
        </form>
      ) : null}

      <section className="section-table-card section-table-card--scrollable">
        <div className="section-table client-invoices-table">
          <div className="section-table__head">
            <span>Fecha</span>
            <span>Comprobante</span>
            <span>Origen</span>
            <span>Cliente</span>
            <span>Importe</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          {isLoading ? (
            <div className="section-table__state">Cargando comprobantes…</div>
          ) : items.length ? items.map((invoice) => {
            const status = getStatusPresentation(invoice.status);
            const scheduledAt = invoice.status === "QUEUED" ? getScheduledIssueAt(invoice) : null;
            const isPendingRow = pending === invoice.id;
            return (
              <div className="section-table__row" key={invoice.id}>
                <span>{formatDateTime(invoice.createdAt)}</span>
                <strong>{invoice.cbteNro ?? (invoice.type === "CREDIT_NOTE" ? "Nota de crédito sin número" : "Factura sin número")}</strong>
                <span>{sourceLabels[invoice.source] ?? "Otro origen"}</span>
                <span>{invoice.customer ?? "Consumidor final"}</span>
                <span>{formatCurrency(invoice.amount)}</span>
                <span>
                  <small className={`status-pill status-pill--${scheduledAt ? "info" : status.tone}`}>
                    {scheduledAt ? "Programado" : status.label}
                  </small>
                  {scheduledAt ? <small className="client-invoice-schedule-note"> Se emite el {formatArgentinaDateTime(scheduledAt)}</small> : null}
                </span>
                <span className="section-row-actions">
                  {invoice.status === "PENDING_CONFIRMATION" && canConfirm ? (
                    <>
                      <button
                        type="button"
                        className="section-mini-button"
                        disabled={isPendingRow}
                        onClick={() => void runAction(`/portal/invoices/${invoice.id}/confirm`, invoice.id, undefined, "Listo, el comprobante quedó en cola para emitirse en ARCA.")}
                      >
                        Emitir ahora
                      </button>
                      <button type="button" className="section-mini-button" disabled={isPendingRow} onClick={() => openSchedule(invoice.id)}>
                        Programar
                      </button>
                    </>
                  ) : null}
                  {invoice.status === "ISSUED" ? (
                    <button type="button" className="section-mini-button" disabled={isPendingRow} onClick={() => void downloadPdf(invoice)}>PDF</button>
                  ) : null}
                  {invoice.type === "INVOICE" && invoice.status === "ISSUED" && canManage && entitlements.creditNotes && !invoice.creditNotes.length ? (
                    <button type="button" className="section-mini-button" onClick={() => { closeSchedule(); setConfirmation(""); setCancelId(invoice.id); }}>Anular</button>
                  ) : null}
                </span>
                {scheduleId === invoice.id ? (
                  <div className="client-invoice-cancel" style={{ background: "#f3f7fd", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label className="field">
                      <span>Fecha y hora de emisión (hora de Argentina)</span>
                      <input
                        type="datetime-local"
                        min={bounds.min}
                        max={bounds.max}
                        value={scheduleDrafts[invoice.id] ?? ""}
                        onChange={(event) => {
                          const { value } = event.target;
                          setScheduleDrafts((current) => ({ ...current, [invoice.id]: value }));
                          setScheduleError("");
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!scheduleDrafts[invoice.id] || isPendingRow}
                      onClick={() => void confirmSchedule(invoice.id)}
                    >
                      {isPendingRow ? "Programando…" : "Confirmar horario"}
                    </button>
                    <button type="button" className="section-mini-button" disabled={isPendingRow} onClick={closeSchedule}>Cancelar</button>
                    {scheduleError ? <p className="form-error" role="alert" style={{ flexBasis: "100%", margin: 0 }}>{scheduleError}</p> : null}
                  </div>
                ) : null}
                {cancelId === invoice.id ? (
                  <div className="client-invoice-cancel" style={{ flexWrap: "wrap" }}>
                    <label className="field">
                      <span>Para emitir la nota de crédito, escribí ANULAR</span>
                      <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="ANULAR" />
                    </label>
                    <button
                      type="button"
                      className="secondary-button secondary-button--danger"
                      disabled={confirmation !== "ANULAR" || isPendingRow}
                      onClick={() => void requestCreditNote(invoice.id)}
                    >
                      Confirmar nota de crédito
                    </button>
                    <button type="button" className="section-mini-button" disabled={isPendingRow} onClick={() => { setCancelId(null); setConfirmation(""); }}>Cancelar</button>
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <div className="section-table__state">Todavía no hay comprobantes. Cuando se facture la primera venta, la vas a ver acá.</div>
          )}
        </div>
      </section>
    </div>
  );
}
