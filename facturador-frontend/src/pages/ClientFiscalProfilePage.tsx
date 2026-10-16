import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { SelectField, TextField } from "@/components/ui/Field";
import { FiscalNumber } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { formatCuit, isValidCuit } from "@/lib/fiscalLabels";
import { formatArgentinaDateTime } from "@/lib/formatters";
import { getStatus } from "@/lib/statusLabels";
import { useTenantCan } from "@/lib/tenantPermissions";

type FiscalProfile = {
  legalName: string | null;
  tradeName: string | null;
  cuit: string | null;
  ivaCondition: string | null;
  fiscalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  approvalStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  reviewNotes: string | null;
  reviewedAt: string | null;
};

type ProfileForm = Omit<FiscalProfile, "approvalStatus" | "reviewNotes" | "reviewedAt"> extends infer T ? { [K in keyof T]: string } : never;

const FIELDS: (keyof ProfileForm)[] = ["legalName", "tradeName", "cuit", "ivaCondition", "fiscalAddress", "contactEmail", "contactPhone", "responsibleName", "responsibleEmail"];
const REQUIRED: (keyof ProfileForm)[] = ["legalName", "cuit", "ivaCondition", "fiscalAddress", "contactEmail"];

/** Condición frente al IVA de quien emite (consumidor final no aplica a un emisor). */
const IVA_OPTIONS = [
  { value: "monotributo", label: "Monotributo" },
  { value: "responsable_inscripto", label: "Responsable inscripto" },
  { value: "exento", label: "Exento" },
];

const STATUS_DETAIL: Record<FiscalProfile["approvalStatus"], string> = {
  DRAFT: "Completá los campos obligatorios y enviá tus datos a revisión.",
  PENDING: "Estamos revisando tus datos. Te avisamos cuando estén aprobados.",
  APPROVED: "Tus datos están aprobados. Si los cambiás, vuelven a revisión.",
  REJECTED: "Revisá las observaciones, corregí los datos y volvé a enviarlos.",
};

function toForm(profile: FiscalProfile | null): ProfileForm {
  return Object.fromEntries(FIELDS.map((field) => [field, String(profile?.[field] ?? "")])) as ProfileForm;
}

function ReadOnlyProfile({ profile }: { profile: FiscalProfile | null }) {
  const rows: [string, ReactNode][] = [
    ["Razón social", profile?.legalName],
    ["Nombre comercial", profile?.tradeName],
    ["CUIT", profile?.cuit ? <FiscalNumber kind="cuit" value={profile.cuit} /> : null],
    ["Condición frente al IVA", IVA_OPTIONS.find((option) => option.value === profile?.ivaCondition)?.label],
    ["Domicilio fiscal", profile?.fiscalAddress],
    ["Email de contacto", profile?.contactEmail],
    ["Teléfono", profile?.contactPhone],
    ["Responsable", profile?.responsibleName],
    ["Email del responsable", profile?.responsibleEmail],
  ];
  return (
    <Card title="Tus datos" description="Tu rol puede verlos pero no cambiarlos.">
      <dl className="portal-detail">
        {rows.map(([label, value]) => (
          <div key={label} className="portal-detail__row">
            <dt>{label}</dt>
            <dd>{value || <span className="portal-muted">Sin dato</span>}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function ClientFiscalProfilePage() {
  const api = usePortalApi();
  const toast = useToast();
  const can = useTenantCan();
  const canEdit = can("tenant.manageProfile");
  const query = usePortalResource<FiscalProfile | null>("/portal/profile", { fallbackErrorMessage: "No pudimos cargar tus datos fiscales." });
  const [form, setForm] = useState<ProfileForm>(toForm(null));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const profile = query.data;

  // Cada carga del servidor reemplaza el formulario con lo guardado.
  useEffect(() => {
    if (query.lastLoadedAt) setForm(toForm(query.data));
  }, [query.lastLoadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const completed = REQUIRED.filter((field) => form[field].trim()).length;
  const hasChanges = useMemo(() => FIELDS.some((field) => form[field] !== String(profile?.[field] ?? "")), [form, profile]);

  function update(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: field === "cuit" ? value.replace(/\D/g, "").slice(0, 11) : value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (form.cuit && !isValidCuit(form.cuit)) nextErrors.cuit = form.cuit.length === 11 ? "El dígito verificador no coincide. Revisalo." : "Tiene que tener 11 dígitos.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const updated = await api.request<FiscalProfile>("/portal/profile", { method: "PUT", body: form });
      query.setData(updated);
      if (updated.approvalStatus === "PENDING") toast.success("Enviamos tus datos a revisión", { description: "Te avisamos cuando estén aprobados." });
      else toast.success("Guardamos el borrador", { description: "Completá los obligatorios para enviarlos a revisión." });
    } catch (cause) {
      setSaveError(getPortalErrorMessage(cause, "No pudimos guardar tus datos. Reintentá."));
    } finally {
      setSaving(false);
    }
  }

  const header = <PageHeader title="Datos fiscales" description="Los datos con los que emitimos tus comprobantes en ARCA." />;

  if (query.errorMessage) {
    return (
      <div className="portal-page">
        {header}
        <ErrorState message={query.errorMessage} onRetry={() => void query.reload()} retrying={query.isRefreshing} />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="portal-page" aria-busy="true">
        {header}
        <Skeleton variant="block" height="24rem" />
      </div>
    );
  }

  const status = profile?.approvalStatus ?? "DRAFT";
  const presentation = getStatus("fiscalProfile", status);

  return (
    <div className="portal-page portal-fiscal">
      {header}

      <Callout
        tone={status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : status === "PENDING" ? "info" : "warning"}
        title={
          <>
            {presentation.label}
            {canEdit && status !== "APPROVED" ? <span className="portal-muted"> · {completed} de {REQUIRED.length} obligatorios</span> : null}
          </>
        }
      >
        {STATUS_DETAIL[status]}
        {profile?.reviewedAt ? <> Última revisión: {formatArgentinaDateTime(profile.reviewedAt)}.</> : null}
      </Callout>

      {profile?.reviewNotes ? (
        <Callout tone="danger" icon="info" title="Observaciones de la revisión">
          {profile.reviewNotes}
        </Callout>
      ) : null}

      {!canEdit ? (
        <ReadOnlyProfile profile={profile ?? null} />
      ) : (
        <form className="portal-form portal-fiscal__form" onSubmit={(event) => void save(event)} noValidate>
          <Card title="Identificación fiscal">
            <div className="portal-form">
            <div className="portal-form__row">
              <TextField label="Razón social" required value={form.legalName} onChange={(event) => update("legalName", event.target.value)} />
              <TextField label="Nombre comercial" optional value={form.tradeName} onChange={(event) => update("tradeName", event.target.value)} />
              <TextField
                label="CUIT"
                required
                inputMode="numeric"
                placeholder="20123456789"
                value={form.cuit}
                hint={form.cuit.length === 11 && isValidCuit(form.cuit) ? formatCuit(form.cuit) : "11 dígitos, sin guiones."}
                error={errors.cuit}
                onChange={(event) => update("cuit", event.target.value)}
              />
              <SelectField label="Condición frente al IVA" required placeholder="Elegí una opción" value={form.ivaCondition} options={IVA_OPTIONS} onChange={(event) => update("ivaCondition", event.target.value)} />
            </div>
            <TextField label="Domicilio fiscal" required placeholder="Calle, número, localidad y provincia" value={form.fiscalAddress} onChange={(event) => update("fiscalAddress", event.target.value)} />
            </div>
          </Card>

          <Card title="Contacto">
            <div className="portal-form__row">
              <TextField label="Email de contacto" required type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} />
              <TextField label="Teléfono" optional type="tel" value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} />
              <TextField label="Responsable" optional value={form.responsibleName} onChange={(event) => update("responsibleName", event.target.value)} />
              <TextField label="Email del responsable" optional type="email" value={form.responsibleEmail} onChange={(event) => update("responsibleEmail", event.target.value)} />
            </div>
          </Card>

          {status === "APPROVED" && hasChanges ? <Callout tone="warning">Si guardás estos cambios, tus datos vuelven a revisión.</Callout> : null}
          {saveError ? (
            <Callout tone="danger" role="alert">
              {saveError}
            </Callout>
          ) : null}
          <div className="portal-fiscal__actions">
            <Button type="submit" variant="primary" size="lg" disabled={!hasChanges} loading={saving} loadingLabel="Guardando…">
              {completed === REQUIRED.length ? "Guardar y enviar a revisión" : "Guardar borrador"}
            </Button>
            {hasChanges ? (
              <Button variant="ghost" onClick={() => setForm(toForm(profile ?? null))} disabled={saving}>
                Descartar cambios
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
