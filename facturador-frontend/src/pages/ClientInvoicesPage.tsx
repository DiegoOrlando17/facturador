import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { SelectField, TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { FiscalNumber, Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { getPortalErrorMessage, usePortalApi, usePortalQuery, usePortalResource } from "@/hooks/usePortalResource";
import { isValidCuit } from "@/lib/fiscalLabels";
import { argentinaLocalInputToIso, formatArgentinaDateTime, toArgentinaLocalInput } from "@/lib/formatters";
import {
  formatShortDateTime,
  getInvoiceCustomerLabel,
  getInvoiceDisplayState,
  getInvoiceNumberLabel,
  getScheduledIssueAt,
  INVOICE_VIEWS,
  type InvoiceView,
  type PortalInvoice,
} from "@/lib/portalInvoices";
import { useTenantCan } from "@/lib/tenantPermissions";

type InvoicesResponse = {
  items: PortalInvoice[];
  view: InvoiceView;
  counts: Record<InvoiceView, number>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
type Settings = { mode: "automatic" | "confirmation"; policy: { entitlements?: Record<string, boolean> } | null };

const PAGE_SIZE = 20;
const MAX_SCHEDULE_DAYS = 30;
const BASE = "/portal-cliente/comprobantes";

/* Modalidad ------------------------------------------------------------------ */

function ModeSwitch({ settings, canManage, onChange, saving }: { settings: Settings | null; canManage: boolean; onChange: (mode: Settings["mode"]) => void; saving: boolean }) {
  const mode = settings?.mode ?? "automatic";
  const allowsConfirmation = Boolean(settings?.policy?.entitlements?.clientApproval);
  const options: { value: Settings["mode"]; label: string; disabled: boolean }[] = [
    { value: "automatic", label: "Automática", disabled: false },
    { value: "confirmation", label: "Con confirmación", disabled: !allowsConfirmation },
  ];
  return (
    <section className="portal-mode" aria-labelledby="portal-mode-title">
      <div className="portal-mode__text">
        <strong id="portal-mode-title">
          {mode === "confirmation" ? "Las ventas nuevas esperan tu confirmación" : "Las ventas nuevas se facturan solas"}
        </strong>
        <span>
          {mode === "confirmation"
            ? "No se emite nada en ARCA hasta que alguien de tu equipo lo confirme."
            : "Cada venta de Mercado Pago se emite en ARCA apenas la leemos."}
          {settings && !settings.policy ? " Para cambiar la modalidad, tu plan tiene que estar activo." : null}
          {settings?.policy && !allowsConfirmation ? " La confirmación previa está disponible desde el plan Control." : null}
        </span>
      </div>
      <div className="portal-segmented" role="radiogroup" aria-labelledby="portal-mode-title">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            className="portal-segmented__option"
            disabled={!canManage || !settings || saving || option.disabled}
            onClick={() => mode !== option.value && onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/* Factura manual --------------------------------------------------------------- */

const emptyManual = { amount: "", customer: "", customerDocType: "", customerDocNumber: "" };

function ManualInvoiceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const api = usePortalApi();
  const toast = useToast();
  const [form, setForm] = useState(emptyManual);
  const [error, setError] = useState("");
  const [docError, setDocError] = useState("");
  const [saving, setSaving] = useState(false);

  function validateDoc() {
    if (form.customerDocType === "CUIT" && !isValidCuit(form.customerDocNumber)) return "Revisá el CUIT: no es válido.";
    if (form.customerDocType === "DNI" && !/^\d{7,8}$/.test(form.customerDocNumber)) return "El DNI tiene que tener 7 u 8 dígitos.";
    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validateDoc();
    setDocError(invalid);
    if (invalid) return;
    setSaving(true);
    setError("");
    try {
      await api.request("/portal/invoices/manual", { method: "POST", body: { ...form, amount: Number(form.amount), currency: "ARS" } });
      setForm(emptyManual);
      toast.success("Factura creada", { description: "La emitimos en ARCA en unos minutos." });
      onCreated();
      onClose();
    } catch (cause) {
      // El formulario se conserva para que puedas corregir y reintentar.
      setError(getPortalErrorMessage(cause, "No pudimos crear la factura. Revisá los datos y reintentá."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva factura manual"
      description="Para ventas que no pasaron por Mercado Pago. La emitimos en ARCA en unos minutos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="manual-invoice-form" loading={saving} loadingLabel="Creando…">
            Crear y emitir
          </Button>
        </>
      }
    >
      <form id="manual-invoice-form" className="portal-form" onSubmit={(event) => void submit(event)}>
        <TextField
          label="Importe"
          required
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          leading="$"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
        />
        <TextField label="Cliente" optional value={form.customer} placeholder="Consumidor final" onChange={(event) => setForm({ ...form, customer: event.target.value })} />
        <div className="portal-form__row">
          <SelectField
            label="Documento"
            optional
            value={form.customerDocType}
            onChange={(event) => {
              setDocError("");
              setForm({ ...form, customerDocType: event.target.value, customerDocNumber: event.target.value ? form.customerDocNumber : "" });
            }}
            options={[
              { value: "", label: "Sin documento" },
              { value: "CUIT", label: "CUIT" },
              { value: "DNI", label: "DNI" },
            ]}
          />
          {form.customerDocType ? (
            <TextField
              label={form.customerDocType === "CUIT" ? "Número de CUIT" : "Número de DNI"}
              required
              inputMode="numeric"
              value={form.customerDocNumber}
              error={docError || undefined}
              onChange={(event) => {
                setDocError("");
                setForm({ ...form, customerDocNumber: event.target.value.replace(/\D/g, "") });
              }}
            />
          ) : null}
        </div>
        <p className="portal-form__hint">El documento es opcional y figura en el PDF del comprobante.</p>
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
      </form>
    </Modal>
  );
}

/* Programar emisión ------------------------------------------------------------ */

function scheduleBounds() {
  const now = new Date();
  const min = new Date(now.getTime() + 5 * 60_000);
  const max = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
  return { min: toArgentinaLocalInput(min), max: toArgentinaLocalInput(max), minDate: min, maxDate: max };
}

function ScheduleModal({ invoice, onClose, onDone }: { invoice: PortalInvoice | null; onClose: () => void; onDone: () => void }) {
  const api = usePortalApi();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const bounds = scheduleBounds();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const issueAt = argentinaLocalInputToIso(value);
    if (!issueAt) return setError("Elegí la fecha y la hora.");
    const date = new Date(issueAt);
    if (date < bounds.minDate || date > bounds.maxDate) return setError(`Elegí un horario entre dentro de 5 minutos y los próximos ${MAX_SCHEDULE_DAYS} días.`);
    setSaving(true);
    setError("");
    try {
      await api.request(`/portal/invoices/${invoice.id}/confirm`, { method: "POST", body: { issueAt } });
      toast.success("Emisión programada", { description: `Se emite el ${formatArgentinaDateTime(issueAt)}.` });
      setValue("");
      onDone();
      onClose();
    } catch (cause) {
      setError(getPortalErrorMessage(cause, "No pudimos programar la emisión. Reintentá."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(invoice)}
      onClose={onClose}
      size="sm"
      title="Programar emisión"
      description={invoice ? <>Venta por <Money value={invoice.amount} currency={invoice.currency ?? "ARS"} />. Hora de Argentina.</> : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="schedule-form" loading={saving} loadingLabel="Programando…">
            Programar
          </Button>
        </>
      }
    >
      <form id="schedule-form" className="portal-form" noValidate onSubmit={(event) => void submit(event)}>
        <TextField
          label="Fecha y hora de emisión"
          type="datetime-local"
          required
          min={bounds.min}
          max={bounds.max}
          value={value}
          error={error || undefined}
          hint={`Hasta ${MAX_SCHEDULE_DAYS} días hacia adelante.`}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
        />
      </form>
    </Modal>
  );
}

/* Página ----------------------------------------------------------------------- */

export function ClientInvoicesPage() {
  const api = usePortalApi();
  const toast = useToast();
  const confirm = useConfirm();
  const can = useTenantCan();
  const [params, setParams] = useSearchParams();
  const activeView = INVOICE_VIEWS.find((item) => item.slug === params.get("estado"))?.view ?? "all";
  const page = Math.max(1, Number(params.get("pagina")) || 1);

  const list = usePortalQuery<InvoicesResponse>(
    `invoices:${activeView}:${page}`,
    (portal, signal) => portal.request<InvoicesResponse>(`/portal/invoices?view=${activeView}&page=${page}&pageSize=${PAGE_SIZE}`, { signal }),
    { fallbackErrorMessage: "No pudimos cargar las facturas." },
  );
  const settings = usePortalResource<Settings>("/portal/invoices/settings");
  const [savingMode, setSavingMode] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [scheduling, setScheduling] = useState<PortalInvoice | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const canManage = can("tenant.manageInvoices");
  const canConfirm = can("tenant.confirmInvoices");
  const entitlements = settings.data?.policy?.entitlements ?? {};

  function setView(view: InvoiceView) {
    const slug = INVOICE_VIEWS.find((item) => item.view === view)?.slug;
    setParams(view === "all" || !slug ? {} : { estado: slug });
  }

  function setPage(next: number) {
    const nextParams = new URLSearchParams(params);
    if (next <= 1) nextParams.delete("pagina");
    else nextParams.set("pagina", String(next));
    setParams(nextParams);
  }

  async function changeMode(mode: Settings["mode"]) {
    setSavingMode(true);
    try {
      await api.request("/portal/invoices/settings", { method: "PUT", body: { mode } });
      settings.setData((current) => (current ? { ...current, mode } : current));
      toast.success(mode === "confirmation" ? "Listo: las ventas nuevas esperan tu confirmación." : "Listo: las ventas nuevas se facturan solas.");
    } catch (cause) {
      toast.error("No pudimos cambiar la modalidad", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setSavingMode(false);
    }
  }

  async function issueNow(invoice: PortalInvoice) {
    const ok = await confirm({
      title: "¿Emitir esta factura ahora?",
      description: "La mandamos a ARCA en este momento. Una vez emitida, solo se puede anular con una nota de crédito.",
      confirmLabel: "Emitir ahora",
    });
    if (!ok) return;
    setConfirmingId(invoice.id);
    try {
      await api.request(`/portal/invoices/${invoice.id}/confirm`, { method: "POST" });
      toast.success("Factura en camino a ARCA", { description: "En unos segundos la ves emitida." });
      await list.reload();
    } catch (cause) {
      toast.error("No pudimos emitir la factura", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setConfirmingId(null);
    }
  }

  const columns: DataTableColumn<PortalInvoice>[] = [
    { id: "date", header: "Fecha", width: "8rem", cell: (row) => <span className="portal-mono">{formatShortDateTime(row.issuedAt ?? row.createdAt)}</span> },
    {
      id: "number",
      header: "Comprobante",
      primary: true,
      cell: (row) => {
        const number = getInvoiceNumberLabel(row);
        const state = getInvoiceDisplayState(row);
        const note = row.creditNotes?.[0];
        const noteNumber = note ? getInvoiceNumberLabel(note) : null;
        return (
          <span className="portal-invoice-number">
            {number ? <FiscalNumber kind="plain" value={number} className={state.key === "voided" ? "portal-voided" : undefined} /> : <span className="portal-muted">Sin emitir</span>}
            {noteNumber ? <small className="portal-invoice-number__note">{noteNumber}</small> : null}
          </span>
        );
      },
    },
    { id: "customer", header: "Cliente", hideBelow: "md", cell: (row) => getInvoiceCustomerLabel(row) },
    {
      id: "amount",
      header: "Importe",
      align: "end",
      numeric: true,
      cell: (row) => <Money value={row.amount} currency={row.currency ?? "ARS"} className={getInvoiceDisplayState(row).key === "voided" ? "portal-voided" : undefined} />,
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => {
        const state = getInvoiceDisplayState(row);
        const scheduledAt = getScheduledIssueAt(row);
        return (
          <span className="portal-invoice-status">
            <StatusBadge tone={scheduledAt ? "info" : state.tone} stamp={state.stamp}>
              {scheduledAt ? "Programada" : state.label}
            </StatusBadge>
            {scheduledAt ? <small className="portal-muted">{formatShortDateTime(scheduledAt)}</small> : null}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: <span className="ui-sr-only">Acciones</span>,
      mobileLabel: "Acciones",
      align: "end",
      cell: (row) => {
        const state = getInvoiceDisplayState(row);
        if (state.key === "pending" && canConfirm) {
          return (
            <span className="portal-row-actions">
              <Button size="sm" variant="secondary" onClick={() => setScheduling(row)} disabled={confirmingId === row.id}>
                Programar
              </Button>
              <Button size="sm" variant="primary" onClick={() => void issueNow(row)} loading={confirmingId === row.id} loadingLabel="Emitiendo…">
                Emitir ahora
              </Button>
            </span>
          );
        }
        if (state.key === "issued" || state.key === "voided") return <Link className="portal-link" to={`${BASE}/${row.id}`}>Ver ticket</Link>;
        if (state.key === "failed") return <Link className="portal-link" to={`${BASE}/${row.id}`}>Ver motivo</Link>;
        return null;
      },
    },
  ];

  const counts = list.data?.counts;
  const pagination = list.data?.pagination;
  const viewEmpty: Record<InvoiceView, { title: string; description: string }> = {
    all: { title: "Todavía no hay facturas", description: "Cuando entren ventas de Mercado Pago las vas a ver acá." },
    pending: { title: "Nada para confirmar", description: "Las ventas que esperan tu OK aparecen acá." },
    issued: { title: "Sin facturas emitidas", description: "Las facturas con CAE aparecen acá." },
    failed: { title: "Sin errores", description: "Ninguna factura fue rechazada por ARCA." },
    voided: { title: "Sin anulaciones", description: "Las facturas anuladas con nota de crédito aparecen acá." },
  };

  return (
    <div className="portal-page portal-invoices">
      <PageHeader
        title="Facturas"
        description="Todo lo que emitiste, lo que espera tu OK y lo que hay que corregir."
        actions={
          canManage && entitlements.manualInvoicing ? (
            <Button variant="primary" iconLeft="plus" onClick={() => setManualOpen(true)}>
              Factura manual
            </Button>
          ) : null
        }
      />

      <ModeSwitch settings={settings.data} canManage={canManage} onChange={(mode) => void changeMode(mode)} saving={savingMode} />

      <div className="portal-chips" role="group" aria-label="Filtrar facturas">
        {INVOICE_VIEWS.map((item) => {
          const count = counts?.[item.view];
          const active = item.view === activeView;
          return (
            <button key={item.view} type="button" className="portal-chip" aria-pressed={active} onClick={() => setView(item.view)}>
              {item.label}
              {count !== undefined ? <span className={`portal-chip__count${item.view === "pending" && count > 0 ? " portal-chip__count--alert" : ""}`}>{count}</span> : null}
            </button>
          );
        })}
      </div>

      <DataTable
        caption="Facturas"
        columns={columns}
        rows={list.data?.items}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `${BASE}/${row.id}`}
        getRowLabel={(row) => `Ver factura ${getInvoiceNumberLabel(row) ?? "sin emitir"}`}
        isLoading={list.isLoading}
        isRefreshing={list.isRefreshing}
        errorMessage={list.errorMessage}
        onRetry={() => void list.reload()}
        skeletonRows={8}
        empty={viewEmpty[activeView]}
      />

      {pagination && pagination.totalPages > 1 ? (
        <Pagination page={pagination.page} pageCount={pagination.totalPages} totalItems={pagination.total} pageSize={pagination.pageSize} itemLabel="facturas" onPageChange={setPage} disabled={list.isRefreshing} />
      ) : null}

      <ManualInvoiceModal open={manualOpen} onClose={() => setManualOpen(false)} onCreated={() => void list.reload()} />
      <ScheduleModal invoice={scheduling} onClose={() => setScheduling(null)} onDone={() => void list.reload()} />
    </div>
  );
}
