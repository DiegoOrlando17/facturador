import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { IntegrationLogo, type IntegrationLogoName } from "@/components/ui/IntegrationLogo";
import { ApiError, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";

type Provider = "MERCADOPAGO" | "AFIP" | "DRIVE" | "SHEETS";
type Integration = {
  id: string;
  provider: Provider;
  enabled: boolean;
  updatedAt: string;
  config: Record<string, unknown>;
};
type Subscription = {
  planCode: string;
  policy: { entitlements?: Record<string, boolean> };
} | null;
type TestResult = { ok: boolean; connected?: boolean; warnings?: string[]; error?: string };

const providers: Array<{ provider: Provider; label: string; detail: string }> = [
  { provider: "MERCADOPAGO", label: "Mercado Pago", detail: "Origen de los pagos POS consultados por polling." },
  { provider: "AFIP", label: "ARCA", detail: "Emision fiscal y consulta de numeracion de comprobantes." },
  { provider: "DRIVE", label: "Google Drive", detail: "Carpeta opcional para guardar comprobantes emitidos." },
  { provider: "SHEETS", label: "Google Sheets", detail: "Planilla opcional con el estado de todos los pagos." },
];

export function ClientIntegrationsPage() {
  const navigate = useNavigate();
  const { invalidateSession, token, user } = useTenantAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [sheetsId, setSheetsId] = useState("");
  const [sheetName, setSheetName] = useState("Hoja1");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [testResults, setTestResults] = useState<Partial<Record<Provider, TestResult>>>({});

  const handleUnauthorized = useCallback(() => {
    invalidateSession();
    navigate("/portal-cliente/login", { replace: true });
  }, [invalidateSession, navigate]);

  const loadIntegrations = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [items, currentSubscription] = await Promise.all([
        apiRequest<Integration[]>("/portal/integrations", { token, skipAuthHandling: true }),
        apiRequest<Subscription>("/portal/subscription", { token, skipAuthHandling: true }),
      ]);
      setIntegrations(items);
      setSubscription(currentSubscription);
      const drive = items.find((item) => item.provider === "DRIVE");
      const sheets = items.find((item) => item.provider === "SHEETS");
      setDriveFolderId(String(drive?.config.DRIVE_FOLDER_ID ?? ""));
      setSheetsId(String(sheets?.config.SHEETS_ID ?? ""));
      setSheetName(String(sheets?.config.SHEET_NAME ?? "Hoja1"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setErrorMessage(getApiErrorMessage(error, "No se pudieron cargar las integraciones."));
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized, token]);

  useEffect(() => { void loadIntegrations(); }, [loadIntegrations]);

  const byProvider = useMemo(() => Object.fromEntries(integrations.map((item) => [item.provider, item])) as Partial<Record<Provider, Integration>>, [integrations]);
  const canOperate = user?.role === "owner" || user?.role === "admin";
  const hasGoogle = subscription?.policy.entitlements?.googleDriveSheets === true;

  async function testIntegration(provider: Provider) {
    if (!token) return;
    setPendingProvider(provider);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<TestResult>(`/portal/integrations/${provider}/test`, { method: "POST", token, skipAuthHandling: true });
      setTestResults((current) => ({ ...current, [provider]: result }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setTestResults((current) => ({ ...current, [provider]: { ok: false, error: getApiErrorMessage(error, "No se pudo probar la conexion.") } }));
    } finally {
      setPendingProvider(null);
    }
  }

  async function saveGoogle(provider: "DRIVE" | "SHEETS") {
    if (!token) return;
    setPendingProvider(provider);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest(`/portal/integrations/${provider}`, {
        method: "PUT",
        token,
        skipAuthHandling: true,
        body: { config: provider === "DRIVE" ? { DRIVE_FOLDER_ID: driveFolderId.trim() } : { SHEETS_ID: sheetsId.trim(), SHEET_NAME: sheetName.trim() || "Hoja1" } },
      });
      setSuccessMessage(`${provider === "DRIVE" ? "Carpeta Drive" : "Planilla Sheets"} guardada correctamente.`);
      await loadIntegrations();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return handleUnauthorized();
      setErrorMessage(getApiErrorMessage(error, "No se pudo guardar la integracion."));
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <main className="client-main client-integrations-page">
      <header className="app-topbar">
        <div><strong>Integraciones</strong><span>Consulta conexiones y configura los destinos disponibles para tu plan.</span></div>
        <button type="button" className="secondary-button topbar-refresh-button" onClick={() => void loadIntegrations()} disabled={isLoading}>Actualizar</button>
      </header>

      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
      {isLoading ? <section className="panel"><div className="panel-state"><strong>Cargando integraciones...</strong></div></section> : null}

      {!isLoading ? <section className="client-integrations-grid">{providers.map(({ provider, label, detail }) => {
        const item = byProvider[provider];
        const isGoogleProvider = provider === "DRIVE" || provider === "SHEETS";
        const testResult = testResults[provider];
        const available = !isGoogleProvider || hasGoogle;
        return (
          <article className="panel client-integration-card" key={provider}>
            <div className="client-integration-card__heading"><span className="integration-logo-frame"><IntegrationLogo name={provider as IntegrationLogoName} /></span><div><h2>{label}</h2><p>{detail}</p></div><small className={`status-pill status-pill--${item?.enabled ? "success" : "muted"}`}>{item?.enabled ? "Configurada" : "Sin configurar"}</small></div>
            {!available ? <div className="panel-state"><strong>No disponible en tu plan</strong><span>Drive y Sheets se habilitan desde la tier 3.</span></div> : null}
            {available && isGoogleProvider ? <div className="client-integration-config">
              {provider === "DRIVE" ? <label className="field"><span>ID de carpeta Drive</span><input value={driveFolderId} onChange={(event) => setDriveFolderId(event.target.value)} disabled={!canOperate} placeholder="ID de la carpeta compartida" /></label> : <><label className="field"><span>ID de planilla</span><input value={sheetsId} onChange={(event) => setSheetsId(event.target.value)} disabled={!canOperate} placeholder="ID del spreadsheet" /></label><label className="field"><span>Nombre de hoja</span><input value={sheetName} onChange={(event) => setSheetName(event.target.value)} disabled={!canOperate} /></label></>}
              {!item ? <p className="client-empty-state">Un administrador debe autorizar Google por OAuth antes del primer guardado.</p> : null}
              {canOperate ? <button type="button" className="primary-button" disabled={pendingProvider === provider} onClick={() => void saveGoogle(provider)}>{pendingProvider === provider ? "Guardando..." : "Guardar destino"}</button> : <p className="client-empty-state">Tu rol tiene acceso de solo lectura.</p>}
            </div> : null}
            {available && item ? <div className="client-integration-card__footer"><span>Actualizada {formatDateTime(item.updatedAt)}</span>{canOperate ? <button type="button" className="secondary-button" disabled={pendingProvider === provider} onClick={() => void testIntegration(provider)}>{pendingProvider === provider ? "Probando..." : "Probar conexion"}</button> : null}</div> : null}
            {testResult ? <div className={`panel-state${testResult.ok ? "" : " panel-state--danger"}`}><strong>{testResult.ok ? "Conexion correcta" : "Fallo la conexion"}</strong><span>{testResult.error ?? testResult.warnings?.join(" ") ?? "La integracion respondio correctamente."}</span></div> : null}
          </article>
        );
      })}</section> : null}
    </main>
  );
}
