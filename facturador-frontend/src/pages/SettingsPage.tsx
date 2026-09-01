import { type FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type Plan = {
  id: string;
  code: string;
  name: string;
  price: number | null;
  currency: string;
  billingCycle: "monthly" | "yearly" | "one_time";
  status: "ACTIVE" | "DISABLED";
  description: string | null;
  featuresJson: string | null;
  policy: PlanPolicy;
  createdSubscriptions?: number;
};

type PlanLimitKey = "monthlyInvoices" | "tenantUsers" | "manualInvoicesMonthly" | "ocrDocumentsMonthly";

type PlanPolicy = {
  schemaVersion: 1;
  tier: number | null;
  entitlements: Record<string, boolean>;
  limits: Record<PlanLimitKey, number | null>;
  processing: {
    allowedModes: string[];
    defaultMode: string | null;
    minIntervalMinutes: number | null;
    maxRunsPerDay: number | null;
  };
};

type PlansResponse = {
  items: Plan[];
  total: number;
};

const emptyPlanForm = {
  code: "",
  name: "",
  price: "",
  currency: "ARS",
  billingCycle: "monthly" as Plan["billingCycle"],
  status: "ACTIVE" as Plan["status"],
  description: "",
  featuresJson: "",
};

const planFeatureOptions = [
  ["clientPortal", "Portal cliente"],
  ["automaticInvoicing", "Facturacion automatica"],
  ["realtimeProcessing", "Procesamiento realtime"],
  ["scheduledProcessing", "Procesamiento programado"],
  ["pdfDownload", "Descarga PDF"],
  ["clientApproval", "Confirmacion del cliente"],
  ["deferredAutomaticInvoicing", "Emision diferida"],
  ["creditNotes", "Notas de credito"],
  ["manualInvoicing", "Facturacion manual"],
  ["googleDriveSheets", "Google Drive y Sheets"],
  ["ocrImport", "Importacion OCR"],
] as const;

const planLimitOptions: Array<[PlanLimitKey, string]> = [
  ["monthlyInvoices", "Facturas mensuales"],
  ["tenantUsers", "Usuarios del cliente"],
  ["manualInvoicesMonthly", "Facturas manuales mensuales"],
  ["ocrDocumentsMonthly", "Documentos OCR mensuales"],
];

function createEmptyPlanPolicy(): PlanPolicy {
  return {
    schemaVersion: 1,
    tier: null,
    entitlements: {},
    limits: {
      monthlyInvoices: null,
      tenantUsers: null,
      manualInvoicesMonthly: null,
      ocrDocumentsMonthly: null,
    },
    processing: {
      allowedModes: [],
      defaultMode: null,
      minIntervalMinutes: null,
      maxRunsPerDay: null,
    },
  };
}

function parsePlanPolicy(value: string): PlanPolicy {
  const emptyPolicy = createEmptyPlanPolicy();
  if (!value.trim()) return emptyPolicy;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyPolicy;

    const raw = parsed as Record<string, unknown>;
    if (raw.schemaVersion === 1 && raw.entitlements && typeof raw.entitlements === "object") {
      return {
        ...emptyPolicy,
        ...raw,
        schemaVersion: 1,
        entitlements: raw.entitlements as Record<string, boolean>,
        limits: {
          ...emptyPolicy.limits,
          ...(raw.limits && typeof raw.limits === "object" ? raw.limits : {}),
        },
        processing: {
          ...emptyPolicy.processing,
          ...(raw.processing && typeof raw.processing === "object" ? raw.processing : {}),
        },
      } as PlanPolicy;
    }

    const legacyEntitlements = Object.fromEntries(
      Object.entries(raw).filter(([, enabled]) => typeof enabled === "boolean")
    ) as Record<string, boolean>;
    return { ...emptyPolicy, entitlements: legacyEntitlements };
  } catch {
    return emptyPolicy;
  }
}

function updateFeatureJson(value: string, key: string, checked: boolean) {
  const policy = parsePlanPolicy(value);
  return JSON.stringify({
    ...policy,
    entitlements: {
      ...policy.entitlements,
      [key]: checked,
    },
  }, null, 2);
}

function updateLimitJson(value: string, key: PlanLimitKey, rawValue: string) {
  const policy = parsePlanPolicy(value);
  return JSON.stringify({
    ...policy,
    limits: {
      ...policy.limits,
      [key]: rawValue === "" ? null : Number(rawValue),
    },
  }, null, 2);
}

function formatPlanPrice(plan: Plan) {
  if (plan.price === null || plan.price === undefined) {
    return "Sin precio";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: plan.currency || "ARS",
    maximumFractionDigits: 0,
  }).format(plan.price);
}

function getBillingCycleLabel(cycle: Plan["billingCycle"]) {
  switch (cycle) {
    case "yearly":
      return "Anual";
    case "one_time":
      return "Unico";
    default:
      return "Mensual";
  }
}

export function SettingsPage() {
  const { token, user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState(emptyPlanForm);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const editablePolicy = parsePlanPolicy(form.featuresJson);

  useEffect(() => {
    if (token && user?.role === "SUPERADMIN") {
      void loadPlans();
    }
  }, [token, user?.role]);

  if (user && user.role !== "SUPERADMIN") {
    return <Navigate to="/" replace />;
  }

  async function loadPlans() {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<PlansResponse>("/admin/settings/plans", { token });
      setPlans(response.items);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "No se pudieron cargar los planes."));
    } finally {
      setIsLoading(false);
    }
  }

  function clearForm({ keepMessages = false } = {}) {
    setEditingPlanId(null);
    setIsFormOpen(false);
    setForm(emptyPlanForm);
    if (!keepMessages) {
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }

  function startEdit(plan: Plan) {
    setEditingPlanId(plan.id);
    setIsFormOpen(true);
    setForm({
      code: plan.code,
      name: plan.name,
      price: plan.price === null || plan.price === undefined ? "" : String(plan.price),
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      status: plan.status,
      description: plan.description ?? "",
      featuresJson: plan.featuresJson ?? "",
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setErrorMessage("Tu sesion no esta disponible. Ingresa nuevamente.");
      return;
    }

    if (!form.code.trim() || !form.name.trim()) {
      setErrorMessage("Completa codigo y nombre del plan.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const body = {
      code: form.code,
      name: form.name,
      price: form.price.trim() ? Number(form.price) : null,
      currency: form.currency,
      billingCycle: form.billingCycle,
      status: form.status,
      description: form.description,
      featuresJson: form.featuresJson,
    };

    try {
      if (editingPlanId) {
        await apiRequest<Plan>(`/admin/settings/plans/${editingPlanId}`, {
          method: "PATCH",
          token,
          body,
        });
        setSuccessMessage("Plan actualizado correctamente.");
      } else {
        await apiRequest<Plan>("/admin/settings/plans", {
          method: "POST",
          token,
          body,
        });
        setSuccessMessage("Plan creado correctamente.");
      }

      clearForm({ keepMessages: true });
      await loadPlans();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "No se pudo guardar el plan."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="admin-section-page">
      <div className="admin-section-header">
        <div>
          <h1>Planes</h1>
          <p>Configuracion comercial para asignar clientes sin exponer JSON en la operacion normal.</p>
        </div>
        <button
          type="button"
          className="section-button section-button--primary"
          onClick={() => {
            setEditingPlanId(null);
            setForm(emptyPlanForm);
            setIsFormOpen(true);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
        >
          Crear plan
        </button>
      </div>

      <section className="admin-single-column">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Listado</span>
              <h2>Planes</h2>
            </div>
            <button type="button" className="secondary-button" onClick={() => void loadPlans()}>
              Actualizar
            </button>
          </div>

          <div className="plans-list">
            {isLoading ? (
              <div className="panel-state">
                <strong>Cargando planes...</strong>
                <span>Estamos consultando la configuracion comercial.</span>
              </div>
            ) : plans.length > 0 ? (
              plans.map((plan) => (
                <article key={plan.id} className="plan-card">
                  <div>
                    <strong>{plan.name}</strong>
                    <span>{plan.code}</span>
                    {plan.description ? <p>{plan.description}</p> : null}
                  </div>
                  <div className="plan-card__meta">
                    <strong>{formatPlanPrice(plan)}</strong>
                    <span>{getBillingCycleLabel(plan.billingCycle)}</span>
                    <span>{Object.values(plan.policy.entitlements).filter(Boolean).length} servicios activos</span>
                    <span>
                      {Object.values(plan.policy.limits).some((limit) => limit !== null)
                        ? "Con limites configurados"
                        : "Sin limites definidos"}
                    </span>
                    <span>{plan.createdSubscriptions ?? 0} suscripciones</span>
                  </div>
                  <div className="plan-card__actions">
                    <span className={`badge badge--${plan.status === "ACTIVE" ? "success" : "muted"}`}>
                      {plan.status === "ACTIVE" ? "Activo" : "Deshabilitado"}
                    </span>
                    <button type="button" className="secondary-button" onClick={() => startEdit(plan)}>
                      Editar
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="panel-state">
                <strong>Todavia no hay planes</strong>
                <span>Crea el primer plan para empezar a ordenar la configuracion comercial.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      {isFormOpen ? (
        <div className="drawer-backdrop" role="presentation" onClick={() => clearForm()}>
        <article className="panel side-drawer" onClick={(event) => event.stopPropagation()}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{editingPlanId ? "Editar" : "Nuevo"}</span>
              <h2>{editingPlanId ? "Editar plan" : "Crear plan"}</h2>
            </div>
            <button type="button" className="secondary-button" disabled={isSaving} onClick={() => clearForm()}>
              Cerrar
            </button>
          </div>

          <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="field">
              <span>Codigo</span>
              <input
                type="text"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                placeholder="BASICO"
                disabled={isSaving || Boolean(editingPlanId)}
              />
            </label>
            <label className="field">
              <span>Nombre</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Plan Basico"
                disabled={isSaving}
              />
            </label>
            <div className="settings-form__split">
              <label className="field">
                <span>Precio</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                  placeholder="0"
                  disabled={isSaving}
                />
              </label>
              <label className="field">
                <span>Moneda</span>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  placeholder="ARS"
                  disabled={isSaving}
                />
              </label>
            </div>
            <label className="field">
              <span>Ciclo</span>
              <select
                value={form.billingCycle}
                onChange={(event) => setForm((current) => ({ ...current, billingCycle: event.target.value as Plan["billingCycle"] }))}
                disabled={isSaving}
              >
                <option value="monthly">Mensual</option>
                <option value="yearly">Anual</option>
                <option value="one_time">Unico</option>
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Plan["status"] }))}
                disabled={isSaving}
              >
                <option value="ACTIVE">Activo</option>
                <option value="DISABLED">Deshabilitado</option>
              </select>
            </label>
            <label className="field">
              <span>Descripcion</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Para clientes que..."
                disabled={isSaving}
              />
            </label>
            <div className="features-toggle-list">
              <span>Funciones incluidas</span>
              {planFeatureOptions.map(([key, label]) => {
                return (
                  <label key={key} className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={Boolean(editablePolicy.entitlements[key])}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        featuresJson: updateFeatureJson(current.featuresJson, key, event.target.checked),
                      }))}
                      disabled={isSaving}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
            <div className="features-toggle-list">
              <span>Limites opcionales</span>
              {planLimitOptions.map(([key, label]) => (
                <label key={key} className="field">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editablePolicy.limits[key] ?? ""}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      featuresJson: updateLimitJson(current.featuresJson, key, event.target.value),
                    }))}
                    placeholder="Sin limite definido"
                    disabled={isSaving}
                  />
                </label>
              ))}
            </div>
            <details className="advanced-json-box">
              <summary>Avanzado: editar JSON</summary>
              <label className="field">
                <span>Features JSON</span>
                <textarea
                  className="code-textarea settings-features-textarea"
                  value={form.featuresJson}
                  onChange={(event) => setForm((current) => ({ ...current, featuresJson: event.target.value }))}
                  placeholder='{"automaticBilling": true, "emailSupport": true}'
                  disabled={isSaving}
                />
              </label>
            </details>

            <div className="tenant-form__actions">
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? "Guardando..." : editingPlanId ? "Guardar cambios" : "Crear plan"}
              </button>
              <button type="button" className="secondary-button" disabled={isSaving} onClick={() => clearForm()}>
                Limpiar
              </button>
            </div>

            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            {successMessage ? <p className="form-success">{successMessage}</p> : null}
          </form>
        </article>
        </div>
      ) : null}
    </main>
  );
}
