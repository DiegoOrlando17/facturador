import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { AppIcon } from "@/components/ui/AppIcon";
import { ApiError, apiRequest, getApiErrorMessage } from "@/lib/api";
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
  DRAFT: { label: "Borrador", detail: "Completa los campos obligatorios para enviar el perfil a revision.", tone: "muted" },
  PENDING: { label: "Pendiente de revision", detail: "El equipo administrador esta revisando tus datos fiscales.", tone: "warning" },
  APPROVED: { label: "Aprobado", detail: "Tus datos fiscales fueron aprobados.", tone: "success" },
  REJECTED: { label: "Requiere cambios", detail: "Revisa las observaciones, corrige los datos y vuelve a guardarlos.", tone: "danger" },
};

export function ClientFiscalProfilePage() {
  const navigate = useNavigate();
  const { invalidateSession, token, user } = useTenantAuth();
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleUnauthorized = useCallback(() => {
    invalidateSession();
    navigate("/portal-cliente/login", { replace: true });
  }, [invalidateSession, navigate]);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const current = await apiRequest<FiscalProfile | null>("/portal/profile", { token, skipAuthHandling: true });
      setProfile(current);
      setForm(current ? {
        legalName: current.legalName ?? "", tradeName: current.tradeName ?? "", cuit: current.cuit ?? "",
        ivaCondition: current.ivaCondition ?? "", fiscalAddress: current.fiscalAddress ?? "",
        contactEmail: current.contactEmail ?? "", contactPhone: current.contactPhone ?? "",
        responsibleName: current.responsibleName ?? "", responsibleEmail: current.responsibleEmail ?? "",
      } : emptyForm);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setErrorMessage(getApiErrorMessage(error, "No se pudo cargar el perfil fiscal."));
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized, token]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

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
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canEdit) return;
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updated = await apiRequest<FiscalProfile>("/portal/profile", { method: "PUT", token, skipAuthHandling: true, body: form });
      setProfile(updated);
      setSuccessMessage(updated.approvalStatus === "PENDING" ? "Datos guardados y enviados a revision." : "Borrador guardado. Completa los campos obligatorios para enviarlo a revision.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setErrorMessage(getApiErrorMessage(error, "No se pudo guardar el perfil fiscal."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="client-main client-fiscal-profile-page">
      <header className="app-topbar">
        <div><strong>Datos fiscales</strong><span>Manten actualizada la informacion utilizada para configurar tu operatoria.</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadProfile()} disabled={isLoading}>Actualizar</button>
      </header>

      {isLoading ? <section className="panel"><div className="panel-state"><strong>Cargando perfil fiscal...</strong></div></section> : <>
        <section className={`client-profile-status client-profile-status--${presentation.tone}`}>
          <span><AppIcon name={status === "APPROVED" ? "check-circle" : status === "REJECTED" ? "alert" : "clock"} /></span>
          <div><strong>{presentation.label}</strong><p>{presentation.detail}</p>{profile?.reviewedAt ? <small>Ultima revision: {formatDateTime(profile.reviewedAt)}</small> : null}</div>
          <b>{completedRequired}/5 obligatorios</b>
        </section>

        {profile?.reviewNotes ? <section className="panel client-profile-review"><span className="eyebrow">Observaciones de revision</span><p>{profile.reviewNotes}</p></section> : null}
        {profile?.approvalStatus === "APPROVED" && hasChanges ? <p className="client-profile-warning">Al guardar cambios, el perfil aprobado volvera a estado pendiente hasta una nueva revision.</p> : null}

        <form className="panel client-profile-form" onSubmit={(event) => void saveProfile(event)}>
          <div className="section-subheading"><h2>Identificacion fiscal</h2><p>Los campos marcados con * son necesarios para enviar el perfil a revision.</p></div>
          <div className="client-profile-form__grid">
            <label className="field"><span>Razon social *</span><input value={form.legalName} onChange={(event) => updateField("legalName", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Nombre comercial</span><input value={form.tradeName} onChange={(event) => updateField("tradeName", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>CUIT *</span><input inputMode="numeric" value={form.cuit} onChange={(event) => updateField("cuit", event.target.value)} disabled={!canEdit || isSaving} placeholder="11 digitos" /></label>
            <label className="field"><span>Condicion IVA *</span><select value={form.ivaCondition} onChange={(event) => updateField("ivaCondition", event.target.value)} disabled={!canEdit || isSaving}><option value="">Seleccionar</option><option value="responsable_inscripto">Responsable inscripto</option><option value="monotributo">Monotributo</option><option value="exento">Exento</option><option value="consumidor_final">Consumidor final</option></select></label>
            <label className="field client-profile-form__wide"><span>Domicilio fiscal *</span><input value={form.fiscalAddress} onChange={(event) => updateField("fiscalAddress", event.target.value)} disabled={!canEdit || isSaving} placeholder="Calle, numero, localidad y provincia" /></label>
          </div>
          <div className="section-subheading"><h2>Contacto</h2></div>
          <div className="client-profile-form__grid">
            <label className="field"><span>Email de contacto *</span><input type="email" value={form.contactEmail} onChange={(event) => updateField("contactEmail", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Telefono</span><input value={form.contactPhone} onChange={(event) => updateField("contactPhone", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Responsable</span><input value={form.responsibleName} onChange={(event) => updateField("responsibleName", event.target.value)} disabled={!canEdit || isSaving} /></label>
            <label className="field"><span>Email responsable</span><input type="email" value={form.responsibleEmail} onChange={(event) => updateField("responsibleEmail", event.target.value)} disabled={!canEdit || isSaving} /></label>
          </div>
          {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
          {canEdit ? <div className="tenant-form__actions"><button type="submit" className="primary-button" disabled={isSaving || !hasChanges}>{isSaving ? "Guardando..." : completedRequired === 5 ? "Guardar y enviar a revision" : "Guardar borrador"}</button></div> : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
        </form>
      </>}
    </main>
  );
}
