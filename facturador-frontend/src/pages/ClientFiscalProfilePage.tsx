import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { formatDateTime } from "@/lib/formatters";

type ApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
type FiscalProfile = {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  cuit: string | null;
  ivaCondition: string | null;
  fiscalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  approvalStatus: ApprovalStatus;
  reviewNotes: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

type ProfileForm = {
  legalName: string; tradeName: string; cuit: string; ivaCondition: string;
  fiscalAddress: string; contactEmail: string; contactPhone: string;
  responsibleName: string; responsibleEmail: string;
};

const emptyForm: ProfileForm = {
  legalName: "", tradeName: "", cuit: "", ivaCondition: "", fiscalAddress: "",
  contactEmail: "", contactPhone: "", responsibleName: "", responsibleEmail: "",
};

const statusPresentation: Record<ApprovalStatus, { label: string; detail: string; tone: string }> = {
  DRAFT: { label: "Borrador", detail: "Completá los campos obligatorios para enviar tus datos a revisión.", tone: "muted" },
  PENDING: { label: "Pendiente de revisión", detail: "El equipo está revisando tus datos fiscales.", tone: "warning" },
  APPROVED: { label: "Aprobado", detail: "Tus datos fiscales fueron aprobados.", tone: "success" },
  REJECTED: { label: "Requiere cambios", detail: "Revisá las observaciones, corregí los datos y volvé a guardarlos.", tone: "danger" },
};

function toForm(current: FiscalProfile | null): ProfileForm {
  return current ? {
    legalName: current.legalName ?? "", tradeName: current.tradeName ?? "", cuit: current.cuit ?? "",
    ivaCondition: current.ivaCondition ?? "", fiscalAddress: current.fiscalAddress ?? "",
    contactEmail: current.contactEmail ?? "", contactPhone: current.contactPhone ?? "",
    responsibleName: current.responsibleName ?? "", responsibleEmail: current.responsibleEmail ?? "",
  } : emptyForm;
}

export function ClientFiscalProfilePage() {
  const { user } = useTenantAuth();
  const api = usePortalApi();
  const {
    data: profile,
    setData: setProfile,
    isLoading,
    isRefreshing,
    errorMessage: loadError,
    lastLoadedAt,
    reload: loadProfile,
  } = usePortalResource<FiscalProfile | null>("/portal/profile", {
    fallbackErrorMessage: "No pudimos cargar tus datos fiscales. Reintentá.",
  });
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const errorMessage = saveError || loadError;

  // Cada carga completa del servidor reemplaza el formulario con lo guardado.
  useEffect(() => {
    if (lastLoadedAt) setForm(toForm(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLoadedAt]);

  const canEdit = user?.role === "owner" || user?.role === "admin";
  const requiredValues = [form.legalName, form.cuit, form.ivaCondition, form.fiscalAddress, form.contactEmail];
  const completedRequired = requiredValues.filter((value) => value.trim()).length;
  const status = profile?.approvalStatus ?? "DRAFT";
  const presentation = statusPresentation[status];
  const hasChanges = useMemo(() => {
    if (!profile) return Object.values(form).some(Boolean);
    return Object.entries(form).some(([key, value]) => value !== String(profile[key as keyof FiscalProfile] ?? ""));
  }, [form, profile]);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: field === "cuit" ? value.replace(/\D/g, "").slice(0, 11) : value }));
    setSaveError("");
    setSuccessMessage("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setIsSaving(true);
    setSaveError("");
    setSuccessMessage("");
    try {
      const updated = await api.request<FiscalProfile>("/portal/profile", { method: "PUT", body: form });
      setProfile(updated);
      setSuccessMessage(updated.approvalStatus === "PENDING" ? "Listo, guardamos tus datos y los enviamos a revisión." : "Guardamos el borrador. Completá los campos obligatorios para enviarlo a revisión.");
    } catch (error) {
      setSaveError(getPortalErrorMessage(error, "No pudimos guardar tus datos fiscales. Reintentá."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="client-main client-fiscal-profile-page">
      <header className="app-topbar">
        <div><strong>Datos fiscales</strong><span>Mantené actualizada la información que usamos para configurar tu facturación.</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadProfile()} disabled={isLoading || isRefreshing}>{isRefreshing ? "Actualizando…" : "Actualizar"}</button>
      </header>

      {isLoading ? <section className="panel"><div className="panel-state"><strong>Cargando tus datos fiscales…</strong></div></section> : <>
        <section className={`client-profile-status client-profile-status--${presentation.tone}`}>
          <span><AppIcon name={status === "APPROVED" ? "check-circle" : status === "REJECTED" ? "alert" : "clock"} /></span>
          <div><strong>{presentation.label}</strong><p>{presentation.detail}</p>{profile?.reviewedAt ? <small>Última revisión: {formatDateTime(profile.reviewedAt)}</small> : null}</div>
          <b>{completedRequired}/5 obligatorios</b>
        </section>

        {profile?.reviewNotes ? <section className="panel client-profile-review"><span className="eyebrow">Observaciones de la revisión</span><p>{profile.reviewNotes}</p></section> : null}
        {profile?.approvalStatus === "APPROVED" && hasChanges ? <p className="client-profile-warning">Al guardar cambios, tus datos aprobados vuelven a quedar pendientes hasta una nueva revisión.</p> : null}

        <form className="panel client-profile-form" onSubmit={(event) => void saveProfile(event)}>
          <div className="section-subheading"><h2>Identificación fiscal</h2><p>Los campos marcados con * son necesarios para enviar tus datos a revisión.</p></div>
          <div className="client-profile-form__grid">
            <label className="field"><span>Razón social *</span><input value={form.legalName} onChange={(event) => updateField("legalName", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Nombre comercial</span><input value={form.tradeName} onChange={(event) => updateField("tradeName", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>CUIT *</span><input inputMode="numeric" value={form.cuit} onChange={(event) => updateField("cuit", event.target.value)} disabled={!canEdit || isSaving} placeholder="11 dígitos" /></label>
            <label className="field"><span>Condición frente al IVA *</span><select value={form.ivaCondition} onChange={(event) => updateField("ivaCondition", event.target.value)} disabled={!canEdit || isSaving}><option value="">Seleccionar</option><option value="responsable_inscripto">Responsable inscripto</option><option value="monotributo">Monotributo</option><option value="exento">Exento</option><option value="consumidor_final">Consumidor final</option></select></label>
            <label className="field client-profile-form__wide"><span>Domicilio fiscal *</span><input value={form.fiscalAddress} onChange={(event) => updateField("fiscalAddress", event.target.value)} disabled={!canEdit || isSaving} placeholder="Calle, número, localidad y provincia" /></label>
          </div>
          <div className="section-subheading"><h2>Contacto</h2></div>
          <div className="client-profile-form__grid">
            <label className="field"><span>Email de contacto *</span><input type="email" value={form.contactEmail} onChange={(event) => updateField("contactEmail", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Teléfono</span><input value={form.contactPhone} onChange={(event) => updateField("contactPhone", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Responsable</span><input value={form.responsibleName} onChange={(event) => updateField("responsibleName", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Email responsable</span><input type="email" value={form.responsibleEmail} onChange={(event) => updateField("responsibleEmail", event.target.value)} disabled={!canEdit || isSaving} /></label>
          </div>
          {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
          {canEdit ? <div className="tenant-form__actions"><button type="submit" className="primary-button" disabled={isSaving || !hasChanges}>{isSaving ? "Guardando…" : completedRequired === 5 ? "Guardar y enviar a revisión" : "Guardar borrador"}</button></div> : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
        </form>
      </>}
    </main>
  );
}
