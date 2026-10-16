import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { TextareaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stamp } from "@/components/ui/Ticket";
import { useToast } from "@/components/ui/Toast";
import { getPortalErrorMessage, usePortalApi, usePortalQuery } from "@/hooks/usePortalResource";
import { formatArgentinaDateTime } from "@/lib/formatters";
import { getStatus } from "@/lib/statusLabels";
import { useTenantCan } from "@/lib/tenantPermissions";

type Submission = {
  id: string;
  status: "pending" | "approved" | "rejected";
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
type OnboardingData = {
  submissions: Submission[];
  profileStatus: string;
  profileNotes: string | null;
  mercadoPago: boolean;
  arca: boolean;
};

type StepState = "done" | "current" | "waiting" | "attention";

const STEP_LABEL: Record<StepState, string> = { done: "Listo", current: "Pendiente", waiting: "En revisión", attention: "Para corregir" };

function Step({ index, state, title, children, action }: { index: number; state: StepState; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <li className={`portal-step portal-step--${state}`}>
      <span className="portal-step__mark" aria-hidden="true">
        {state === "done" ? "✓" : index}
      </span>
      <div className="portal-step__body">
        <p className="portal-step__title">
          <strong>{title}</strong>
          <span className="ui-sr-only"> · {STEP_LABEL[state]}</span>
        </p>
        <div className="portal-step__text">{children}</div>
        {action ? <div className="portal-step__action">{action}</div> : null}
      </div>
    </li>
  );
}

const emptyForm = { activity: "", website: "", notes: "", processingStartDate: "", documents: "" };

export function ClientOnboardingPage() {
  const api = usePortalApi();
  const toast = useToast();
  const can = useTenantCan();
  const canSubmit = can("tenant.submitOnboarding");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const query = usePortalQuery<OnboardingData>(
    "onboarding",
    async (portal, signal) => {
      const [onboarding, profile, integrations] = await Promise.all([
        portal.request<{ items: Submission[] }>("/portal/onboarding", { signal }),
        portal.request<{ approvalStatus: string; reviewNotes: string | null } | null>("/portal/profile", { signal }),
        portal.request<{ provider: string; enabled: boolean; configured?: boolean }[]>("/portal/integrations", { signal }),
      ]);
      const connected = (provider: string) => integrations.some((item) => item.provider === provider && (item.configured ?? item.enabled));
      return {
        submissions: onboarding.items,
        profileStatus: profile?.approvalStatus ?? "DRAFT",
        profileNotes: profile?.reviewNotes ?? null,
        mercadoPago: connected("MERCADOPAGO"),
        arca: connected("AFIP"),
      };
    },
    { fallbackErrorMessage: "No pudimos cargar la puesta en marcha." },
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.request("/portal/onboarding", {
        method: "POST",
        body: {
          business: { activity: form.activity, website: form.website, notes: form.notes },
          processingStartDate: form.processingStartDate || null,
          documents: form.documents.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          integrations: {},
        },
      });
      setForm(emptyForm);
      toast.success("Recibimos tu envío", { description: "Te avisamos cuando lo revisemos." });
      await query.reload();
    } catch (cause) {
      setError(getPortalErrorMessage(cause, "No pudimos enviar la información. Reintentá."));
    } finally {
      setSaving(false);
    }
  }

  const header = <PageHeader title="Puesta en marcha" description="Los pasos para empezar a facturar. Te acompañamos en cada uno." />;

  if (query.errorMessage) {
    return (
      <div className="portal-page">
        {header}
        <ErrorState message={query.errorMessage} onRetry={() => void query.reload()} retrying={query.isRefreshing} />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="portal-page" aria-busy="true">
        {header}
        <Skeleton variant="block" height="22rem" />
      </div>
    );
  }

  const data = query.data;
  const latest = data.submissions[0];
  const approved = latest?.status === "approved";
  const profileState: StepState = data.profileStatus === "APPROVED" ? "done" : data.profileStatus === "PENDING" ? "waiting" : data.profileStatus === "REJECTED" ? "attention" : "current";
  const connectionsState: StepState = data.mercadoPago && data.arca ? "done" : "current";
  const submissionState: StepState = !latest ? "current" : latest.status === "rejected" ? "attention" : "done";
  const approvalState: StepState = approved ? "done" : latest?.status === "pending" ? "waiting" : "current";
  const showForm = canSubmit && (!latest || latest.status === "rejected");

  return (
    <div className="portal-page portal-onboarding">
      {header}

      {approved ? (
        <section className="portal-onboarding__done" aria-label="Puesta en marcha aprobada">
          <Stamp label="EN MARCHA" size="md" />
          <div>
            <h2>Ya está todo en marcha.</h2>
            <p>Aprobamos tu configuración{latest.reviewedAt ? ` el ${formatArgentinaDateTime(latest.reviewedAt)}` : ""}. Las ventas se facturan según tu plan.</p>
          </div>
        </section>
      ) : null}

      <Card title="Tus pasos">
        <ol className="portal-steps">
          <Step
            index={1}
            state={profileState}
            title="Datos fiscales"
            action={profileState === "done" ? null : <Link className="portal-link" to="/portal-cliente/perfil-fiscal">{profileState === "attention" ? "Corregir datos" : profileState === "waiting" ? "Ver datos" : "Completar datos"}</Link>}
          >
            {profileState === "done"
              ? "Aprobados."
              : profileState === "waiting"
                ? "Los estamos revisando."
                : profileState === "attention"
                  ? data.profileNotes || "Hay algo para corregir."
                  : "CUIT, condición frente al IVA, domicilio y contacto."}
          </Step>
          <Step index={2} state={connectionsState} title="Conexiones con Mercado Pago y ARCA" action={<Link className="portal-link" to="/portal-cliente/integraciones">Ver conexiones</Link>}>
            {connectionsState === "done"
              ? "Mercado Pago y ARCA conectados."
              : `Las configuramos con vos, sin pedirte contraseñas. ${data.mercadoPago ? "Mercado Pago ya está." : "Falta Mercado Pago."} ${data.arca ? "ARCA ya está." : "Falta ARCA."}`}
          </Step>
          <Step index={3} state={submissionState} title="Enviar a revisión">
            {!latest
              ? "Contanos desde cuándo querés facturar y sumá lo que nos ayude a configurar tu cuenta."
              : latest.status === "rejected"
                ? latest.reviewNotes || "Revisamos tu envío y hay cambios para hacer. Mandá uno nuevo."
                : `Enviado el ${formatArgentinaDateTime(latest.createdAt)}.`}
          </Step>
          <Step index={4} state={approvalState} title="Aprobación">
            {approved ? "Aprobada. Ya podés facturar." : latest?.status === "pending" ? "Lo estamos revisando. Te avisamos por email." : "Validamos todo antes de habilitar la facturación."}
          </Step>
        </ol>
      </Card>

      {showForm ? (
        <Card title={latest ? "Nuevo envío" : "Enviar a revisión"} description="No incluyas contraseñas, tokens ni certificados: esas credenciales las configuramos por canales protegidos.">
          <form className="portal-form" onSubmit={(event) => void submit(event)}>
            <div className="portal-form__row">
              <TextField label="Actividad comercial" optional value={form.activity} placeholder="Kiosco, almacén, ropa…" onChange={(event) => setForm({ ...form, activity: event.target.value })} />
              <TextField label="Sitio web o red social" optional type="url" value={form.website} placeholder="https://" onChange={(event) => setForm({ ...form, website: event.target.value })} />
              <TextField label="Facturar ventas desde" optional type="date" value={form.processingStartDate} onChange={(event) => setForm({ ...form, processingStartDate: event.target.value })} />
            </div>
            <TextareaField label="Comentarios" optional value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <TextareaField label="Enlaces a documentos" optional hint="Uno por línea. Solo documentos sin datos sensibles." value={form.documents} placeholder="https://..." onChange={(event) => setForm({ ...form, documents: event.target.value })} />
            {error ? (
              <Callout tone="danger" role="alert">
                {error}
              </Callout>
            ) : null}
            <div>
              <Button type="submit" variant="primary" loading={saving} loadingLabel="Enviando…">
                Enviar a revisión
              </Button>
            </div>
          </form>
        </Card>
      ) : !canSubmit && !approved ? (
        <p className="portal-muted">Solo el dueño o un administrador de tu empresa puede enviar la información.</p>
      ) : null}

      {data.submissions.length ? (
        <section className="portal-section" aria-labelledby="onboarding-history-title">
          <div className="portal-section__header">
            <h2 id="onboarding-history-title">Envíos</h2>
          </div>
          <ol className="portal-timeline">
            {data.submissions.map((item, index) => {
              const status = getStatus("onboarding", item.status);
              return (
                <li key={item.id}>
                  <span className="portal-mono portal-muted">{formatArgentinaDateTime(item.createdAt)}</span>
                  <span>
                    <strong>Envío {data.submissions.length - index}</strong> <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    {item.reviewNotes ? <span className="portal-muted"> · {item.reviewNotes}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
