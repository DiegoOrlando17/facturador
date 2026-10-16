import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResendVerificationForm } from "@/components/auth/ResendVerificationForm";
import { AuthAside, AuthLayout } from "@/components/layout/AuthLayout";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { PasswordField, SelectField, TextField } from "@/components/ui/Field";
import { Stamp, Ticket, TicketDivider, TicketRow, TicketRows } from "@/components/ui/Ticket";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";
import { enabledPlanFeatures, isMonthlyPlan, PLAN_BILLING_NOTE, planFeatureLabel, type PublicPlan } from "@/lib/publicPlans";

type Result = {
  tenantSlug: string;
  email: string;
  verificationRequired: boolean;
  emailSent: boolean;
  billingStatus: string;
  verificationToken?: string;
};

type PlansState = { status: "loading" } | { status: "error" } | { status: "ready"; items: PublicPlan[] };

const SLUG_MIN_LENGTH = 3;
const SLUG_MAX_LENGTH = 50;

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Deriva el identificador a partir del nombre comercial ("Panadería Luna" → "panaderia-luna"). */
function slugFromName(value: string) {
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** Sanea lo que escribe la persona sin impedirle tipear un guion al final mientras escribe. */
function sanitizeTypedSlug(value: string) {
  return stripAccents(value.toLowerCase())
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

function buildLoginUrl(slug: string, email: string) {
  const params = new URLSearchParams({ empresa: slug, email });
  return `/portal-cliente/login?${params.toString()}`;
}

function formatPlanPrice(plan: PublicPlan) {
  if (plan.price == null) return "Precio a confirmar";
  return `${plan.currency} ${formatNumber(plan.price)}${isMonthlyPlan(plan) ? " /mes" : ""}`;
}

function PlanTicket({ plan }: { plan: PublicPlan }) {
  return (
    <Ticket as="div" className="auth-plan" eyebrow="Tu plan" title={plan.name}>
      <p className="auth-plan__price">
        {plan.price == null ? (
          "Precio a confirmar"
        ) : (
          <>
            {plan.currency} {formatNumber(plan.price)}
            {isMonthlyPlan(plan) ? <small> /mes</small> : null}
          </>
        )}
      </p>
      <p className="auth-plan__note">{PLAN_BILLING_NOTE}</p>
      <TicketDivider />
      <ul className="auth-plan__features">
        {enabledPlanFeatures(plan).map((key) => (
          <li key={key}>{planFeatureLabel(key)}</li>
        ))}
      </ul>
    </Ticket>
  );
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const requestedPlan = (params.get("plan") ?? "").toUpperCase();
  const [plans, setPlans] = useState<PlansState>({ status: "loading" });
  const [planNotice, setPlanNotice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    slug: "",
    email: "",
    password: "",
    planCode: "",
    acceptedTerms: false,
  });

  const loadPlans = useCallback(() => {
    setPlans({ status: "loading" });
    apiRequest<{ items: PublicPlan[] }>("/public/plans")
      .then(({ items }) => {
        setPlans({ status: "ready", items });
        const valid = items.some((plan) => plan.code === requestedPlan);
        if (requestedPlan && !valid) setPlanNotice("El plan del enlace ya no está disponible. Elegí uno de la lista.");
        setForm((current) => ({
          ...current,
          planCode: items.some((plan) => plan.code === current.planCode)
            ? current.planCode
            : valid
              ? requestedPlan
              : (items[0]?.code ?? ""),
        }));
      })
      .catch(() => setPlans({ status: "error" }));
  }, [requestedPlan]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  function handleBusinessNameChange(value: string) {
    setForm((current) => ({
      ...current,
      businessName: value,
      slug: slugTouched ? current.slug : slugFromName(value),
    }));
  }

  function handleSlugChange(value: string) {
    const sanitized = sanitizeTypedSlug(value);
    setSlugTouched(sanitized.length > 0);
    setForm((current) => ({ ...current, slug: sanitized }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const slug = form.slug.replace(/-+$/g, "");
    try {
      setResult(await apiRequest<Result>("/public/register", { method: "POST", body: { ...form, slug } }));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No pudimos crear la cuenta. Probá de nuevo en unos minutos."));
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const devToken = import.meta.env.DEV ? result.verificationToken : undefined;
    return (
      <AuthLayout subtitle="Portal del cliente" eyebrow="Cuenta creada" title="Verificá tu email para ingresar">
        <Ticket as="div" className="auth-credentials" eyebrow="Tus datos para ingresar" stamp={<Stamp label="ALTA" size="sm" />}>
          <TicketRows>
            <TicketRow label="Empresa" value={result.tenantSlug} mono />
            <TicketRow label="Email" value={result.email} mono />
          </TicketRows>
        </Ticket>
        {result.verificationRequired ? (
          result.emailSent ? (
            <Callout tone="info" role="status" title="Revisá tu email">
              Te mandamos un enlace de verificación a {result.email}. Abrilo para activar tu cuenta.
            </Callout>
          ) : (
            <Callout tone="warning" role="status" title="No pudimos enviarte el email">
              Pedí uno nuevo desde acá abajo.
            </Callout>
          )
        ) : null}
        <p>La suscripción queda pendiente hasta que conectes el medio de cobro desde el portal.</p>
        {devToken ? (
          <Callout tone="neutral" title="Modo desarrollo" actions={
            <ButtonLink to={`/verificar-email?token=${encodeURIComponent(devToken)}`} variant="primary" size="sm">
              Verificar email (solo desarrollo)
            </ButtonLink>
          }>
            Podés verificar sin abrir el email.
          </Callout>
        ) : null}
        {result.verificationRequired ? (
          <ResendVerificationForm
            initialEmail={result.email}
            title="¿No te llegó el email?"
            description="Revisá la carpeta de spam o pedí un enlace nuevo."
          />
        ) : null}
        <ButtonLink to={buildLoginUrl(result.tenantSlug, result.email)} variant="secondary" fullWidth>
          Ir a ingresar
        </ButtonLink>
      </AuthLayout>
    );
  }

  const slugPreview = form.slug.replace(/-+$/g, "");
  const selectedPlan = plans.status === "ready" ? plans.items.find((plan) => plan.code === form.planCode) : undefined;
  const plansReady = plans.status === "ready" && plans.items.length > 0;

  return (
    <AuthLayout
      subtitle="Alta autoservicio"
      title="Creá el espacio de tu empresa"
      description="En dos minutos. Después completás tus datos fiscales y conectás Mercado Pago."
      backTo="/"
      aside={
        <AuthAside
          headline={
            <>
              Vendés con Mercado Pago. <strong>La factura sale sola.</strong>
            </>
          }
          lead="Antes de emitir revisamos tus datos fiscales y las conexiones. No te pedimos contraseñas de nada."
        >
          {selectedPlan ? <PlanTicket plan={selectedPlan} /> : null}
        </AuthAside>
      }
      footer={
        <p>
          ¿Ya tenés cuenta?{" "}
          <Link className="auth-link" to="/portal-cliente/login">
            Ingresá al portal
          </Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <TextField
          label="Nombre comercial"
          required
          minLength={2}
          maxLength={120}
          autoComplete="organization"
          value={form.businessName}
          onChange={(event) => handleBusinessNameChange(event.target.value)}
        />
        <TextField
          label="Identificador de empresa"
          required
          minLength={SLUG_MIN_LENGTH}
          maxLength={SLUG_MAX_LENGTH}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Usá al menos 3 caracteres: letras minúsculas, números y guiones."
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={form.slug}
          onChange={(event) => handleSlugChange(event.target.value)}
          onBlur={() => setForm((current) => ({ ...current, slug: current.slug.replace(/-+$/g, "") }))}
          hint={
            slugPreview.length >= SLUG_MIN_LENGTH ? (
              <>
                Lo vas a usar para ingresar: <strong>{slugPreview}</strong>
              </>
            ) : (
              "Lo vas a usar para ingresar. Mínimo 3 caracteres: letras minúsculas, números y guiones."
            )
          }
        />
        <TextField
          label="Email del responsable"
          required
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <PasswordField
          label="Contraseña"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        {plans.status === "error" ? (
          <Callout
            tone="danger"
            role="alert"
            title="No pudimos cargar los planes"
            actions={
              <Button size="sm" variant="secondary" onClick={loadPlans}>
                Reintentar
              </Button>
            }
          >
            Sin plan no podemos crear la cuenta.
          </Callout>
        ) : plans.status === "ready" && plans.items.length === 0 ? (
          <Callout tone="warning" role="status" title="No hay planes disponibles">
            Por ahora no estamos tomando altas nuevas. Escribinos y te avisamos cuando abramos.
          </Callout>
        ) : (
          <SelectField
            label="Plan"
            required
            disabled={!plansReady}
            value={form.planCode}
            hint={planNotice || (plans.status === "loading" ? "Cargando planes…" : undefined)}
            onChange={(event) => {
              setPlanNotice("");
              setForm({ ...form, planCode: event.target.value });
            }}
            options={
              plans.status === "ready"
                ? plans.items.map((plan) => ({ value: plan.code, label: `${plan.name} · ${formatPlanPrice(plan)}` }))
                : [{ value: "", label: "Cargando planes…" }]
            }
          />
        )}
        <label className="auth-check">
          <input
            required
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) => setForm({ ...form, acceptedTerms: event.target.checked })}
          />
          <span>
            Acepto los{" "}
            <Link className="auth-link" to="/terminos" target="_blank" rel="noopener">
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link className="auth-link" to="/privacidad" target="_blank" rel="noopener">
              política de privacidad
            </Link>
            .
          </span>
        </label>
        {error ? (
          <Callout tone="danger" role="alert">
            {error}
          </Callout>
        ) : null}
        <Button type="submit" variant="accent" size="lg" fullWidth loading={saving} loadingLabel="Creando cuenta…" disabled={!plansReady}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
