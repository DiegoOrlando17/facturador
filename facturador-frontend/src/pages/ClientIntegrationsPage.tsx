import { useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { IntegrationLogo, type IntegrationLogoName } from "@/components/ui/IntegrationLogo";
import { getPortalErrorMessage, usePortalApi, usePortalQuery } from "@/hooks/usePortalResource";
import { formatDateTime } from "@/lib/formatters";

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
    processing?: { allowedModes?: string[]; minRealtimeIntervalMs?: number };
  };
} | null;
type TestResult = { ok: boolean; connected?: boolean; warnings?: string[]; error?: string };

const providers: Array<{ provider: Provider; label: string; detail: string }> = [
  { provider: "MERCADOPAGO", label: "Mercado Pago", detail: "Origen de las ventas POS que leemos automáticamente." },
  { provider: "AFIP", label: "ARCA", detail: "Emisión fiscal y numeración de comprobantes." },
  { provider: "DRIVE", label: "Google Drive", detail: "Carpeta opcional para guardar comprobantes emitidos." },
  { provider: "SHEETS", label: "Google Sheets", detail: "Planilla opcional con el estado de todos los pagos." },
];

type IntegrationsData = { items: Integration[]; subscription: Subscription };

export function ClientIntegrationsPage() {
  const { user } = useTenantAuth();
  const api = usePortalApi();
  const [driveFolderId, setDriveFolderId] = useState("");
  const [sheetsId, setSheetsId] = useState("");
  const [sheetName, setSheetName] = useState("Hoja1");
  const [pollingMode, setPollingMode] = useState("realtime");
  const [pollingIntervalMs, setPollingIntervalMs] = useState("5000");
  const [pollingTimezone, setPollingTimezone] = useState("America/Argentina/Buenos_Aires");
  const [pollingRunsPerDay, setPollingRunsPerDay] = useState("1");
  const [pollingRunAtTimes, setPollingRunAtTimes] = useState("");
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [testResults, setTestResults] = useState<Partial<Record<Provider, TestResult>>>({});

  const { data, isLoading, isRefreshing, errorMessage: loadError, lastLoadedAt, reload: loadIntegrations } = usePortalQuery<IntegrationsData>(
    "integrations",
    async (portal, signal) => {
      const [items, subscription] = await Promise.all([
        portal.request<Integration[]>("/portal/integrations", { signal }),
        // Si falla la suscripción, las integraciones igual se muestran (sin opciones del plan).
        portal.request<Subscription>("/portal/subscription", { signal }).catch((error: unknown) => {
          if (signal.aborted) throw error;
          return null;
        }),
      ]);
      return { items, subscription };
    },
    { fallbackErrorMessage: "No pudimos cargar las integraciones. Reintentá." },
  );
  const integrations = useMemo(() => data?.items ?? [], [data]);
  const subscription = data?.subscription ?? null;
  const errorMessage = actionError || loadError;

  // Cada carga del servidor sincroniza los formularios con lo guardado.
  useEffect(() => {
    if (!lastLoadedAt || !data) return;
    const items = data.items;
    {
      const drive = items.find((item) => item.provider === "DRIVE");
      const sheets = items.find((item) => item.provider === "SHEETS");
      const mercadoPago = items.find((item) => item.provider === "MERCADOPAGO");
      setDriveFolderId(String(drive?.config.DRIVE_FOLDER_ID ?? ""));
      setSheetsId(String(sheets?.config.SHEETS_ID ?? ""));
      setSheetName(String(sheets?.config.SHEET_NAME ?? "Hoja1"));
      setPollingMode(String(mercadoPago?.config.POLLING_MODE ?? "realtime"));
      setPollingIntervalMs(String(mercadoPago?.config.POLLING_INTERVAL_MS ?? 5000));
      setPollingTimezone(String(mercadoPago?.config.TIMEZONE ?? "America/Argentina/Buenos_Aires"));
      setPollingRunsPerDay(String(mercadoPago?.config.RUNS_PER_DAY ?? 1));
      setPollingRunAtTimes(Array.isArray(mercadoPago?.config.RUN_AT_TIMES) ? mercadoPago.config.RUN_AT_TIMES.join(", ") : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLoadedAt]);

  const byProvider = useMemo(() => Object.fromEntries(integrations.map((item) => [item.provider, item])) as Partial<Record<Provider, Integration>>, [integrations]);
  const canOperate = user?.role === "owner" || user?.role === "admin";
  const hasGoogle = subscription?.policy.entitlements?.googleDriveSheets === true;

  async function testIntegration(provider: Provider) {
    setPendingProvider(provider);
    setActionError("");
    setSuccessMessage("");
    try {
      const result = await api.request<TestResult>(`/portal/integrations/${provider}/test`, { method: "POST" });
      setTestResults((current) => ({ ...current, [provider]: result }));
    } catch (error) {
      const message = getPortalErrorMessage(error, "No pudimos probar la conexión. Reintentá.");
      if (message) setTestResults((current) => ({ ...current, [provider]: { ok: false, error: message } }));
    } finally {
      setPendingProvider(null);
    }
  }

  async function saveGoogle(provider: "DRIVE" | "SHEETS") {
    setPendingProvider(provider);
    setActionError("");
    setSuccessMessage("");
    try {
      await api.request(`/portal/integrations/${provider}`, {
        method: "PUT",
        body: { config: provider === "DRIVE" ? { DRIVE_FOLDER_ID: driveFolderId.trim() } : { SHEETS_ID: sheetsId.trim(), SHEET_NAME: sheetName.trim() || "Hoja1" } },
      });
      setSuccessMessage(`Listo, guardamos ${provider === "DRIVE" ? "la carpeta de Google Drive" : "la planilla de Google Sheets"}.`);
      await loadIntegrations();
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos guardar la integración. Reintentá."));
    } finally {
      setPendingProvider(null);
    }
  }

  async function saveMercadoPagoSchedule() {
    setPendingProvider("MERCADOPAGO");
    setActionError("");
    setSuccessMessage("");
    const runAtTimes = pollingRunAtTimes.split(",").map((value) => value.trim()).filter(Boolean);
    // Con "lecturas por día" se manda RUN_AT_TIMES: [] explícito para que el
    // backend descarte los horarios guardados antes (si no, seguirían ganando).
    const config = pollingMode === "realtime"
      ? { POLLING_MODE: pollingMode, POLLING_INTERVAL_MS: Number(pollingIntervalMs), TIMEZONE: pollingTimezone.trim() }
      : {
          POLLING_MODE: pollingMode,
          TIMEZONE: pollingTimezone.trim(),
          ...(runAtTimes.length > 0
            ? { RUN_AT_TIMES: runAtTimes }
            : { RUN_AT_TIMES: [] as string[], RUNS_PER_DAY: Number(pollingRunsPerDay) }),
        };
    try {
      await api.request("/portal/integrations/MERCADOPAGO", {
        method: "PUT",
        body: { config },
      });
      setSuccessMessage("Listo, guardamos la agenda de Mercado Pago.");
      await loadIntegrations();
    } catch (error) {
      setActionError(getPortalErrorMessage(error, "No pudimos guardar la agenda de Mercado Pago. Reintentá."));
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <main className="client-main client-integrations-page">
      <header className="app-topbar">
        <div><strong>Integraciones</strong><span>Consultá tus conexiones y configurá los destinos que incluye tu plan.</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => { setActionError(""); void loadIntegrations(); }} disabled={isLoading || isRefreshing}>{isRefreshing ? "Actualizando…" : "Actualizar"}</button>
      </header>

      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
      {isLoading ? <section className="panel"><div className="panel-state"><strong>Cargando integraciones…</strong></div></section> : null}

      {!isLoading && data ? <section className="client-integrations-grid">{providers.map(({ provider, label, detail }) => {
        const item = byProvider[provider];
        const isGoogleProvider = provider === "DRIVE" || provider === "SHEETS";
        const testResult = testResults[provider];
        const available = !isGoogleProvider || hasGoogle;
        const isConfigured = item ? (item.configured ?? item.enabled) : false;
        const pill = isConfigured
          ? { tone: "success", label: "Configurada" }
          : item?.enabled
            ? { tone: "warning", label: "Faltan credenciales" }
            : { tone: "muted", label: "Sin configurar" };
        return (
          <article className="panel client-integration-card" key={provider}>
            <div className="client-integration-card__heading"><span className="integration-logo-frame"><IntegrationLogo name={provider as IntegrationLogoName} /></span><div><h2>{label}</h2><p>{detail}</p></div><small className={`status-pill status-pill--${pill.tone}`}>{pill.label}</small></div>
            {!available ? <div className="panel-state"><strong>No disponible en tu plan</strong><span>Google Drive y Sheets están disponibles desde el plan Profesional.</span></div> : null}
            {available && provider === "MERCADOPAGO" ? <div className="client-integration-config">
              <label className="field"><span>Modalidad de polling</span><select value={pollingMode} onChange={(event) => setPollingMode(event.target.value)} disabled={!canOperate}>
                <option value="realtime">Tiempo real</option>
                {subscription?.policy.processing?.allowedModes?.includes("scheduled") ? <option value="scheduled">Programado</option> : null}
              </select></label>
              {pollingMode === "realtime" ? <label className="field"><span>Intervalo de lectura (ms)</span><input type="number" min={subscription?.policy.processing?.minRealtimeIntervalMs ?? 5000} step="1000" value={pollingIntervalMs} onChange={(event) => setPollingIntervalMs(event.target.value)} disabled={!canOperate} /></label> : <>
                <label className="field"><span>Lecturas por día</span><input type="number" min="1" max="1440" value={pollingRunsPerDay} onChange={(event) => setPollingRunsPerDay(event.target.value)} disabled={!canOperate || Boolean(pollingRunAtTimes.trim())} /></label>
                <label className="field"><span>Horarios programados</span><input value={pollingRunAtTimes} onChange={(event) => setPollingRunAtTimes(event.target.value)} disabled={!canOperate} placeholder="09:00, 18:00" /></label>
              </>}
              <label className="field"><span>Zona horaria</span><input value={pollingTimezone} onChange={(event) => setPollingTimezone(event.target.value)} disabled={!canOperate} /></label>
              {canOperate ? <button type="button" className="primary-button" disabled={pendingProvider === provider} onClick={() => void saveMercadoPagoSchedule()}>{pendingProvider === provider ? "Guardando…" : "Guardar agenda"}</button> : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
            </div> : null}
            {available && isGoogleProvider ? <div className="client-integration-config">
              {provider === "DRIVE" ? <label className="field"><span>ID de carpeta Drive</span><input value={driveFolderId} onChange={(event) => setDriveFolderId(event.target.value)} disabled={!canOperate} placeholder="ID de la carpeta compartida" /></label> : <><label className="field"><span>ID de planilla</span><input value={sheetsId} onChange={(event) => setSheetsId(event.target.value)} disabled={!canOperate} placeholder="ID del spreadsheet" /></label><label className="field"><span>Nombre de hoja</span><input value={sheetName} onChange={(event) => setSheetName(event.target.value)} disabled={!canOperate} /></label></>}
              {!item ? <p className="client-empty-state">Un administrador debe autorizar Google por OAuth antes del primer guardado.</p> : null}
              {canOperate ? <button type="button" className="primary-button" disabled={pendingProvider === provider} onClick={() => void saveGoogle(provider)}>{pendingProvider === provider ? "Guardando…" : "Guardar destino"}</button> : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
            </div> : null}
            {available && item ? <div className="client-integration-card__footer"><span>Actualizada {formatDateTime(item.updatedAt)}</span>{canOperate ? <button type="button" className="secondary-button" disabled={pendingProvider === provider} onClick={() => void testIntegration(provider)}>{pendingProvider === provider ? "Probando…" : "Probar conexión"}</button> : null}</div> : null}
            {testResult ? <div className={`panel-state${testResult.ok ? "" : " panel-state--danger"}`}><strong>{testResult.ok ? "Conexión correcta" : "Falló la conexión"}</strong><span>{testResult.error ?? testResult.warnings?.join(" ") ?? "La integración respondió correctamente."}</span></div> : null}
          </article>
        );
      })}</section> : null}
    </main>
  );
}
