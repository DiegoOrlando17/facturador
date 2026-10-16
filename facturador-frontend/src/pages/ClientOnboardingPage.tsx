import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { getPortalErrorMessage, usePortalApi, usePortalResource } from "@/hooks/usePortalResource";
import { formatDateTime } from "@/lib/formatters";

type SubmissionStatus = "pending" | "approved" | "rejected";
type Submission = {
  id: string;
  status: SubmissionStatus;
  data: { business?: Record<string, string>; processingStartDate?: string | null };
  documents: string[];
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
type OnboardingResponse = { items: Submission[]; total: number };

const submissionStatus: Record<string, { label: string; tone: string }> = {
  pending: { label: "En revisión", tone: "warning" },
  approved: { label: "Aprobado", tone: "success" },
  rejected: { label: "Requiere cambios", tone: "danger" },
};

function getSubmissionStatus(status: string) {
  return submissionStatus[status] ?? { label: "En revisión", tone: "muted" };
}

export function ClientOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useTenantAuth();
  const api = usePortalApi();
  const { data, isLoading, isRefreshing, errorMessage: loadError, reload } = usePortalResource<OnboardingResponse>(
    "/portal/onboarding",
    { fallbackErrorMessage: "No pudimos cargar la puesta en marcha. Reintentá." },
  );
  const [business, setBusiness] = useState({ activity: "", website: "", notes: "" });
  const [processingStartDate, setProcessingStartDate] = useState("");
  const [documents, setDocuments] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canSubmit = user?.role === "owner" || user?.role === "admin";
  const items = data?.items ?? [];
  const latestSubmission = items[0];

  function handleReload() {
    setSubmitError("");
    setSuccessMessage("");
    void reload();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setSubmitError("");
    setSuccessMessage("");
    try {
      await api.request("/portal/onboarding", {
        method: "POST",
        body: {
          business,
          processingStartDate: processingStartDate || null,
          documents: documents.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          integrations: {},
        },
      });
      setBusiness({ activity: "", website: "", notes: "" });
      setProcessingStartDate("");
      setDocuments("");
      setSuccessMessage("Listo, recibimos tu envío. Te avisamos cuando el equipo lo revise.");
      await reload();
    } catch (error) {
      setSubmitError(getPortalErrorMessage(error, "No pudimos enviar la información. Reintentá."));
    } finally {
      setIsSaving(false);
    }
  }

  const errorMessage = submitError || loadError;

  return (
    <div className="client-main client-onboarding-page">
      <header className="app-topbar">
        <div><strong>Puesta en marcha</strong><span>Enviá la información inicial y seguí su revisión.</span></div>
        <button className="secondary-button" type="button" onClick={handleReload} disabled={isLoading || isRefreshing}>
          {isRefreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </header>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
      <section className="panel client-onboarding-checklist">
        <div className="section-subheading">
          <span className="eyebrow">Tu puesta en marcha</span>
          <h2>Checklist guiado</h2>
          <p>Completá estos pasos antes de empezar a procesar ventas.</p>
        </div>
        <div className="onboarding-list">
          <button className="onboarding-item" type="button" onClick={() => navigate("/portal-cliente/perfil-fiscal")}>
            <span className="onboarding-item__mark">1</span>
            <span><strong>Completar datos fiscales</strong><small>Cargá CUIT, condición frente al IVA, domicilio y contacto.</small></span>
          </button>
          <button className="onboarding-item" type="button" onClick={() => navigate("/portal-cliente/integraciones")}>
            <span className="onboarding-item__mark">2</span>
            <span><strong>Conectar integraciones</strong><small>Configurá Mercado Pago, ARCA y los destinos que incluye tu plan.</small></span>
          </button>
          <a className="onboarding-item" href="#onboarding-form">
            <span className={`onboarding-item__mark${latestSubmission ? " onboarding-item__mark--complete" : ""}`}>{latestSubmission ? "✓" : "3"}</span>
            <span>
              <strong>Enviar la configuración a revisión</strong>
              <small>{latestSubmission ? `Último envío: ${getSubmissionStatus(latestSubmission.status).label.toLowerCase()}.` : "Indicá la fecha de inicio y sumá enlaces a documentos no sensibles."}</small>
            </span>
          </a>
          <span className="onboarding-item">
            <span className={`onboarding-item__mark${latestSubmission?.status === "approved" ? " onboarding-item__mark--complete" : ""}`}>{latestSubmission?.status === "approved" ? "✓" : "4"}</span>
            <span><strong>Recibir la aprobación</strong><small>El equipo valida la configuración antes de habilitar la operación.</small></span>
          </span>
        </div>
      </section>
      {canSubmit ? (
        <form id="onboarding-form" className="panel client-onboarding-form" onSubmit={(event) => void submit(event)}>
          <div className="section-subheading">
            <h2>Nuevo envío</h2>
            <p>No incluyas contraseñas, tokens ni certificados: las credenciales se configuran por canales protegidos.</p>
          </div>
          <div className="client-profile-form__grid">
            <label className="field"><span>Actividad comercial</span><input value={business.activity} onChange={(event) => setBusiness((value) => ({ ...value, activity: event.target.value }))} /></label>
            <label className="field"><span>Sitio web</span><input type="url" value={business.website} onChange={(event) => setBusiness((value) => ({ ...value, website: event.target.value }))} /></label>
            <label className="field"><span>Procesar ventas desde</span><input type="date" value={processingStartDate} onChange={(event) => setProcessingStartDate(event.target.value)} /></label>
            <label className="field client-profile-form__wide"><span>Comentarios</span><textarea value={business.notes} onChange={(event) => setBusiness((value) => ({ ...value, notes: event.target.value }))} /></label>
            <label className="field client-profile-form__wide"><span>Enlaces a documentos (uno por línea)</span><textarea value={documents} onChange={(event) => setDocuments(event.target.value)} placeholder="https://..." /></label>
          </div>
          <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Enviando…" : "Enviar a revisión"}</button>
        </form>
      ) : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
      <section className="panel">
        <div className="section-subheading"><h2>Historial</h2></div>
        {isLoading ? <div className="panel-state">Cargando envíos…</div> : items.length ? (
          <div className="client-onboarding-history">
            {items.map((item, index) => {
              const status = getSubmissionStatus(item.status);
              return (
                <article key={item.id}>
                  <div><strong>Envío {items.length - index}</strong><span>{formatDateTime(item.createdAt)}</span></div>
                  <small className={`status-pill status-pill--${status.tone}`}>{status.label}</small>
                  {item.reviewNotes ? <p>{item.reviewNotes}</p> : null}
                </article>
              );
            })}
          </div>
        ) : <div className="panel-state">Todavía no hay envíos.</div>}
      </section>
    </div>
  );
}
