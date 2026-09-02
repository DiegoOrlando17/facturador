import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { ApiError, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";

type Submission = { id: string; status: "pending" | "approved" | "rejected"; data: { business?: Record<string, string>; processingStartDate?: string | null }; documents: string[]; reviewNotes: string | null; reviewedAt: string | null; createdAt: string };
type Response = { items: Submission[]; total: number };

export function ClientOnboardingPage() {
  const navigate = useNavigate();
  const { invalidateSession, token, user } = useTenantAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [business, setBusiness] = useState({ activity: "", website: "", notes: "" });
  const [processingStartDate, setProcessingStartDate] = useState("");
  const [documents, setDocuments] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const canSubmit = user?.role === "owner" || user?.role === "admin";

  const unauthorized = useCallback(() => { invalidateSession(); navigate("/portal-cliente/login", { replace: true }); }, [invalidateSession, navigate]);
  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try { setItems((await apiRequest<Response>("/portal/onboarding", { token, skipAuthHandling: true })).items); }
    catch (error) { if (error instanceof ApiError && error.status === 401) return unauthorized(); setErrorMessage(getApiErrorMessage(error, "No se pudo cargar el onboarding.")); }
    finally { setIsLoading(false); }
  }, [token, unauthorized]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || !canSubmit) return;
    setIsSaving(true); setErrorMessage("");
    try {
      await apiRequest("/portal/onboarding", { method: "POST", token, skipAuthHandling: true, body: { business, processingStartDate: processingStartDate || null, documents: documents.split(/\r?\n/).map((item) => item.trim()).filter(Boolean), integrations: {} } });
      setBusiness({ activity: "", website: "", notes: "" }); setProcessingStartDate(""); setDocuments(""); await load();
    } catch (error) { if (error instanceof ApiError && error.status === 401) return unauthorized(); setErrorMessage(getApiErrorMessage(error, "No se pudo enviar el onboarding.")); }
    finally { setIsSaving(false); }
  }

  return <main className="client-main client-onboarding-page">
    <header className="app-topbar"><div><strong>Onboarding</strong><span>Envia informacion inicial y consulta su revision.</span></div><button className="secondary-button" type="button" onClick={() => void load()}>Actualizar</button></header>
    {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
    {canSubmit ? <form className="panel client-onboarding-form" onSubmit={(event) => void submit(event)}>
      <div className="section-subheading"><h2>Nuevo envio</h2><p>No incluyas passwords, tokens ni certificados. Las credenciales se configuran por canales protegidos.</p></div>
      <div className="client-profile-form__grid">
        <label className="field"><span>Actividad comercial</span><input value={business.activity} onChange={(event) => setBusiness((value) => ({ ...value, activity: event.target.value }))} /></label>
        <label className="field"><span>Sitio web</span><input type="url" value={business.website} onChange={(event) => setBusiness((value) => ({ ...value, website: event.target.value }))} /></label>
        <label className="field"><span>Procesar pagos desde</span><input type="date" value={processingStartDate} onChange={(event) => setProcessingStartDate(event.target.value)} /></label>
        <label className="field client-profile-form__wide"><span>Comentarios</span><textarea value={business.notes} onChange={(event) => setBusiness((value) => ({ ...value, notes: event.target.value }))} /></label>
        <label className="field client-profile-form__wide"><span>Enlaces a documentos (uno por linea)</span><textarea value={documents} onChange={(event) => setDocuments(event.target.value)} placeholder="https://..." /></label>
      </div><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Enviando..." : "Enviar a revision"}</button>
    </form> : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
    <section className="panel"><div className="section-subheading"><h2>Historial</h2></div>{isLoading ? <div className="panel-state">Cargando...</div> : items.length ? <div className="client-onboarding-history">{items.map((item) => <article key={item.id}><div><strong>Envio {item.id}</strong><span>{formatDateTime(item.createdAt)}</span></div><small className={`status-pill status-pill--${item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}`}>{item.status}</small>{item.reviewNotes ? <p>{item.reviewNotes}</p> : null}</article>)}</div> : <div className="panel-state">Todavia no hay envios.</div>}</section>
  </main>;
}
