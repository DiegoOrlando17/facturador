import { useEffect, useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { ErrorState } from "@/components/ui/EmptyState";
import { SelectField, TextField } from "@/components/ui/Field";
import { IntegrationLogo, type IntegrationLogoName } from "@/components/ui/IntegrationLogo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { getPortalErrorMessage, usePortalApi, usePortalQuery } from "@/hooks/usePortalResource";
import { formatArgentinaDateTime } from "@/lib/formatters";
import type { StatusTone } from "@/lib/statusLabels";
import { useTenantCan } from "@/lib/tenantPermissions";

type Provider = "MERCADOPAGO" | "AFIP" | "DRIVE" | "SHEETS";
type Integration = {
  id: string;
  provider: Provider;
  enabled: boolean;
  /** true solo si está habilitada y tiene las credenciales mínimas (lo calcula el backend). */
  configured?: boolean;
  updatedAt: string;
  config: Record<string, unknown>;
};
type Subscription = {
  planCode: string;
  policy: {
    entitlements?: Record<string, boolean>;
    processing?: { allowedModes?: string[]; minRealtimeIntervalMs?: number; maxRunsPerDay?: number };
  };
} | null;
type TestResult = { ok: boolean; warnings?: string[]; error?: string };
type IntegrationsData = { items: Integration[]; subscription: Subscription };

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
const INTERVAL_PRESETS = [5_000, 15_000, 30_000, 60_000, 5 * 60_000, 15 * 60_000];
const RUNS_PER_DAY_OPTIONS = [1, 2, 3, 4, 6, 12, 24];
const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Argentina/Cordoba", label: "Córdoba" },
  { value: "America/Argentina/Mendoza", label: "Mendoza" },
  { value: "America/Argentina/Salta", label: "Salta" },
  { value: "America/Argentina/Tucuman", label: "Tucumán" },
  { value: "America/Argentina/Ushuaia", label: "Ushuaia" },
];

function intervalLabel(ms: number) {
  if (ms < 60_000) return `Cada ${Math.round(ms / 1000)} segundos`;
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? "Cada 1 minuto" : `Cada ${minutes} minutos`;
}

function connectionState(item: Integration | undefined): { label: string; tone: StatusTone } {
  if (item && (item.configured ?? item.enabled)) return { label: "Conectada", tone: "success" };
  if (item?.enabled) return { label: "Faltan datos", tone: "warning" };
  return { label: "Sin conectar", tone: "neutral" };
}

/* Tarjeta ---------------------------------------------------------------------- */

function IntegrationCard({
  provider,
  title,
  description,
  item,
  canTest,
  children,
}: {
  provider: Provider;
  title: string;
  description: string;
  item: Integration | undefined;
  canTest: boolean;
  children?: ReactNode;
}) {
  const api = usePortalApi();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const state = connectionState(item);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api.request<TestResult>(`/portal/integrations/${provider}/test`, { method: "POST" }));
    } catch (cause) {
      const message = getPortalErrorMessage(cause, "No pudimos probar la conexión.");
      if (message) setResult({ ok: false, error: message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="portal-integration" aria-labelledby={`integration-${provider}`}>
      <header className="portal-integration__header">
        <span className="portal-integration__logo" aria-hidden="true">
          <IntegrationLogo name={provider as IntegrationLogoName} />
        </span>
        <div className="portal-integration__title">
          <h2 id={`integration-${provider}`}>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
      </header>
      {children}
      {item && canTest ? (
        <footer className="portal-integration__footer">
          <span className="portal-muted">Última actualización: {formatArgentinaDateTime(item.updatedAt)}</span>
          <Button size="sm" variant="secondary" onClick={() => void test()} loading={testing} loadingLabel="Probando…">
            Probar conexión
          </Button>
        </footer>
      ) : null}
      {result ? (
        <Callout tone={result.ok ? "success" : "danger"} role={result.ok ? "status" : "alert"} title={result.ok ? "La conexión funciona" : "La conexión falló"} onDismiss={() => setResult(null)}>
          {result.error ?? (result.warnings?.length ? result.warnings.join(" ") : "Respondió correctamente.")}
        </Callout>
      ) : null}
    </section>
  );
}

/* Agenda de Mercado Pago ----------------------------------------------------------- */

function MercadoPagoSchedule({ item, subscription, canManage, onSaved }: { item: Integration | undefined; subscription: Subscription; canManage: boolean; onSaved: () => void }) {
  const api = usePortalApi();
  const toast = useToast();
  const processing = subscription?.policy.processing;
  const minInterval = Math.max(5_000, processing?.minRealtimeIntervalMs ?? 5_000);
  const allowsScheduled = Boolean(processing?.allowedModes?.includes("scheduled"));
  const config = item?.config ?? {};
  const [mode, setMode] = useState("realtime");
  const [interval, setIntervalMs] = useState(String(minInterval));
  const [times, setTimes] = useState<string[]>([]);
  const [runsPerDay, setRunsPerDay] = useState("1");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [saving, setSaving] = useState(false);

  // Cada carga del servidor vuelve a mostrar lo guardado.
  useEffect(() => {
    setMode(String(config.POLLING_MODE ?? "realtime"));
    setIntervalMs(String(config.POLLING_INTERVAL_MS ?? minInterval));
    setTimes(Array.isArray(config.RUN_AT_TIMES) ? (config.RUN_AT_TIMES as string[]) : []);
    setRunsPerDay(String(config.RUNS_PER_DAY ?? 1));
    setTimezone(String(config.TIMEZONE ?? DEFAULT_TIMEZONE));
  }, [item?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!subscription) {
    return <p className="portal-muted">Cuando tu plan esté activo vas a poder elegir cuándo leemos tus ventas.</p>;
  }

  const intervalOptions = [...new Set([...INTERVAL_PRESETS.filter((value) => value >= minInterval), Number(interval)])]
    .filter((value) => Number.isFinite(value) && value >= minInterval)
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: intervalLabel(value) }));
  const maxRuns = processing?.maxRunsPerDay ?? 24;
  const zones = TIMEZONES.some((zone) => zone.value === timezone) ? TIMEZONES : [...TIMEZONES, { value: timezone, label: timezone }];
  const disabled = !canManage || saving;

  async function save() {
    setSaving(true);
    const cleanTimes = times.filter(Boolean);
    // Con "lecturas por día" se manda RUN_AT_TIMES: [] explícito para descartar horarios viejos.
    const body =
      mode === "realtime"
        ? { POLLING_MODE: mode, POLLING_INTERVAL_MS: Number(interval), TIMEZONE: timezone }
        : { POLLING_MODE: mode, TIMEZONE: timezone, ...(cleanTimes.length ? { RUN_AT_TIMES: cleanTimes } : { RUN_AT_TIMES: [] as string[], RUNS_PER_DAY: Number(runsPerDay) }) };
    try {
      await api.request("/portal/integrations/MERCADOPAGO", { method: "PUT", body: { config: body } });
      toast.success("Guardamos cuándo leemos tus ventas");
      onSaved();
    } catch (cause) {
      toast.error("No pudimos guardar la agenda", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-integration__body">
      <h3>Cuándo leemos tus ventas</h3>
      <div className="portal-segmented" role="radiogroup" aria-label="Cuándo leemos tus ventas">
        {[
          { value: "realtime", label: "Al instante", enabled: true },
          { value: "scheduled", label: "En horarios", enabled: allowsScheduled },
        ].map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={mode === option.value} className="portal-segmented__option" disabled={disabled || !option.enabled} onClick={() => setMode(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      {!allowsScheduled ? <p className="portal-form__hint">La lectura en horarios está disponible desde el plan Control.</p> : null}

      {mode === "realtime" ? (
        <SelectField label="Frecuencia" value={interval} onChange={(event) => setIntervalMs(event.target.value)} options={intervalOptions} disabled={disabled} />
      ) : (
        <div className="portal-times">
          <p className="portal-times__label">Horarios de lectura</p>
          {times.length ? (
            <ul className="portal-times__list">
              {times.map((time, index) => (
                <li key={index}>
                  <TextField
                    label={`Horario ${index + 1}`}
                    hideLabel
                    type="time"
                    value={time}
                    disabled={disabled}
                    onChange={(event) => setTimes((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                  />
                  <Button size="sm" variant="ghost" iconOnly iconLeft="trash" aria-label={`Quitar horario ${time || index + 1}`} disabled={disabled} onClick={() => setTimes((current) => current.filter((_, i) => i !== index))} />
                </li>
              ))}
            </ul>
          ) : (
            <SelectField
              label="Lecturas por día"
              hint="Repartidas en el día. O elegí horarios fijos."
              value={runsPerDay}
              onChange={(event) => setRunsPerDay(event.target.value)}
              options={RUNS_PER_DAY_OPTIONS.filter((value) => value <= maxRuns).map((value) => ({ value: String(value), label: value === 1 ? "1 vez por día" : `${value} veces por día` }))}
              disabled={disabled}
            />
          )}
          {times.length < Math.min(maxRuns, 24) ? (
            <Button size="sm" variant="secondary" iconLeft="plus" disabled={disabled} onClick={() => setTimes((current) => [...current, ""])}>
              Agregar horario
            </Button>
          ) : null}
        </div>
      )}

      <SelectField label="Zona horaria" value={timezone} onChange={(event) => setTimezone(event.target.value)} options={zones} disabled={disabled} hint="Todas las de Argentina usan la misma hora." />

      {canManage ? (
        <div>
          <Button variant="primary" onClick={() => void save()} loading={saving} loadingLabel="Guardando…">
            Guardar
          </Button>
        </div>
      ) : (
        <p className="portal-muted">Tu rol puede ver la configuración pero no cambiarla.</p>
      )}
    </div>
  );
}

/* Destinos de Google ---------------------------------------------------------- */

function GoogleDestination({ provider, item, canManage, onSaved }: { provider: "DRIVE" | "SHEETS"; item: Integration | undefined; canManage: boolean; onSaved: () => void }) {
  const api = usePortalApi();
  const toast = useToast();
  const [folderId, setFolderId] = useState("");
  const [sheetsId, setSheetsId] = useState("");
  const [sheetName, setSheetName] = useState("Hoja1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFolderId(String(item?.config.DRIVE_FOLDER_ID ?? ""));
    setSheetsId(String(item?.config.SHEETS_ID ?? ""));
    setSheetName(String(item?.config.SHEET_NAME ?? "Hoja1"));
  }, [item?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) {
    return <p className="portal-muted">Primero nuestro equipo vincula tu cuenta de Google. Escribinos para coordinarlo.</p>;
  }

  async function save() {
    setSaving(true);
    try {
      await api.request(`/portal/integrations/${provider}`, {
        method: "PUT",
        body: { config: provider === "DRIVE" ? { DRIVE_FOLDER_ID: folderId.trim() } : { SHEETS_ID: sheetsId.trim(), SHEET_NAME: sheetName.trim() || "Hoja1" } },
      });
      toast.success(provider === "DRIVE" ? "Guardamos la carpeta" : "Guardamos la planilla");
      onSaved();
    } catch (cause) {
      toast.error("No pudimos guardar", { description: getPortalErrorMessage(cause, "Reintentá en unos minutos.") });
    } finally {
      setSaving(false);
    }
  }

  const disabled = !canManage || saving;
  return (
    <div className="portal-integration__body">
      {provider === "DRIVE" ? (
        <TextField label="ID de la carpeta" hint="Es la parte final del enlace de la carpeta: drive.google.com/drive/folders/ESTE-ID" value={folderId} onChange={(event) => setFolderId(event.target.value)} disabled={disabled} />
      ) : (
        <div className="portal-form__row">
          <TextField label="ID de la planilla" hint="Está en el enlace: docs.google.com/spreadsheets/d/ESTE-ID/edit" value={sheetsId} onChange={(event) => setSheetsId(event.target.value)} disabled={disabled} />
          <TextField label="Hoja" value={sheetName} onChange={(event) => setSheetName(event.target.value)} disabled={disabled} />
        </div>
      )}
      {canManage ? (
        <div>
          <Button variant="primary" onClick={() => void save()} loading={saving} loadingLabel="Guardando…">
            Guardar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* Página ----------------------------------------------------------------------- */

export function ClientIntegrationsPage() {
  const can = useTenantCan();
  const query = usePortalQuery<IntegrationsData>(
    "integrations",
    async (portal, signal) => {
      const [items, subscription] = await Promise.all([
        portal.request<Integration[]>("/portal/integrations", { signal }),
        // Si falla la suscripción, las conexiones igual se muestran (sin opciones del plan).
        portal.request<Subscription>("/portal/subscription", { signal }).catch((error: unknown) => {
          if (signal.aborted) throw error;
          return null;
        }),
      ]);
      return { items, subscription };
    },
    { fallbackErrorMessage: "No pudimos cargar las conexiones." },
  );
  const canManage = can("tenant.manageIntegrations");
  const canTest = can("tenant.testIntegrations");
  const byProvider = Object.fromEntries((query.data?.items ?? []).map((item) => [item.provider, item])) as Partial<Record<Provider, Integration>>;
  const subscription = query.data?.subscription ?? null;
  const hasGoogle = subscription?.policy.entitlements?.googleDriveSheets === true;
  const reload = () => void query.reload();

  return (
    <div className="portal-page portal-integrations">
      <PageHeader title="Integraciones" description="Las conexiones que usamos para leer tus ventas, emitir en ARCA y guardar los comprobantes." />

      {query.errorMessage ? (
        <ErrorState message={query.errorMessage} onRetry={reload} retrying={query.isRefreshing} />
      ) : !query.data ? (
        <div className="portal-integrations__grid" aria-busy="true">
          <Skeleton variant="block" height="16rem" />
          <Skeleton variant="block" height="16rem" />
        </div>
      ) : (
        <div className="portal-integrations__grid">
          <IntegrationCard provider="MERCADOPAGO" title="Mercado Pago" description="De acá leemos las ventas de tu caja." item={byProvider.MERCADOPAGO} canTest={canTest}>
            {connectionState(byProvider.MERCADOPAGO).tone !== "success" ? (
              <Callout tone="info">Nuestro equipo conecta tu cuenta durante la puesta en marcha. Nunca te vamos a pedir la contraseña.</Callout>
            ) : null}
            <MercadoPagoSchedule item={byProvider.MERCADOPAGO} subscription={subscription} canManage={canManage} onSaved={reload} />
          </IntegrationCard>

          <IntegrationCard provider="AFIP" title="ARCA" description="Donde se emiten tus comprobantes con CAE." item={byProvider.AFIP} canTest={canTest}>
            {connectionState(byProvider.AFIP).tone !== "success" ? (
              <p className="portal-muted">Configuramos el certificado y el punto de venta con vos durante la puesta en marcha.</p>
            ) : null}
          </IntegrationCard>

          {(["DRIVE", "SHEETS"] as const).map((provider) => (
            <IntegrationCard
              key={provider}
              provider={provider}
              title={provider === "DRIVE" ? "Google Drive" : "Google Sheets"}
              description={provider === "DRIVE" ? "Guardamos el PDF de cada comprobante en una carpeta tuya." : "Una planilla al día con todas las ventas, para tu contador."}
              item={hasGoogle ? byProvider[provider] : undefined}
              canTest={canTest && hasGoogle}
            >
              {hasGoogle ? (
                <GoogleDestination provider={provider} item={byProvider[provider]} canManage={canManage} onSaved={reload} />
              ) : (
                <div className="portal-upsell">
                  <p>Disponible desde el plan Profesional.</p>
                  <ButtonLink to="/portal-cliente/suscripcion" variant="link">
                    Ver planes
                  </ButtonLink>
                </div>
              )}
            </IntegrationCard>
          ))}
        </div>
      )}
    </div>
  );
}
