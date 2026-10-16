import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/AuthContext";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { useApiResource } from "@/hooks/useApiResource";
import { apiBlobRequest, apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

type TenantStatus = "ACTIVE" | "DISABLED";
type TenantUserRole = "owner" | "admin" | "viewer" | "approver";
type IntegrationProvider = "MERCADOPAGO" | "AFIP" | "DRIVE" | "SHEETS";
type IntegrationFieldValueType = "string" | "number" | "list";
type IntegrationFieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
  multiline?: boolean;
  inputType?: "text" | "password" | "number" | "url";
  valueType?: IntegrationFieldValueType;
  options?: Array<{ value: string; label: string }>;
  helper?: string;
};
type MercadopagoPollingMode = "realtime" | "scheduled";
type MercadopagoScheduleMode = "runs" | "times";
type TenantDetailTab =
  | "summary"
  | "onboarding"
  | "profile"
  | "subscription"
  | "integrations"
  | "payments"
  | "users"
  | "notes"
  | "advanced";
type PlanPolicy = {
  tier: number | null;
  entitlements: Record<string, boolean>;
  processing: {
    allowedModes: string[];
    defaultMode: string | null;
    minRealtimeIntervalMs: number | null;
    maxRunsPerDay: number | null;
  };
};
type PaymentStatus =
  | "pending"
  | "processing"
  | "afip_pending"
  | "pdf_pending"
  | "drive_pending"
  | "sheets_pending"
  | "complete"
  | "failed";

type TenantDetailResponse = {
  identity: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    createdAt: string;
    updatedAt: string;
  };
  currentSubscription: {
    id?: string;
    planId?: string;
    status: string;
    planCode: string | null;
    planName: string | null;
    billingProvider: string | null;
    billingRef: string | null;
    policy?: PlanPolicy | null;
    updatedAt?: string;
  };
  users: {
    total: number;
  };
  profile: TenantProfile | null;
  integrations: {
    overallHealth: string;
    enabledCount: number;
    configuredCount: number;
    needsAttentionCount: number;
    items: Array<{
      id: string;
      provider: string;
      health: string;
      enabled: boolean;
      configured: boolean;
      updatedAt: string;
    }>;
  };
  metrics: {
    totalPayments: number;
    totalAmount: number;
    statuses?: Record<string, { count: number; amount: number }>;
    recentPayments: Array<{
      id: string;
      amount: number;
      status: string;
      customer: string | null;
      createdAt: string;
    }>;
  };
  notes: {
    total: number;
    items: Array<{
      id: string;
      title: string;
      body: string;
      pinned: boolean;
      createdAt: string;
    }>;
  };
};

type TenantProfile = {
  id?: string;
  tenantId?: string;
  legalName: string | null;
  tradeName: string | null;
  cuit: string | null;
  ivaCondition: string | null;
  fiscalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  approvalStatus?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewedByAdminUserId?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  price: number | null;
  currency: string;
  billingCycle: string;
  status: "ACTIVE" | "DISABLED" | string;
  description: string | null;
  featuresJson: string | null;
};

type PlansResponse = {
  items: Plan[];
  total: number;
};

type UpdateTenantResponse = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
};

type TenantNote = {
  id: string;
  tenantId: string;
  createdByAdminUserId: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  createdByAdmin?: {
    id: string;
    email: string;
    role: string;
  };
};

type TenantUser = {
  id: string;
  tenantId: string;
  email: string;
  role: TenantUserRole;
  passwordHash?: string;
  status: TenantStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TenantIntegration = {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  config: Record<string, unknown>;
};

type TenantPayment = {
  id: string;
  tenantId: string;
  provider: string;
  provider_payment_id: string | null;
  status: PaymentStatus | string;
  payment_method_id: string | null;
  amount: number;
  currency: string | null;
  customer: string | null;
  customer_doc_type: string | null;
  customer_doc_number: string | null;
  date_approved: string | null;
  cae: string | null;
  cae_vto: string | null;
  cbte_nro: string | null;
  cbte_tipo: number | null;
  pto_vta: number | null;
  pdf_path: string | null;
  drive_file_link: string | null;
  sheets_row: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type TenantPaymentsResponse = {
  items: TenantPayment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type ReadinessSeverity = "blocking" | "degraded";

type ReadinessItem = {
  id: string;
  label: string;
  /** Etiqueta corta para el estado operativo cuando este punto es el primero pendiente. */
  missingLabel: string;
  detail: string;
  isComplete: boolean;
  severity: ReadinessSeverity;
  tab: TenantDetailTab;
  impact: string;
  action: string;
};

type TenantOperationalActionResponse = {
  ok?: boolean;
  message?: string;
  jobId?: string;
  status?: string;
};

type IntegrationTestResponse = {
  ok?: boolean;
  connected?: boolean;
  provider?: IntegrationProvider;
  warnings?: string[];
  error?: string;
  [key: string]: unknown;
};

type GoogleOAuthUrlResponse = {
  authUrl: string;
  flowId: string;
};

type OnboardingSubmission = {
  id: string;
  tenantId: string;
  status: "pending" | "approved" | "rejected" | string;
  submittedByUserId: string | null;
  reviewedByAdminUserId: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  data?: {
    processingStartDate?: string;
    [key: string]: unknown;
  };
  documents?: Array<{
    type: string;
    name: string;
    url: string;
  }>;
};

type OnboardingSubmissionsResponse = {
  items: OnboardingSubmission[];
  total: number;
};

type DeleteTenantResponse = {
  ok: boolean;
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
  deleted: Record<string, number>;
  files?: {
    requested: number;
    deleted: number;
    missing: number;
    failed: string[];
  };
};

const integrationProviders: IntegrationProvider[] = ["MERCADOPAGO", "AFIP", "DRIVE", "SHEETS"];

const integrationTemplates: Record<IntegrationProvider, Record<string, unknown>> = {
  MERCADOPAGO: {
    ACCESS_TOKEN: "",
    POS_ID: "",
    POLLING_MODE: "realtime",
    POLLING_INTERVAL_MS: 5000,
  },
  AFIP: {
    CUIT: "",
    PTO_VTA: 1,
    CBTE_TIPO: 6,
    ALIC_IVA: 21,
    CERT_B64: "",
    KEY_B64: "",
  },
  DRIVE: {
    DRIVE_FOLDER_ID: "",
  },
  SHEETS: {
    SHEETS_ID: "",
    SHEET_NAME: "",
  },
};

const integrationFieldDefinitions: Record<IntegrationProvider, IntegrationFieldDefinition[]> = {
  MERCADOPAGO: [
    { key: "ACCESS_TOKEN", label: "Access token", required: true, secret: true, inputType: "password" },
    { key: "POS_ID", label: "POS ID", required: true },
    {
      key: "POLLING_MODE",
      label: "Modo de lectura",
      options: [
        { value: "realtime", label: "Tiempo real" },
        { value: "scheduled", label: "Programado" },
      ],
    },
    { key: "POLLING_INTERVAL_MS", label: "Intervalo de lectura (ms)", inputType: "number", valueType: "number" },
    { key: "RUNS_PER_DAY", label: "Lecturas por día", inputType: "number", valueType: "number" },
    { key: "RUN_AT_TIMES", label: "Horarios programados", valueType: "list", helper: "Podés cargar varios horarios." },
  ],
  AFIP: [
    { key: "CUIT", label: "CUIT", required: true },
    { key: "PTO_VTA", label: "Punto de venta", required: true, inputType: "number", valueType: "number" },
    { key: "CBTE_TIPO", label: "Tipo de comprobante", required: true, inputType: "number", valueType: "number" },
    { key: "ALIC_IVA", label: "Alícuota IVA", inputType: "number", valueType: "number" },
  ],
  DRIVE: [
    { key: "DRIVE_FOLDER_ID", label: "Carpeta de Drive" },
  ],
  SHEETS: [
    { key: "SHEETS_ID", label: "ID de la planilla" },
    { key: "SHEET_NAME", label: "Nombre de la hoja" },
  ],
};

// Credenciales que administra el flujo de autorización de Google: no se editan a mano.
const googleManagedConfigKeys = [
  "REFRESH_TOKEN",
  "ACCESS_TOKEN",
  "SCOPES",
  "TOKEN_TYPE",
  "EXPIRY_DATE",
  "ID_TOKEN",
  "refresh_token",
  "access_token",
  "scope",
  "token_type",
  "expiry_date",
  "id_token",
];

const providerClientIgnoredConfigKeys: Partial<Record<IntegrationProvider, Set<string>>> = {
  MERCADOPAGO: new Set(["API_URL"]),
  AFIP: new Set(["WSAA_URL", "WSFE_URL", "CERT_B64", "KEY_B64", "CERT_PATH", "KEY_PATH"]),
  DRIVE: new Set(googleManagedConfigKeys),
  SHEETS: new Set(googleManagedConfigKeys),
};

function isGoogleProvider(provider: IntegrationProvider) {
  return provider === "DRIVE" || provider === "SHEETS";
}

function hasGoogleAuthorization(config: Record<string, unknown> | undefined) {
  return Boolean(config?.REFRESH_TOKEN || config?.refresh_token);
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasMaskedValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.includes("***");
  }

  if (Array.isArray(value)) {
    return value.some(hasMaskedValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(hasMaskedValue);
  }

  return false;
}

function hasBlankConfigValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.some(hasBlankConfigValue);
  if (value && typeof value === "object") return Object.values(value).some(hasBlankConfigValue);
  return false;
}

function isSecretishKey(key: string) {
  return /token|secret|key|password|sign|cert/i.test(key);
}

function stringifyIntegrationFieldValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return String(value);
}

const mercadopagoPollingModes: MercadopagoPollingMode[] = ["realtime", "scheduled"];

function isMercadopagoPollingMode(value: unknown): value is MercadopagoPollingMode {
  return value === "realtime" || value === "scheduled";
}

/**
 * Modos de lectura que habilita la política del plan actual (`processing.allowedModes`).
 * Sin política conocida no se restringe nada: el backend valida contra el plan al guardar.
 */
function getAllowedMercadopagoPollingModes(policy: PlanPolicy | null | undefined): MercadopagoPollingMode[] {
  if (!policy) return mercadopagoPollingModes;
  return policy.processing.allowedModes.filter(isMercadopagoPollingMode);
}

/** Modo efectivo: el guardado si el plan lo permite; si no, el modo por defecto del plan. */
function getMercadopagoPollingMode(
  policy: PlanPolicy | null | undefined,
  values: Record<string, string>,
): MercadopagoPollingMode {
  const allowedModes = getAllowedMercadopagoPollingModes(policy);
  const currentMode = values.POLLING_MODE?.trim().toLowerCase();

  if (isMercadopagoPollingMode(currentMode) && allowedModes.includes(currentMode)) {
    return currentMode;
  }

  const defaultMode = policy?.processing.defaultMode;
  if (isMercadopagoPollingMode(defaultMode) && allowedModes.includes(defaultMode)) {
    return defaultMode;
  }

  return allowedModes[0] ?? "realtime";
}

function getMercadopagoPollingModeLabel(mode: MercadopagoPollingMode) {
  return mode === "realtime" ? "Tiempo real" : "Programado";
}

function getMercadopagoScheduleMode(values: Record<string, string>): MercadopagoScheduleMode {
  return values.RUN_AT_TIMES?.trim() ? "times" : "runs";
}

function getIntegrationFields(provider: IntegrationProvider, config: Record<string, unknown> = {}) {
  const baseFields = integrationFieldDefinitions[provider];
  const knownKeys = new Set(baseFields.map((field) => field.key));
  const ignoredKeys = providerClientIgnoredConfigKeys[provider] ?? new Set<string>();
  const extraFields = Object.keys(config)
    .filter((key) => !knownKeys.has(key) && !ignoredKeys.has(key))
    .map<IntegrationFieldDefinition>((key) => ({
      key,
      label: key.replace(/_/g, " ").toLowerCase(),
      secret: isSecretishKey(key),
      inputType: isSecretishKey(key) ? "password" : "text",
      multiline: stringifyIntegrationFieldValue(config[key]).includes("\n"),
    }));

  return [...baseFields, ...extraFields];
}

function getSavedIntegrationDisplayFields(provider: IntegrationProvider, config: Record<string, unknown> = {}) {
  const managedFileFields: IntegrationFieldDefinition[] = provider === "AFIP"
    ? [
        { key: "CERT_B64", label: "Certificado ARCA", secret: true },
        { key: "KEY_B64", label: "Clave privada ARCA", secret: true },
      ].filter((field) => config[field.key])
    : [];

  return [...getIntegrationFields(provider, config), ...managedFileFields];
}

function buildIntegrationFormValues(provider: IntegrationProvider, config: Record<string, unknown> = {}) {
  const initialConfig = { ...integrationTemplates[provider], ...config };
  providerClientIgnoredConfigKeys[provider]?.forEach((key) => {
    delete initialConfig[key];
  });

  return Object.fromEntries(
    getIntegrationFields(provider, initialConfig).map((field) => [
      field.key,
      stringifyIntegrationFieldValue(initialConfig[field.key]),
    ]),
  );
}

function coerceIntegrationFieldValue(field: IntegrationFieldDefinition, rawValue: string) {
  const trimmedValue = rawValue.trim();

  if (field.valueType === "number") {
    return trimmedValue ? Number(trimmedValue) : "";
  }

  if (field.valueType === "list") {
    return trimmedValue
      ? trimmedValue.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  }

  return rawValue;
}

function buildIntegrationConfig(provider: IntegrationProvider, values: Record<string, string>, fields = getIntegrationFields(provider, values)) {
  const config: Record<string, unknown> = {};
  const allowedKeys = new Set(fields.map((field) => field.key));

  fields.forEach((field) => {
    const value = values[field.key] ?? "";
    const isRequired = Boolean(field.required);
    const shouldKeep = isRequired || value.trim() !== "";

    if (shouldKeep) {
      config[field.key] = coerceIntegrationFieldValue(field, value);
    }
  });

  providerClientIgnoredConfigKeys[provider]?.forEach((key) => {
    delete config[key];
  });

  Object.keys(config).forEach((key) => {
    if (!allowedKeys.has(key)) delete config[key];
  });

  return config;
}

function getMaskedDisplayValue(value: unknown) {
  const text = getDisplayValue(value);
  if (text === "Sin dato") return text;
  return "********";
}

function getDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (Array.isArray(value)) return value.length > 0 ? value.map((item) => String(item)).join(", ") : "Sin dato";
  if (typeof value === "object") return "Configuracion avanzada";
  return String(value);
}

function parseRunTimes(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatRunTimes(values: string[]) {
  return values.filter(Boolean).join(", ");
}

function getIntegrationTestValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.map((item) => String(item)).join(", ") : "Sin dato";

  if (typeof value === "object") {
    const current = value as Record<string, unknown>;
    const parts = [
      current.id ? `ID ${String(current.id)}` : null,
      current.name ? String(current.name) : null,
      current.status ? `Estado ${String(current.status)}` : null,
      current.date_approved ? `Aprobado ${String(current.date_approved)}` : null,
      current.transaction_amount ? `Importe ${String(current.transaction_amount)}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" - ") : "Disponible";
  }

  return String(value);
}

function getIntegrationTestLabel(key: string) {
  const labels: Record<string, string> = {
    requestedPosId: "POS consultado",
    posMatched: "POS encontrado",
    latestPayment: "Ultimo pago encontrado",
    latestAnyPayment: "Ultimo pago general",
    cuit: "CUIT",
    ptoVta: "Punto de venta",
    cbteTipo: "Tipo de comprobante",
    lastCbteNro: "Ultimo comprobante",
    nextCbteNro: "Proximo comprobante",
    checkedResource: "Recurso consultado",
    spreadsheetTitle: "Planilla",
    folderName: "Carpeta",
    sampleFile: "Archivo de referencia",
  };

  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

function getIntegrationTestRows(result: IntegrationTestResponse) {
  const hiddenKeys = new Set(["ok", "connected", "provider", "warnings", "error"]);

  return Object.entries(result)
    .filter(([key]) => !hiddenKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: getIntegrationTestLabel(key),
      value: getIntegrationTestValue(value),
    }));
}

function getIntegrationProviderLabel(provider: IntegrationProvider | string) {
  switch (provider) {
    case "MERCADOPAGO":
      return "Mercado Pago";
    case "AFIP":
      return "ARCA";
    case "DRIVE":
      return "Google Drive";
    case "SHEETS":
      return "Google Sheets";
    default:
      return provider;
  }
}

type TenantIntegrationSummaryItem = TenantDetailResponse["integrations"]["items"][number];

function getIntegrationSummaryItem(data: TenantDetailResponse, provider: IntegrationProvider) {
  return data.integrations.items.find((item) => item.provider === provider);
}

/** Configurada = activada y con configuración guardada, según el resumen del backend. */
function isIntegrationReady(item: TenantIntegrationSummaryItem | undefined) {
  return Boolean(item?.enabled && item.configured && item.health === "configured");
}

function getIntegrationReadinessDetail(
  item: TenantIntegrationSummaryItem | undefined,
  readyDetail: string,
  missingDetail: string,
) {
  if (isIntegrationReady(item)) return readyDetail;
  if (item && !item.enabled) return "La integración está guardada pero desactivada.";
  if (item && !item.configured) return "La integración está activada pero sin configuración.";
  return missingDetail;
}

function buildReadinessItems(
  data: TenantDetailResponse,
  activeAdminUser: TenantUser | undefined,
  areUsersLoaded: boolean,
): ReadinessItem[] {
  const profileApprovalStatus = getProfileApprovalStatus(data.profile);
  const subscription = data.currentSubscription;
  const hasActivePlan = Boolean(subscription.planName) && subscription.status === "ACTIVE";
  const includesGoogle = subscription.policy?.entitlements?.googleDriveSheets === true;
  const mercadopago = getIntegrationSummaryItem(data, "MERCADOPAGO");
  const afip = getIntegrationSummaryItem(data, "AFIP");
  const drive = getIntegrationSummaryItem(data, "DRIVE");
  const sheets = getIntegrationSummaryItem(data, "SHEETS");

  const items: ReadinessItem[] = [
    {
      id: "tenant-active",
      label: "Cliente activo",
      missingLabel: "Cliente inactivo",
      detail: data.identity.status === "ACTIVE" ? "El cliente puede operar." : "Activá el cliente antes de iniciar.",
      isComplete: data.identity.status === "ACTIVE",
      severity: "blocking",
      tab: "summary",
      impact: "Bloquea cualquier procesamiento automático",
      action: "Activar cliente",
    },
    {
      id: "tenant-profile",
      label: "Datos fiscales aprobados",
      missingLabel: "Falta aprobación fiscal",
      detail: profileApprovalStatus === "APPROVED"
        ? "Datos fiscales y de contacto aprobados."
        : isProfileComplete(data.profile)
          ? `Datos completos, estado ${getProfileApprovalLabel(profileApprovalStatus).toLowerCase()}.`
          : "Completá razón social, CUIT, condición de IVA, domicilio y email.",
      isComplete: profileApprovalStatus === "APPROVED",
      severity: "blocking",
      tab: "profile",
      impact: "Bloquea la activación fiscal",
      action: "Revisar datos fiscales",
    },
    {
      id: "plan",
      label: "Plan asignado",
      missingLabel: subscription.planName ? "Suscripción no activa" : "Falta plan",
      detail: hasActivePlan
        ? `${subscription.planName} asignado al cliente.`
        : subscription.planName
          ? `${subscription.planName} asignado, pero la suscripción no está activa.`
          : "Asigná un plan comercial antes de habilitar la operación.",
      isComplete: hasActivePlan,
      severity: "blocking",
      tab: "subscription",
      impact: "Bloquea la operación comercial",
      action: "Asignar plan",
    },
    {
      id: "portal-user",
      label: "Usuario responsable",
      missingLabel: "Falta usuario responsable",
      detail: activeAdminUser
        ? `${activeAdminUser.email} tiene rol ${activeAdminUser.role}.`
        : areUsersLoaded
          ? "Creá al menos un usuario owner o admin activo para el portal."
          : "Cargando usuarios...",
      isComplete: Boolean(activeAdminUser),
      severity: "blocking",
      tab: "users",
      impact: "Impide que el cliente opere su portal",
      action: "Crear usuario",
    },
    {
      id: "mercadopago",
      label: "Mercado Pago",
      missingLabel: "Falta Mercado Pago",
      detail: getIntegrationReadinessDetail(mercadopago, "Credenciales de cobro cargadas.", "Cargá el access token y el POS ID."),
      isComplete: isIntegrationReady(mercadopago),
      severity: "blocking",
      tab: "integrations",
      impact: "Bloquea la lectura automática de cobros",
      action: "Configurar Mercado Pago",
    },
    {
      id: "afip",
      label: "ARCA",
      missingLabel: "Falta ARCA",
      detail: getIntegrationReadinessDetail(afip, "Datos fiscales y certificado cargados.", "Cargá CUIT, punto de venta, tipo de comprobante y certificados."),
      isComplete: isIntegrationReady(afip),
      severity: "blocking",
      tab: "integrations",
      impact: "Bloquea la emisión de comprobantes",
      action: "Configurar ARCA",
    },
  ];

  // Drive y Sheets solo cuentan si el plan los incluye; nunca bloquean la facturación.
  if (includesGoogle) {
    items.push(
      {
        id: "drive",
        label: "Google Drive",
        missingLabel: "Falta Google Drive",
        detail: getIntegrationReadinessDetail(drive, "Conexión de Drive cargada.", "Autorizá Google y configurá la carpeta de destino."),
        isComplete: isIntegrationReady(drive),
        severity: "degraded",
        tab: "integrations",
        impact: "No bloquea la facturación; degrada la entrega de PDFs",
        action: "Configurar Drive",
      },
      {
        id: "sheets",
        label: "Google Sheets",
        missingLabel: "Falta Google Sheets",
        detail: getIntegrationReadinessDetail(sheets, "Conexión de Sheets cargada.", "Autorizá Google y configurá la planilla de destino."),
        isComplete: isIntegrationReady(sheets),
        severity: "degraded",
        tab: "integrations",
        impact: "No bloquea la facturación; degrada el registro en la planilla",
        action: "Configurar Sheets",
      },
    );
  }

  return items;
}

function getTenantOperationalStatus(data: TenantDetailResponse, readinessItems: ReadinessItem[]) {
  if (data.identity.status === "DISABLED") {
    return {
      label: "Suspendido",
      tone: "muted",
      detail: "El cliente está deshabilitado.",
      action: "Activar cliente",
    };
  }

  const blocker = readinessItems.find((item) => item.severity === "blocking" && !item.isComplete);

  if (blocker) {
    return {
      label: blocker.missingLabel,
      tone: "danger",
      detail: `${blocker.impact}.`,
      action: blocker.action,
    };
  }

  const degraded = readinessItems.filter((item) => item.severity === "degraded" && !item.isComplete);

  if (degraded.length > 0) {
    return {
      label: "Operativo con advertencias",
      tone: "warning",
      detail: `Puede facturar, pero falta: ${degraded.map((item) => item.label).join(", ")}.`,
      action: degraded[0].action,
    };
  }

  return {
    label: "Listo para facturar",
    tone: "success",
    detail: "Datos fiscales, plan e integraciones necesarias están completos.",
    action: "Monitorear la facturación",
  };
}

function prettifyStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getOnboardingSubmissionLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pendiente de revisión";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
    default:
      return prettifyStatus(status);
  }
}

function getOnboardingSubmissionTone(status: string) {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "muted";
}

function getMonthStartDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

function isProfileComplete(profile: TenantProfile | null | undefined) {
  return Boolean(
    profile?.legalName
      && profile.cuit
      && profile.ivaCondition
      && profile.fiscalAddress
      && profile.contactEmail,
  );
}

function getProfileApprovalStatus(profile: TenantProfile | null | undefined) {
  return profile?.approvalStatus ?? "DRAFT";
}

function getProfileApprovalLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "Aprobado";
    case "PENDING":
      return "Pendiente";
    case "REJECTED":
      return "Rechazado";
    default:
      return "Borrador";
  }
}

function getProfileApprovalBadgeTone(status: string) {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "muted";
  }
}

function getBillingCycleLabel(cycle: string) {
  switch (cycle) {
    case "monthly":
      return "Mensual";
    case "yearly":
      return "Anual";
    case "one_time":
      return "Unico";
    default:
      return cycle;
  }
}

function formatPlanPrice(plan: Plan) {
  if (plan.price === null || plan.price === undefined) {
    return "Precio sin definir";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: plan.currency || "ARS",
    maximumFractionDigits: 0,
  }).format(plan.price);
}

function getPaymentStageLabel(status: string) {
  if (status === "complete") return "Completado";
  if (status === "failed") return "Con error";
  if (status === "afip_pending") return "Enviado a ARCA";
  if (status === "pdf_pending") return "CAE obtenido";
  if (status === "drive_pending") return "PDF generado";
  if (status === "sheets_pending") return "Drive OK";
  if (status === "processing") return "Procesando";
  return "Pago recibido";
}

function getPaymentStageTone(status: string) {
  if (status === "complete") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

const tenantDetailTabs: Array<{ id: TenantDetailTab; label: string; superadminOnly?: boolean }> = [
  { id: "summary", label: "Resumen" },
  { id: "onboarding", label: "Onboarding" },
  { id: "profile", label: "Datos fiscales" },
  { id: "subscription", label: "Plan y estado" },
  { id: "integrations", label: "Integraciones" },
  { id: "payments", label: "Facturación" },
  { id: "users", label: "Usuarios" },
  { id: "notes", label: "Notas" },
  { id: "advanced", label: "Avanzado", superadminOnly: true },
];

function isTenantDetailTab(value: string | null): value is TenantDetailTab {
  return tenantDetailTabs.some((tab) => tab.id === value);
}

function sumStatusMetrics(
  statuses: Record<string, { count: number; amount: number }> | undefined,
  predicate: (status: string) => boolean,
) {
  return Object.entries(statuses ?? {}).reduce(
    (total, [status, metric]) => (predicate(status)
      ? { count: total.count + metric.count, amount: total.amount + metric.amount }
      : total),
    { count: 0, amount: 0 },
  );
}

export function TenantDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { token, user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperadmin = user?.role === "SUPERADMIN";
  const canRevealSecrets = isSuperadmin;
  const requestedTab = searchParams.get("tab");
  const activeTab: TenantDetailTab = isTenantDetailTab(requestedTab) && (requestedTab !== "advanced" || isSuperadmin)
    ? requestedTab
    : "summary";
  const setActiveTab = (tab: TenantDetailTab) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (tab === "summary") nextParams.delete("tab");
      else nextParams.set("tab", tab);
      return nextParams;
    });
  };
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantStatus, setTenantStatus] = useState<TenantStatus>("ACTIVE");
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [profileLegalName, setProfileLegalName] = useState("");
  const [profileTradeName, setProfileTradeName] = useState("");
  const [profileCuit, setProfileCuit] = useState("");
  const [profileIvaCondition, setProfileIvaCondition] = useState("");
  const [profileFiscalAddress, setProfileFiscalAddress] = useState("");
  const [profileContactEmail, setProfileContactEmail] = useState("");
  const [profileContactPhone, setProfileContactPhone] = useState("");
  const [profileResponsibleName, setProfileResponsibleName] = useState("");
  const [profileResponsibleEmail, setProfileResponsibleEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState<string | null>(null);
  const [profileReviewNotes, setProfileReviewNotes] = useState("");
  const [isReviewingProfile, setIsReviewingProfile] = useState(false);
  const [profileReviewErrorMessage, setProfileReviewErrorMessage] = useState<string | null>(null);
  const [profileReviewSuccessMessage, setProfileReviewSuccessMessage] = useState<string | null>(null);
  const [subscriptionPlanId, setSubscriptionPlanId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("ACTIVE");
  const [subscriptionBillingProvider, setSubscriptionBillingProvider] = useState("");
  const [subscriptionBillingRef, setSubscriptionBillingRef] = useState("");
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [subscriptionErrorMessage, setSubscriptionErrorMessage] = useState<string | null>(null);
  const [subscriptionSuccessMessage, setSubscriptionSuccessMessage] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [isNotePinned, setIsNotePinned] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [noteErrorMessage, setNoteErrorMessage] = useState<string | null>(null);
  const [noteSuccessMessage, setNoteSuccessMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<TenantUserRole>("viewer");
  const [userStatus, setUserStatus] = useState<TenantStatus>("ACTIVE");
  const [userPassword, setUserPassword] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userErrorMessage, setUserErrorMessage] = useState<string | null>(null);
  const [userSuccessMessage, setUserSuccessMessage] = useState<string | null>(null);
  const [integrationProvider, setIntegrationProvider] = useState<IntegrationProvider>("MERCADOPAGO");
  const [isIntegrationEnabled, setIsIntegrationEnabled] = useState(true);
  const [integrationFormValues, setIntegrationFormValues] = useState<Record<string, string>>(
    buildIntegrationFormValues("MERCADOPAGO"),
  );
  const [isSavingIntegration, setIsSavingIntegration] = useState(false);
  const [isTestingIntegration, setIsTestingIntegration] = useState(false);
  const [isAuthorizingGoogle, setIsAuthorizingGoogle] = useState(false);
  const [integrationErrorMessage, setIntegrationErrorMessage] = useState<string | null>(null);
  const [integrationSuccessMessage, setIntegrationSuccessMessage] = useState<string | null>(null);
  const [integrationTestResult, setIntegrationTestResult] = useState<IntegrationTestResponse | null>(null);
  const [visibleIntegrationSecretFields, setVisibleIntegrationSecretFields] = useState<Record<string, boolean>>({});
  const [revealedIntegrationByProvider, setRevealedIntegrationByProvider] = useState<Partial<Record<IntegrationProvider, TenantIntegration>>>({});
  const [isRevealingIntegrationSecrets, setIsRevealingIntegrationSecrets] = useState(false);
  const [afipFileNames, setAfipFileNames] = useState<Partial<Record<"CERT_B64" | "KEY_B64", string>>>({});
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [paymentProviderFilter, setPaymentProviderFilter] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [isExportingPayments, setIsExportingPayments] = useState(false);
  const [paymentsExportErrorMessage, setPaymentsExportErrorMessage] = useState<string | null>(null);
  const [mercadoPagoImportFrom, setMercadoPagoImportFrom] = useState(getMonthStartDate);
  const [isImportingMercadoPagoPayments, setIsImportingMercadoPagoPayments] = useState(false);
  const [mercadoPagoImportMessage, setMercadoPagoImportMessage] = useState<string | null>(null);
  const [mercadoPagoImportErrorMessage, setMercadoPagoImportErrorMessage] = useState<string | null>(null);
  const [approvalPaymentsFrom, setApprovalPaymentsFrom] = useState(getMonthStartDate);
  const [isApprovingOnboarding, setIsApprovingOnboarding] = useState(false);
  const [isRejectingOnboarding, setIsRejectingOnboarding] = useState(false);
  const [onboardingReviewNotes, setOnboardingReviewNotes] = useState("");
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvalErrorMessage, setApprovalErrorMessage] = useState<string | null>(null);
  const [deleteConfirmationSlug, setDeleteConfirmationSlug] = useState("");
  const [shouldDeleteLocalFiles, setShouldDeleteLocalFiles] = useState(true);
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const {
    data,
    errorMessage,
    isLoading,
    reload,
  } = useApiResource<TenantDetailResponse>(`/admin/tenants/${slug}`, {
    enabled: Boolean(slug),
    fallbackErrorMessage: "No se pudo cargar el detalle del cliente.",
  });
  const {
    data: notes,
    errorMessage: notesErrorMessage,
    isLoading: areNotesLoading,
    reload: reloadNotes,
  } = useApiResource<TenantNote[]>(`/admin/tenants/${slug}/notes`, {
    enabled: Boolean(slug),
    fallbackErrorMessage: "No se pudieron cargar las notas internas.",
  });
  const {
    data: tenantUsers,
    errorMessage: usersErrorMessage,
    isLoading: areUsersLoading,
    reload: reloadUsers,
  } = useApiResource<TenantUser[]>(`/admin/tenants/${slug}/users`, {
    enabled: Boolean(slug),
    fallbackErrorMessage: "No se pudieron cargar los usuarios del cliente.",
  });
  const {
    data: integrations,
    errorMessage: integrationsErrorMessage,
    isLoading: areIntegrationsLoading,
    reload: reloadIntegrations,
  } = useApiResource<TenantIntegration[]>(`/admin/tenants/${slug}/integrations`, {
    enabled: Boolean(slug),
    fallbackErrorMessage: "No se pudieron cargar las integraciones.",
  });
  const {
    data: onboardingSubmissions,
    errorMessage: onboardingSubmissionsErrorMessage,
    isLoading: areOnboardingSubmissionsLoading,
    reload: reloadOnboardingSubmissions,
  } = useApiResource<OnboardingSubmissionsResponse>(`/admin/tenants/${slug}/onboarding`, {
    enabled: Boolean(slug),
    fallbackErrorMessage: "No se pudieron cargar los envíos de onboarding.",
  });
  const {
    data: plansResponse,
    errorMessage: plansErrorMessage,
    isLoading: arePlansLoading,
    reload: reloadPlans,
  } = useApiResource<PlansResponse>("/admin/settings/plans", {
    enabled: Boolean(slug && user?.role === "SUPERADMIN"),
    fallbackErrorMessage: "No se pudieron cargar los planes.",
  });
  const paymentQueryParams = new URLSearchParams({
    page: String(paymentsPage),
    pageSize: "10",
  });

  if (paymentStatusFilter) {
    paymentQueryParams.set("status", paymentStatusFilter);
  }

  if (paymentProviderFilter) {
    paymentQueryParams.set("provider", paymentProviderFilter);
  }

  if (paymentSearch.trim()) {
    paymentQueryParams.set("search", paymentSearch.trim());
  }

  const {
    data: payments,
    errorMessage: paymentsErrorMessage,
    isLoading: arePaymentsLoading,
    reload: reloadPayments,
  } = useApiResource<TenantPaymentsResponse>(
    `/admin/tenants/${slug}/payments?${paymentQueryParams.toString()}`,
    {
      enabled: Boolean(slug),
      fallbackErrorMessage: "No se pudieron cargar los pagos del cliente.",
    },
  );
  const pendingOnboardingSubmission = onboardingSubmissions?.items.find((submission) => submission.status === "pending");
  const latestOnboardingSubmission = pendingOnboardingSubmission ?? onboardingSubmissions?.items[0];
  const identitySyncKey = data ? `${data.identity.id}:${data.identity.updatedAt}` : "";
  const profileSyncKey = data ? `${data.identity.id}:${data.profile?.updatedAt ?? "sin-perfil"}` : "";
  const subscriptionSyncKey = data
    ? `${data.identity.id}:${data.currentSubscription.id ?? "sin-plan"}:${data.currentSubscription.updatedAt ?? ""}:${data.currentSubscription.status}`
    : "";

  // Los formularios se sincronizan solo cuando cambia el dato de origen (no en cada recarga),
  // para no pisar lo que se está editando en otra pestaña.
  useEffect(() => {
    if (!data || isSaving) {
      return;
    }

    setTenantName(data.identity.name);
    setTenantSlug(data.identity.slug);
    setTenantStatus(data.identity.status);
  }, [identitySyncKey, isSaving]);

  useEffect(() => {
    if (!data || isSavingProfile) {
      return;
    }

    setProfileLegalName(data.profile?.legalName ?? "");
    setProfileTradeName(data.profile?.tradeName ?? "");
    setProfileCuit(data.profile?.cuit ?? "");
    setProfileIvaCondition(data.profile?.ivaCondition ?? "");
    setProfileFiscalAddress(data.profile?.fiscalAddress ?? "");
    setProfileContactEmail(data.profile?.contactEmail ?? "");
    setProfileContactPhone(data.profile?.contactPhone ?? "");
    setProfileResponsibleName(data.profile?.responsibleName ?? "");
    setProfileResponsibleEmail(data.profile?.responsibleEmail ?? "");
  }, [profileSyncKey, isSavingProfile]);

  useEffect(() => {
    if (!data || isSavingSubscription) {
      return;
    }

    setSubscriptionPlanId(data.currentSubscription.planId ?? "");
    setSubscriptionStatus(data.currentSubscription.status === "missing" ? "ACTIVE" : data.currentSubscription.status);
    setSubscriptionBillingProvider(data.currentSubscription.billingProvider ?? "");
    setSubscriptionBillingRef(data.currentSubscription.billingRef ?? "");
  }, [subscriptionSyncKey, isSavingSubscription]);

  useEffect(() => {
    const submittedStartDate = latestOnboardingSubmission?.data?.processingStartDate;

    if (typeof submittedStartDate === "string" && submittedStartDate) {
      setApprovalPaymentsFrom(submittedStartDate.slice(0, 10));
    }
  }, [latestOnboardingSubmission]);

  // El formulario de integración se reinicia solo al cambiar de proveedor o cuando llegan
  // integraciones nuevas del servidor (carga inicial o después de guardar). Probar una
  // conexión no recarga nada, así que lo que se cargó a mano no se pierde.
  useEffect(() => {
    const savedIntegration = integrations?.find((integration) => integration.provider === integrationProvider);
    setIsIntegrationEnabled(savedIntegration?.enabled ?? true);
    setIntegrationFormValues(buildIntegrationFormValues(integrationProvider, savedIntegration?.config));
    setAfipFileNames({});
    setVisibleIntegrationSecretFields({});
    setRevealedIntegrationByProvider({});
  }, [integrations, integrationProvider]);

  const normalizedTenantSlug = tenantSlug.trim();
  const canSaveTenant = Boolean(tenantName.trim() && normalizedTenantSlug && token && !isSaving);
  const canSaveProfile = Boolean(token && !isSavingProfile);
  const profileApprovalStatus = getProfileApprovalStatus(data?.profile);
  const canReviewProfile = Boolean(token && data?.profile && isProfileComplete(data.profile) && !isReviewingProfile);
  const plans = plansResponse?.items ?? [];
  const selectedPlan = plans.find((plan) => plan.id === subscriptionPlanId);
  const canSaveSubscription = Boolean(token && subscriptionPlanId && !isSavingSubscription);
  const canCreateNote = Boolean(noteTitle.trim() && noteBody.trim() && token && !isCreatingNote);
  const canSaveUser = Boolean(userEmail.trim() && token && !isSavingUser);
  const canSaveIntegration = Boolean(token && !isSavingIntegration);
  const selectedSavedIntegration = integrations?.find((integration) => integration.provider === integrationProvider);
  const currentPlanPolicy = data?.currentSubscription.policy ?? null;
  const allowedMercadopagoPollingModes = getAllowedMercadopagoPollingModes(currentPlanPolicy);
  const selectedMercadopagoPollingMode = getMercadopagoPollingMode(currentPlanPolicy, integrationFormValues);
  const savedMercadopagoPollingMode = selectedSavedIntegration?.provider === "MERCADOPAGO"
    ? String(selectedSavedIntegration.config.POLLING_MODE ?? "").toLowerCase()
    : "";
  const isSavedMercadopagoModeNotAllowed = isMercadopagoPollingMode(savedMercadopagoPollingMode)
    && savedMercadopagoPollingMode !== selectedMercadopagoPollingMode;
  const selectedMercadopagoScheduleMode = getMercadopagoScheduleMode(integrationFormValues);
  const selectedIntegrationFields = getIntegrationFields(integrationProvider, integrationFormValues).filter((field) => {
    if (providerClientIgnoredConfigKeys[integrationProvider]?.has(field.key)) return false;
    if (integrationProvider !== "MERCADOPAGO") return true;
    if (field.key === "POLLING_MODE") return false;
    if (selectedMercadopagoPollingMode === "realtime") return field.key !== "RUNS_PER_DAY" && field.key !== "RUN_AT_TIMES";
    if (selectedMercadopagoScheduleMode === "runs") return field.key !== "POLLING_INTERVAL_MS" && field.key !== "RUN_AT_TIMES";
    return field.key !== "POLLING_INTERVAL_MS" && field.key !== "RUNS_PER_DAY";
  });
  const selectedSavedIntegrationForDisplay = selectedSavedIntegration;
  const profileCuitSuggestion = data?.profile?.cuit?.trim() ?? "";
  const afipFormCuit = integrationFormValues.CUIT?.trim() ?? "";
  const shouldSuggestProfileCuit = integrationProvider === "AFIP"
    && Boolean(profileCuitSuggestion)
    && afipFormCuit !== profileCuitSuggestion;
  const canTestIntegration = Boolean(token && !isTestingIntegration);
  const canImportMercadoPagoPayments = Boolean(token && mercadoPagoImportFrom && !isImportingMercadoPagoPayments);
  const isReviewingOnboarding = isApprovingOnboarding || isRejectingOnboarding;
  const canApproveOnboarding = Boolean(
    token
      && pendingOnboardingSubmission
      && approvalPaymentsFrom
      && !isReviewingOnboarding,
  );
  const canRejectOnboarding = Boolean(token && pendingOnboardingSubmission && !isReviewingOnboarding);
  const canDeleteTenant = Boolean(
    token
      && data
      && deleteConfirmationSlug === data.identity.slug
      && !isDeletingTenant,
  );
  const activeAdminUser = tenantUsers?.find(
    (tenantUser) =>
      tenantUser.status === "ACTIVE"
      && (tenantUser.role === "owner" || tenantUser.role === "admin"),
  );
  const readinessItems = data ? buildReadinessItems(data, activeAdminUser, Boolean(tenantUsers)) : [];
  const operationalStatus = data ? getTenantOperationalStatus(data, readinessItems) : null;
  const submittedFiles = latestOnboardingSubmission?.documents ?? [];
  const submittedIntegrationProviders = Object.keys(
    (latestOnboardingSubmission?.data?.integrations as Record<string, unknown> | undefined) ?? {},
  );
  // KPIs del resumen: totales históricos del cliente que calcula el backend (no la página de Facturación).
  const metricStatuses = data?.metrics.statuses;
  const completedMetrics = sumStatusMetrics(metricStatuses, (status) => status === "complete");
  const failedMetrics = sumStatusMetrics(metricStatuses, (status) => status === "failed");
  const pendingMetrics = sumStatusMetrics(metricStatuses, (status) => status !== "complete" && status !== "failed");
  const recentPayments = data?.metrics.recentPayments ?? [];
  const visibleTabs = tenantDetailTabs.filter((tab) => !tab.superadminOnly || isSuperadmin);

  function openEditPanel({ activate = false }: { activate?: boolean } = {}) {
    if (data) {
      setTenantName(data.identity.name);
      setTenantSlug(data.identity.slug);
      setTenantStatus(activate ? "ACTIVE" : data.identity.status);
    }
    setSaveErrorMessage(null);
    setSaveSuccessMessage(activate ? "Revisá los datos y guardá para activar el cliente." : null);
    setIsEditPanelOpen(true);
  }

  function handleReadinessItemClick(item: ReadinessItem) {
    if (item.id === "tenant-active") {
      if (can("tenants:manage")) openEditPanel({ activate: true });
      return;
    }

    if (item.id === "mercadopago") selectIntegrationProvider("MERCADOPAGO");
    if (item.id === "afip") selectIntegrationProvider("AFIP");
    if (item.id === "drive") selectIntegrationProvider("DRIVE");
    if (item.id === "sheets") selectIntegrationProvider("SHEETS");
    setActiveTab(item.tab);
  }

  async function handleUpdateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setSaveErrorMessage("No hay una sesión o un cliente válido para guardar cambios.");
      return;
    }

    if (!canSaveTenant) {
      setSaveErrorMessage("Completá el nombre y el identificador para actualizar el cliente.");
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      const updatedTenant = await apiRequest<UpdateTenantResponse>(`/admin/tenants/${slug}`, {
        method: "PATCH",
        token,
        body: {
          name: tenantName.trim(),
          slug: normalizedTenantSlug,
          status: tenantStatus,
        },
      });

      setSaveSuccessMessage(`Cliente ${updatedTenant.name} actualizado.`);

      if (updatedTenant.slug !== slug) {
        navigate(`/admin/tenants/${updatedTenant.slug}`, { replace: true });
        return;
      }

      await reload();
    } catch (error) {
      setSaveErrorMessage(getApiErrorMessage(error, "No se pudo actualizar el cliente."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setProfileErrorMessage("No hay una sesión o un cliente válido para guardar datos.");
      return;
    }

    setIsSavingProfile(true);
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);

    try {
      await apiRequest<TenantProfile>(`/admin/tenants/${slug}/profile`, {
        method: "PUT",
        token,
        body: {
          legalName: profileLegalName,
          tradeName: profileTradeName,
          cuit: profileCuit,
          ivaCondition: profileIvaCondition,
          fiscalAddress: profileFiscalAddress,
          contactEmail: profileContactEmail,
          contactPhone: profileContactPhone,
          responsibleName: profileResponsibleName,
          responsibleEmail: profileResponsibleEmail,
        },
      });

      setProfileSuccessMessage("Datos del cliente actualizados correctamente.");
      await reload();
    } catch (error) {
      setProfileErrorMessage(getApiErrorMessage(error, "No se pudieron guardar los datos del cliente."));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleReviewProfile(status: "APPROVED" | "REJECTED") {
    if (!slug || !token) {
      setProfileReviewErrorMessage("No hay una sesión o un cliente válido para revisar datos.");
      return;
    }

    setIsReviewingProfile(true);
    setProfileReviewErrorMessage(null);
    setProfileReviewSuccessMessage(null);

    try {
      await apiRequest<TenantProfile>(`/admin/tenants/${slug}/profile/review`, {
        method: "POST",
        token,
        body: {
          status,
          reviewNotes: profileReviewNotes,
        },
      });

      setProfileReviewNotes("");
      setProfileReviewSuccessMessage(status === "APPROVED" ? "Perfil aprobado correctamente." : "Perfil rechazado correctamente.");
      await reload();
    } catch (error) {
      setProfileReviewErrorMessage(getApiErrorMessage(error, "No se pudo revisar el perfil."));
    } finally {
      setIsReviewingProfile(false);
    }
  }

  async function handleSaveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setSubscriptionErrorMessage("No hay una sesión o un cliente válido para guardar la suscripcion.");
      return;
    }

    if (!canSaveSubscription) {
      setSubscriptionErrorMessage("Selecciona un plan para guardar la suscripcion.");
      return;
    }

    setIsSavingSubscription(true);
    setSubscriptionErrorMessage(null);
    setSubscriptionSuccessMessage(null);

    try {
      await apiRequest(`/admin/tenants/${slug}/subscription`, {
        method: "PUT",
        token,
        body: {
          planId: subscriptionPlanId,
          status: subscriptionStatus,
          billingProvider: subscriptionBillingProvider,
          billingRef: subscriptionBillingRef,
        },
      });

      setSubscriptionSuccessMessage("Suscripcion actualizada correctamente.");
      await Promise.all([reload(), reloadPlans()]);
    } catch (error) {
      setSubscriptionErrorMessage(getApiErrorMessage(error, "No se pudo guardar la suscripcion."));
    } finally {
      setIsSavingSubscription(false);
    }
  }

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setNoteErrorMessage("No hay una sesión o un cliente válido para crear la nota.");
      return;
    }

    if (!canCreateNote) {
      setNoteErrorMessage("Completa titulo y detalle para crear la nota.");
      return;
    }

    setIsCreatingNote(true);
    setNoteErrorMessage(null);
    setNoteSuccessMessage(null);

    try {
      await apiRequest<TenantNote>(`/admin/tenants/${slug}/notes`, {
        method: "POST",
        token,
        body: {
          title: noteTitle.trim(),
          body: noteBody.trim(),
          pinned: isNotePinned,
        },
      });

      setNoteTitle("");
      setNoteBody("");
      setIsNotePinned(false);
      setNoteSuccessMessage("Nota interna creada correctamente.");
      await Promise.all([reloadNotes(), reload()]);
    } catch (error) {
      setNoteErrorMessage(getApiErrorMessage(error, "No se pudo crear la nota interna."));
    } finally {
      setIsCreatingNote(false);
    }
  }

  function startUserEdit(user: TenantUser) {
    setEditingUserId(user.id);
    setUserEmail(user.email);
    setUserRole(user.role);
    setUserStatus(user.status);
    setUserPassword("");
    setUserErrorMessage(null);
    setUserSuccessMessage(null);
  }

  async function handleSaveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setUserErrorMessage("No hay una sesión o un cliente válido para guardar el usuario.");
      return;
    }

    if (!canSaveUser) {
      setUserErrorMessage("Completá el email para guardar el usuario.");
      return;
    }

    if (userPassword && userPassword.length < 8) {
      setUserErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsSavingUser(true);
    setUserErrorMessage(null);
    setUserSuccessMessage(null);

    try {
      await apiRequest<TenantUser>(`/admin/tenants/${slug}/users`, {
        method: "PUT",
        token,
        body: {
          email: userEmail.trim().toLowerCase(),
          role: userRole,
          status: userStatus,
          ...(userPassword ? { password: userPassword } : {}),
        },
      });

      setEditingUserId(null);
      setUserEmail("");
      setUserRole("viewer");
      setUserStatus("ACTIVE");
      setUserPassword("");
      setUserSuccessMessage("Usuario guardado.");
      await Promise.all([reloadUsers(), reload()]);
    } catch (error) {
      setUserErrorMessage(getApiErrorMessage(error, "No se pudo guardar el usuario."));
    } finally {
      setIsSavingUser(false);
    }
  }

  function selectIntegrationProvider(provider: IntegrationProvider) {
    // El efecto de reinicio carga la configuración guardada del nuevo proveedor.
    setIntegrationProvider(provider);
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);
    setIntegrationTestResult(null);
  }

  function handleProfileCuitChange(value: string) {
    setProfileCuit(value);
    setProfileErrorMessage(null);
    setProfileSuccessMessage(null);
  }

  function updateIntegrationField(field: string, value: string) {
    setIntegrationFormValues((currentValues) => ({ ...currentValues, [field]: value }));
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);
    setIntegrationTestResult(null);
  }

  function updateMercadopagoPollingMode(mode: MercadopagoPollingMode) {
    setIntegrationFormValues((currentValues) => ({
      ...currentValues,
      POLLING_MODE: mode,
      ...(mode === "scheduled" && !currentValues.RUNS_PER_DAY?.trim() && !currentValues.RUN_AT_TIMES?.trim()
        ? { RUNS_PER_DAY: "1" }
        : {}),
    }));
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);
    setIntegrationTestResult(null);
  }

  async function revealIntegrationConfig(provider: IntegrationProvider) {
    if (!slug || !token) {
      throw new Error("No hay una sesión o un cliente válido para mostrar secretos.");
    }

    const revealedIntegrations = await apiRequest<TenantIntegration[]>(`/admin/tenants/${slug}/integrations?revealSecrets=true`, {
      token,
    });
    const revealedIntegration = revealedIntegrations.find((integration) => integration.provider === provider);

    if (!revealedIntegration) {
      throw new Error(`No hay configuración guardada para ${getIntegrationProviderLabel(provider)}.`);
    }

    setRevealedIntegrationByProvider((currentValues) => ({
      ...currentValues,
      [provider]: revealedIntegration,
    }));

    return revealedIntegration;
  }

  async function toggleIntegrationFormSecretVisibility(fieldKey: string) {
    const visibilityKey = `${integrationProvider}:${fieldKey}:form`;

    if (visibleIntegrationSecretFields[visibilityKey]) {
      setVisibleIntegrationSecretFields((currentValues) => ({ ...currentValues, [visibilityKey]: false }));
      return;
    }

    const currentValue = integrationFormValues[fieldKey];

    if (hasMaskedValue(currentValue)) {
      if (!canRevealSecrets) {
        setIntegrationErrorMessage("Tu rol no puede ver secretos guardados. Podés reemplazarlos por un valor nuevo.");
        return;
      }

      setIsRevealingIntegrationSecrets(true);
      setIntegrationErrorMessage(null);

      try {
        const revealedIntegration = revealedIntegrationByProvider[integrationProvider]
          ?? await revealIntegrationConfig(integrationProvider);
        const revealedValue = revealedIntegration.config[fieldKey];

        setIntegrationFormValues((currentValues) => ({
          ...currentValues,
          [fieldKey]: stringifyIntegrationFieldValue(revealedValue),
        }));
      } catch (error) {
        setIntegrationErrorMessage(error instanceof Error ? error.message : "No se pudo mostrar el valor guardado.");
        return;
      } finally {
        setIsRevealingIntegrationSecrets(false);
      }
    }

    setVisibleIntegrationSecretFields((currentValues) => ({ ...currentValues, [visibilityKey]: true }));
  }

  async function toggleSavedIntegrationSecretVisibility(fieldKey: string) {
    const visibilityKey = `${integrationProvider}:${fieldKey}:saved`;

    if (visibleIntegrationSecretFields[visibilityKey]) {
      setVisibleIntegrationSecretFields((currentValues) => ({ ...currentValues, [visibilityKey]: false }));
      return;
    }

    if (!slug || !token || !canRevealSecrets) {
      setIntegrationErrorMessage("No podés ver secretos guardados con tu sesión actual.");
      return;
    }

    try {
      setIsRevealingIntegrationSecrets(true);
      setIntegrationErrorMessage(null);
      await revealIntegrationConfig(integrationProvider);
      setVisibleIntegrationSecretFields((currentValues) => ({ ...currentValues, [visibilityKey]: true }));
    } catch (error) {
      setIntegrationErrorMessage(error instanceof Error ? error.message : getApiErrorMessage(error, "No se pudieron mostrar los secretos guardados."));
    } finally {
      setIsRevealingIntegrationSecrets(false);
    }
  }

  // Certificado y clave de ARCA: solo se envían si se subió un archivo nuevo. Si se omiten,
  // el backend conserva los guardados, así que no hace falta revelar secretos para guardar o probar.
  function withUploadedAfipFiles(config: Record<string, unknown>) {
    if (integrationProvider !== "AFIP") {
      return config;
    }

    const nextConfig = { ...config };

    for (const key of ["CERT_B64", "KEY_B64"] as const) {
      const currentValue = integrationFormValues[key];

      if (currentValue?.trim() && !hasMaskedValue(currentValue)) {
        nextConfig[key] = currentValue.trim();
      } else {
        delete nextConfig[key];
      }
    }

    return nextConfig;
  }

  /** Arma la configuración a enviar y devuelve un mensaje si falta algo. */
  function buildSubmittedIntegrationConfig(action: "guardar" | "probar") {
    let config = buildIntegrationConfig(integrationProvider, integrationFormValues, selectedIntegrationFields);

    if (integrationProvider === "MERCADOPAGO") {
      config.POLLING_MODE = selectedMercadopagoPollingMode;

      if (selectedMercadopagoPollingMode === "scheduled" && selectedMercadopagoScheduleMode === "runs" && !config.RUNS_PER_DAY) {
        return { config, error: "Indicá cuántas lecturas por día querés hacer." };
      }
    }

    config = withUploadedAfipFiles(config);

    if (hasBlankConfigValue(config)) {
      return { config, error: `Completá los campos vacíos antes de ${action}.` };
    }

    return { config, error: null };
  }

  function updateMercadopagoScheduleMode(mode: MercadopagoScheduleMode) {
    setIntegrationFormValues((currentValues) => ({
      ...currentValues,
      RUNS_PER_DAY: mode === "runs" ? currentValues.RUNS_PER_DAY || "1" : "",
      RUN_AT_TIMES: mode === "times" ? currentValues.RUN_AT_TIMES || "09:00" : "",
    }));
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);
    setIntegrationTestResult(null);
  }

  function updateMercadopagoRunTime(index: number, value: string) {
    const runTimes = parseRunTimes(integrationFormValues.RUN_AT_TIMES ?? "");
    runTimes[index] = value;
    updateIntegrationField("RUN_AT_TIMES", formatRunTimes(runTimes));
  }

  function addMercadopagoRunTime() {
    const runTimes = parseRunTimes(integrationFormValues.RUN_AT_TIMES ?? "");
    updateIntegrationField("RUN_AT_TIMES", formatRunTimes([...runTimes, "09:00"]));
  }

  function removeMercadopagoRunTime(index: number) {
    const runTimes = parseRunTimes(integrationFormValues.RUN_AT_TIMES ?? "");
    updateIntegrationField("RUN_AT_TIMES", formatRunTimes(runTimes.filter((_, currentIndex) => currentIndex !== index)));
  }

  async function fileToBase64(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
  }

  async function handleAfipFileUpload(field: "CERT_B64" | "KEY_B64", file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const fileContent = await fileToBase64(file);
      updateIntegrationField(field, fileContent);
      setAfipFileNames((currentValues) => ({ ...currentValues, [field]: file.name }));
      setIntegrationSuccessMessage(`${field === "CERT_B64" ? "Certificado" : "Clave privada"} cargado para guardar.`);
    } catch {
      setIntegrationErrorMessage("No pudimos leer el archivo seleccionado.");
    }
  }

  async function handleSaveIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setIntegrationErrorMessage("No hay una sesión o un cliente válido para guardar la integración.");
      return;
    }

    const { config, error: configError } = buildSubmittedIntegrationConfig("guardar");

    if (configError) {
      setIntegrationErrorMessage(configError);
      return;
    }

    setIsSavingIntegration(true);
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);

    try {
      await apiRequest<TenantIntegration>(`/admin/tenants/${slug}/integrations/${integrationProvider}`, {
        method: "PUT",
        token,
        body: {
          enabled: isIntegrationEnabled,
          config,
        },
      });

      setIntegrationSuccessMessage(`${getIntegrationProviderLabel(integrationProvider)} guardada.`);
      await Promise.all([reloadIntegrations(), reload()]);
    } catch (error) {
      setIntegrationErrorMessage(getApiErrorMessage(error, "No se pudo guardar la integración."));
    } finally {
      setIsSavingIntegration(false);
    }
  }

  async function handleAuthorizeGoogle() {
    if (!slug || !token) {
      setIntegrationErrorMessage("No hay una sesión o un cliente válido para conectar Google.");
      return;
    }

    const popup = window.open("about:blank", "facturador-google-oauth", "popup,width=620,height=760");
    if (!popup) {
      setIntegrationErrorMessage("El navegador bloqueó la ventana de Google. Habilitá las ventanas emergentes y probá de nuevo.");
      return;
    }

    setIsAuthorizingGoogle(true);
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);

    try {
      const response = await apiRequest<GoogleOAuthUrlResponse>(
        `/admin/tenants/${slug}/integrations/google/oauth-url`,
        { method: "POST", token },
      );
      popup.location.href = response.authUrl;

      await new Promise<void>((resolve, reject) => {
        const startedAt = Date.now();
        let completed = false;
        const cleanup = () => {
          completed = true;
          window.clearInterval(intervalId);
          window.removeEventListener("message", handleMessage);
        };
        const handleMessage = (event: MessageEvent) => {
          const message = event.data as { type?: string; ok?: boolean; tenantSlug?: string; flowId?: string } | null;
          if (message?.type !== "facturador:google-oauth"
            || message.tenantSlug !== slug
            || message.flowId !== response.flowId
            || !message.ok) return;
          cleanup();
          resolve();
        };
        const intervalId = window.setInterval(() => {
          if (completed) return;
          if (popup.closed) {
            cleanup();
            reject(new Error("La ventana se cerró antes de confirmar la autorización de Google."));
            return;
          }
          if (Date.now() - startedAt > 10 * 60 * 1000) {
            cleanup();
            popup.close();
            reject(new Error("La autorización de Google superó el tiempo disponible."));
          }
        }, 500);
        window.addEventListener("message", handleMessage);
      });

      setIntegrationSuccessMessage("Autorización de Google lista. Se actualizaron Drive y Sheets del cliente.");
      await Promise.all([reloadIntegrations(), reload()]);
    } catch (error) {
      popup.close();
      setIntegrationErrorMessage(getApiErrorMessage(error, error instanceof Error ? error.message : "No se pudo conectar Google."));
    } finally {
      setIsAuthorizingGoogle(false);
    }
  }

  async function handleTestIntegration() {
    if (!slug || !token) {
      setIntegrationErrorMessage("No hay una sesión o un cliente válido para probar la integración.");
      return;
    }

    const { config, error: configError } = buildSubmittedIntegrationConfig("probar");

    if (configError) {
      setIntegrationErrorMessage(configError);
      return;
    }

    setIsTestingIntegration(true);
    setIntegrationErrorMessage(null);
    setIntegrationSuccessMessage(null);
    setIntegrationTestResult(null);

    try {
      const response = await apiRequest<IntegrationTestResponse>(
        `/admin/tenants/${slug}/integrations/${integrationProvider}/test`,
        {
          method: "POST",
          token,
          body: {
            enabled: isIntegrationEnabled,
            config,
          },
        },
      );

      setIntegrationTestResult(response);
    } catch (error) {
      setIntegrationErrorMessage(getApiErrorMessage(error, "No se pudo probar la integración."));
    } finally {
      setIsTestingIntegration(false);
    }
  }

  async function handleImportMercadoPagoPayments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token) {
      setMercadoPagoImportErrorMessage("No hay una sesión o un cliente válido para traer pagos.");
      return;
    }

    if (!mercadoPagoImportFrom) {
      setMercadoPagoImportErrorMessage("Elegi desde que fecha traer pagos de Mercado Pago.");
      return;
    }

    setIsImportingMercadoPagoPayments(true);
    setMercadoPagoImportMessage(null);
    setMercadoPagoImportErrorMessage(null);

    try {
      const response = await apiRequest<TenantOperationalActionResponse>(
        `/admin/tenants/${slug}/integrations/mercadopago/start`,
        {
          method: "POST",
          token,
          body: {
            processingStartDate: mercadoPagoImportFrom,
          },
        },
      );

      setMercadoPagoImportMessage(response.message ?? "Importacion de pagos de Mercado Pago solicitada.");
      await Promise.all([reloadPayments(), reload()]);
    } catch (error) {
      setMercadoPagoImportErrorMessage(
        getApiErrorMessage(error, "No se pudo solicitar la importacion de pagos de Mercado Pago."),
      );
    } finally {
      setIsImportingMercadoPagoPayments(false);
    }
  }

  async function handleApproveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token || !pendingOnboardingSubmission) {
      setApprovalErrorMessage("No hay un envío pendiente para aprobar.");
      return;
    }

    if (!approvalPaymentsFrom) {
      setApprovalErrorMessage("Elegí desde qué fecha empezar a procesar pagos.");
      return;
    }

    setIsApprovingOnboarding(true);
    setApprovalMessage(null);
    setApprovalErrorMessage(null);

    try {
      const response = await apiRequest<TenantOperationalActionResponse>(
        `/admin/tenants/${slug}/onboarding/${pendingOnboardingSubmission.id}/approve`,
        {
          method: "POST",
          token,
          body: {
            processingStartDate: approvalPaymentsFrom,
            reviewNotes: onboardingReviewNotes.trim() || undefined,
            enableProcessing: true,
          },
        },
      );

      setOnboardingReviewNotes("");
      setApprovalMessage(response.message ?? "Alta aprobada. Quedó pedido el procesamiento de pagos.");
      await Promise.all([reload(), reloadIntegrations(), reloadPayments(), reloadOnboardingSubmissions()]);
    } catch (error) {
      setApprovalErrorMessage(getApiErrorMessage(error, "No se pudo aprobar el alta del cliente."));
    } finally {
      setIsApprovingOnboarding(false);
    }
  }

  async function handleRejectOnboarding() {
    if (!slug || !token || !pendingOnboardingSubmission) {
      setApprovalErrorMessage("No hay un envío pendiente para rechazar.");
      return;
    }

    if (!onboardingReviewNotes.trim()) {
      setApprovalErrorMessage("Contale al cliente por qué rechazás el envío en la nota de revisión.");
      return;
    }

    setIsRejectingOnboarding(true);
    setApprovalMessage(null);
    setApprovalErrorMessage(null);

    try {
      await apiRequest(`/admin/tenants/${slug}/onboarding/${pendingOnboardingSubmission.id}/reject`, {
        method: "POST",
        token,
        body: { reviewNotes: onboardingReviewNotes.trim() },
      });

      setOnboardingReviewNotes("");
      setApprovalMessage("Envío rechazado. El cliente puede corregirlo y volver a enviarlo.");
      await reloadOnboardingSubmissions();
    } catch (error) {
      setApprovalErrorMessage(getApiErrorMessage(error, "No se pudo rechazar el envío."));
    } finally {
      setIsRejectingOnboarding(false);
    }
  }

  async function handleExportPayments() {
    if (!slug || !token) {
      setPaymentsExportErrorMessage("No hay una sesión o un cliente válido para exportar pagos.");
      return;
    }

    const exportQueryParams = new URLSearchParams();

    if (paymentStatusFilter) {
      exportQueryParams.set("status", paymentStatusFilter);
    }

    if (paymentProviderFilter) {
      exportQueryParams.set("provider", paymentProviderFilter);
    }

    if (paymentSearch.trim()) {
      exportQueryParams.set("search", paymentSearch.trim());
    }

    setIsExportingPayments(true);
    setPaymentsExportErrorMessage(null);

    try {
      const query = exportQueryParams.toString();
      const blob = await apiBlobRequest(
        `/admin/tenants/${slug}/payments/export.csv${query ? `?${query}` : ""}`,
        { token },
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `payments-${slug}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPaymentsExportErrorMessage(getApiErrorMessage(error, "No se pudo exportar el CSV de pagos."));
    } finally {
      setIsExportingPayments(false);
    }
  }

  async function handleDeleteTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!slug || !token || !data) {
      setDeleteErrorMessage("No hay una sesión o un cliente válido para eliminar.");
      return;
    }

    if (deleteConfirmationSlug !== data.identity.slug) {
      setDeleteErrorMessage("Escribí el identificador exacto para confirmar la eliminación.");
      return;
    }

    setIsDeletingTenant(true);
    setDeleteErrorMessage(null);

    try {
      await apiRequest<DeleteTenantResponse>(
        `/admin/tenants/${slug}?deleteLocalFiles=${shouldDeleteLocalFiles ? "true" : "false"}`,
        {
          method: "DELETE",
          token,
        },
      );

      navigate("/admin/tenants", { replace: true });
    } catch (error) {
      setDeleteErrorMessage(getApiErrorMessage(error, "No se pudo eliminar el cliente."));
    } finally {
      setIsDeletingTenant(false);
    }
  }

  return (
    <main className="client-detail-page">
      <section className="detail-header">
        <div>
          <Link to="/admin/tenants" className="detail-breadcrumb">
            <span aria-hidden="true">{"<"}</span> Clientes <span aria-hidden="true">/</span> {data?.identity.name ?? "Cliente"}
          </Link>
          <div className="detail-title-row">
            <h2>{data?.identity.name ?? "Detalle del cliente"}</h2>
            {operationalStatus ? (
              <span className={`status-chip status-chip--${operationalStatus.tone}`}>
                {operationalStatus.label}
              </span>
            ) : null}
          </div>
          <p className="detail-header__copy">
            {data
              ? `CUIT ${data.profile?.cuit ?? "sin cargar"} · ${data.currentSubscription.planName ?? "Sin plan"} · ${data.identity.status === "ACTIVE" ? "Activo" : "Deshabilitado"}`
              : "Estamos preparando la vista operativa del cliente."}
          </p>
        </div>
        {data ? (
          <PermissionGate permission="tenants:manage">
            <div className="detail-header__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => openEditPanel()}
                disabled={isEditPanelOpen}
              >
                Editar cliente
              </button>
            </div>
          </PermissionGate>
        ) : null}
      </section>

      {!data && isLoading ? (
        <section className="panel">
          <div className="panel-state">
            <strong>Cargando detalle...</strong>
            <span>Consultando la información del cliente.</span>
          </div>
        </section>
      ) : !data && errorMessage ? (
        <section className="panel">
          <div className="panel-state panel-state--danger">
            <strong>No pudimos cargar el detalle</strong>
            <span>{errorMessage}</span>
          </div>
        </section>
      ) : data ? (
        <>
          {errorMessage ? (
            <p className="form-error" role="alert">{`No pudimos actualizar el detalle: ${errorMessage}`}</p>
          ) : null}

          {isEditPanelOpen ? (
            <section className="panel tenant-form-panel" aria-label="Editar cliente">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Datos básicos</span>
                  <h2>Editar cliente</h2>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isSaving}
                  onClick={() => {
                    setIsEditPanelOpen(false);
                    setTenantName(data.identity.name);
                    setTenantSlug(data.identity.slug);
                    setTenantStatus(data.identity.status);
                    setSaveErrorMessage(null);
                    setSaveSuccessMessage(null);
                  }}
                >
                  Cerrar
                </button>
              </div>

              <form className="tenant-form" onSubmit={(event) => void handleUpdateTenant(event)}>
                <label className="field">
                  <span>Nombre visible</span>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(event) => {
                      setTenantName(event.target.value);
                      setSaveErrorMessage(null);
                      setSaveSuccessMessage(null);
                    }}
                    disabled={isSaving}
                    required
                  />
                </label>

                <label className="field">
                  <span>Identificador para ingresar</span>
                  <input
                    type="text"
                    value={tenantSlug}
                    onChange={(event) => {
                      setTenantSlug(createSlug(event.target.value));
                      setSaveErrorMessage(null);
                      setSaveSuccessMessage(null);
                    }}
                    disabled={isSaving}
                    required
                  />
                  <small>Es lo que el cliente escribe para entrar al portal. Si lo cambiás, avisale.</small>
                </label>

                <label className="field">
                  <span>Estado</span>
                  <select
                    value={tenantStatus}
                    onChange={(event) => {
                      setTenantStatus(event.target.value as TenantStatus);
                      setSaveErrorMessage(null);
                      setSaveSuccessMessage(null);
                    }}
                    disabled={isSaving}
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="DISABLED">Deshabilitado</option>
                  </select>
                </label>

                <div className="tenant-form__actions">
                  <button type="submit" className="primary-button" disabled={!canSaveTenant}>
                    {isSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <span>
                    Si cambiás el identificador, te llevamos automáticamente a la nueva dirección.
                  </span>
                </div>

                {saveErrorMessage ? <p className="form-error">{saveErrorMessage}</p> : null}
                {saveSuccessMessage ? <p className="form-success">{saveSuccessMessage}</p> : null}
              </form>
            </section>
          ) : null}

          <nav className="detail-section-tabs" aria-label="Secciones del cliente" role="tablist">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "detail-section-tabs__active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.id === "onboarding" && pendingOnboardingSubmission ? (
                  <span className="tenant-detail-tab-dot" aria-label="Envío pendiente de revisión" />
                ) : null}
              </button>
            ))}
          </nav>

          {activeTab === "summary" ? <section id="tenant-summary" className="client-overview-grid">
            <aside className="client-operational-card">
              <h3>Estado operativo</h3>
              <p>{operationalStatus?.detail}</p>
              {operationalStatus && operationalStatus.label !== "Listo para facturar" ? (
                <p className="tenant-readiness-action">
                  <span>Acción recomendada:</span> <strong>{operationalStatus.action}</strong>
                </p>
              ) : null}
              <div className="client-checklist">
                {readinessItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="client-checklist__item"
                    onClick={() => handleReadinessItemClick(item)}
                    disabled={item.id === "tenant-active" && (item.isComplete || !can("tenants:manage"))}
                  >
                    <span className={`client-checklist__mark${item.isComplete ? " client-checklist__mark--complete" : ""}`}>
                      {item.isComplete ? "✓" : "!"}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                      {!item.isComplete && item.severity === "degraded" ? (
                        <small className="tenant-readiness-note">No bloquea la facturación</small>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
              {data.currentSubscription.policy && data.currentSubscription.policy.entitlements.googleDriveSheets !== true ? (
                <p className="tenant-readiness-note">Google Drive y Sheets no están incluidos en el plan actual.</p>
              ) : null}
            </aside>

            <section className="client-activity-panel">
              <div className="client-activity-heading">
                <h3>Resumen de actividad <span>(histórico)</span></h3>
              </div>
              <div className="client-activity-kpis">
                <article>
                  <span>Pagos recibidos</span>
                  <strong>{data.metrics.totalPayments}</strong>
                  <small>{formatCurrency(data.metrics.totalAmount)}</small>
                </article>
                <article>
                  <span>Facturas emitidas</span>
                  <strong>{completedMetrics.count}</strong>
                  <small>{formatCurrency(completedMetrics.amount)}</small>
                </article>
                <article>
                  <span>Con error</span>
                  <strong>{failedMetrics.count}</strong>
                  <small>{formatCurrency(failedMetrics.amount)}</small>
                </article>
                <article>
                  <span>Pendientes</span>
                  <strong>{pendingMetrics.count}</strong>
                  <small>{formatCurrency(pendingMetrics.amount)}</small>
                </article>
              </div>

              <div className="client-payments-table">
                <h3>Últimos pagos</h3>
                <div className="client-payments-table__head">
                  <span>Fecha</span>
                  <span>Importe</span>
                  <span>Etapa actual</span>
                  <span>Estado</span>
                  <span>Acción</span>
                </div>
                {recentPayments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="client-payments-table__row">
                    <span>{formatDateTime(payment.createdAt)}</span>
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <span>{getPaymentStageLabel(payment.status)}</span>
                    <span>
                      <small className={`status-chip status-chip--${getPaymentStageTone(payment.status)}`}>
                        {payment.status === "complete" ? "Completado" : payment.status === "failed" ? "Error" : "Pendiente"}
                      </small>
                    </span>
                    <Link to={`/admin/payments/${payment.id}`} className="section-mini-button">Ver</Link>
                  </div>
                ))}
                {recentPayments.length === 0 ? (
                  <div className="client-payments-table__empty">Todavía no hay pagos.</div>
                ) : null}
              </div>
            </section>
          </section> : null}

          {activeTab === "onboarding" ? <section id="tenant-onboarding" className="panel onboarding-review-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Revisión del alta</span>
                <h2>Onboarding del cliente</h2>
              </div>
              {latestOnboardingSubmission ? (
                <span className={`badge badge--${getOnboardingSubmissionTone(latestOnboardingSubmission.status)}`}>
                  {getOnboardingSubmissionLabel(latestOnboardingSubmission.status)}
                </span>
              ) : (
                <span className="badge badge--muted">Sin envíos</span>
              )}
            </div>

            <div className="onboarding-review-grid">
              <div className="onboarding-review-card">
                <strong>Lo que envió el cliente</strong>
                {areOnboardingSubmissionsLoading ? (
                  <p>Cargando envíos de onboarding...</p>
                ) : onboardingSubmissionsErrorMessage ? (
                  <p>{onboardingSubmissionsErrorMessage}</p>
                ) : latestOnboardingSubmission ? (
                  <>
                    <span>
                      {`Enviado ${formatDateTime(latestOnboardingSubmission.createdAt)} · actualizado ${formatDateTime(latestOnboardingSubmission.updatedAt)}`}
                    </span>
                    {submittedIntegrationProviders.length > 0 ? (
                      <p>{`Integraciones incluidas: ${submittedIntegrationProviders.map(getIntegrationProviderLabel).join(", ")}.`}</p>
                    ) : (
                      <p>El envío no incluye integraciones.</p>
                    )}
                    {typeof latestOnboardingSubmission.data?.processingStartDate === "string" ? (
                      <p>{`Fecha de inicio pedida: ${latestOnboardingSubmission.data.processingStartDate.slice(0, 10)}`}</p>
                    ) : null}
                    {latestOnboardingSubmission.reviewNotes ? (
                      <p>{`Nota de revisión: ${latestOnboardingSubmission.reviewNotes}`}</p>
                    ) : null}
                    {submittedFiles.length > 0 ? (
                      <div className="onboarding-files-list">
                        {submittedFiles.map((file) => (
                          <a key={`${file.type}-${file.name}`} href={file.url} target="_blank" rel="noreferrer">
                            <span>{file.name}</span>
                            <small>{prettifyStatus(file.type)}</small>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p>
                    El cliente todavía no envió su onboarding desde el portal. Cuando lo haga, vas a poder revisarlo acá antes de aprobarlo.
                  </p>
                )}
                {(onboardingSubmissions?.items.length ?? 0) > 1 ? (
                  <ul className="tenant-onboarding-history">
                    {onboardingSubmissions?.items.map((submission) => (
                      <li key={submission.id}>
                        {`${formatDateTime(submission.createdAt)} · ${getOnboardingSubmissionLabel(submission.status)}`}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <PermissionGate
                permission="tenants:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol puede revisar el alta, pero no aprobarla ni rechazarla.</span>
                  </div>
                }
              >
                <form className="onboarding-action-form" onSubmit={(event) => void handleApproveOnboarding(event)}>
                  {pendingOnboardingSubmission ? (
                    <span>Hay un envío pendiente de revisión.</span>
                  ) : (
                    <span>No hay envíos pendientes para aprobar.</span>
                  )}
                  <label className="field">
                    <span>Procesar pagos desde</span>
                    <input
                      type="date"
                      value={approvalPaymentsFrom}
                      onChange={(event) => {
                        setApprovalPaymentsFrom(event.target.value);
                        setApprovalErrorMessage(null);
                        setApprovalMessage(null);
                      }}
                      disabled={isReviewingOnboarding || !pendingOnboardingSubmission}
                    />
                  </label>
                  <label className="field">
                    <span>Nota de revisión</span>
                    <textarea
                      value={onboardingReviewNotes}
                      onChange={(event) => {
                        setOnboardingReviewNotes(event.target.value);
                        setApprovalErrorMessage(null);
                        setApprovalMessage(null);
                      }}
                      placeholder="Obligatoria si rechazás: contale al cliente qué tiene que corregir."
                      disabled={isReviewingOnboarding || !pendingOnboardingSubmission}
                    />
                  </label>
                  <div className="tenant-form__actions">
                    <button type="submit" className="primary-button" disabled={!canApproveOnboarding}>
                      {isApprovingOnboarding ? "Aprobando..." : "Aprobar alta y procesar"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button secondary-button--danger"
                      disabled={!canRejectOnboarding}
                      onClick={() => void handleRejectOnboarding()}
                    >
                      {isRejectingOnboarding ? "Rechazando..." : "Rechazar envío"}
                    </button>
                  </div>
                  <span>
                    Al aprobar, las integraciones que envió el cliente reemplazan a las guardadas y se empiezan a leer los pagos de Mercado Pago desde la fecha elegida. El estado del cliente no cambia.
                  </span>
                  {approvalErrorMessage ? <p className="form-error">{approvalErrorMessage}</p> : null}
                  {approvalMessage ? <p className="form-success">{approvalMessage}</p> : null}
                </form>
              </PermissionGate>
            </div>
          </section> : null}

          {activeTab === "profile" ? <section id="tenant-profile" className="panel tenant-profile-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Datos del cliente</span>
                <h2>Perfil fiscal y contacto</h2>
              </div>
              <div className="tenant-profile-badges">
                <span className={`badge badge--${isProfileComplete(data.profile) ? "success" : "warning"}`}>
                  {isProfileComplete(data.profile) ? "Completo" : "Incompleto"}
                </span>
                <span className={`badge badge--${getProfileApprovalBadgeTone(profileApprovalStatus)}`}>
                  {getProfileApprovalLabel(profileApprovalStatus)}
                </span>
              </div>
            </div>

            <PermissionGate
              permission="tenants:manage"
              fallback={
                <div className="tenant-profile-readonly">
                  <div>
                    <span>Razon social</span>
                    <strong>{data.profile?.legalName ?? "Sin cargar"}</strong>
                  </div>
                  <div>
                    <span>CUIT</span>
                    <strong>{data.profile?.cuit ?? "Sin cargar"}</strong>
                  </div>
                  <div>
                    <span>Condicion IVA</span>
                    <strong>{data.profile?.ivaCondition ?? "Sin cargar"}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{data.profile?.contactEmail ?? "Sin cargar"}</strong>
                  </div>
                </div>
              }
            >
              <form className="tenant-profile-form" onSubmit={(event) => void handleSaveProfile(event)}>
                <label className="field">
                  <span>Razon social</span>
                  <input
                    type="text"
                    value={profileLegalName}
                    onChange={(event) => {
                      setProfileLegalName(event.target.value);
                      setProfileErrorMessage(null);
                      setProfileSuccessMessage(null);
                    }}
                    placeholder="Empresa S.A."
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>Nombre comercial</span>
                  <input
                    type="text"
                    value={profileTradeName}
                    onChange={(event) => setProfileTradeName(event.target.value)}
                    placeholder="Nombre de fantasia"
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>CUIT</span>
                  <input
                    type="text"
                    value={profileCuit}
                    onChange={(event) => handleProfileCuitChange(event.target.value)}
                    placeholder="30719022525"
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>Condicion IVA</span>
                  <select
                    value={profileIvaCondition}
                    onChange={(event) => setProfileIvaCondition(event.target.value)}
                    disabled={isSavingProfile}
                  >
                    <option value="">Seleccionar</option>
                    <option value="responsable_inscripto">Responsable inscripto</option>
                    <option value="monotributo">Monotributo</option>
                    <option value="exento">Exento</option>
                    <option value="consumidor_final">Consumidor final</option>
                  </select>
                </label>
                <label className="field tenant-profile-form__wide">
                  <span>Domicilio fiscal</span>
                  <input
                    type="text"
                    value={profileFiscalAddress}
                    onChange={(event) => setProfileFiscalAddress(event.target.value)}
                    placeholder="Calle, numero, localidad, provincia"
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>Email de contacto</span>
                  <input
                    type="email"
                    value={profileContactEmail}
                    onChange={(event) => setProfileContactEmail(event.target.value)}
                    placeholder="contacto@cliente.com"
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>Telefono</span>
                  <input
                    type="text"
                    value={profileContactPhone}
                    onChange={(event) => setProfileContactPhone(event.target.value)}
                    placeholder="+54 9 ..."
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>Responsable</span>
                  <input
                    type="text"
                    value={profileResponsibleName}
                    onChange={(event) => setProfileResponsibleName(event.target.value)}
                    placeholder="Nombre y apellido"
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="field">
                  <span>Email responsable</span>
                  <input
                    type="email"
                    value={profileResponsibleEmail}
                    onChange={(event) => setProfileResponsibleEmail(event.target.value)}
                    placeholder="responsable@cliente.com"
                    disabled={isSavingProfile}
                  />
                </label>

                <div className="tenant-form__actions">
                  <button type="submit" className="primary-button" disabled={!canSaveProfile}>
                    {isSavingProfile ? "Guardando..." : "Guardar datos"}
                  </button>
                </div>

                {profileErrorMessage ? <p className="form-error">{profileErrorMessage}</p> : null}
                {profileSuccessMessage ? <p className="form-success">{profileSuccessMessage}</p> : null}
              </form>
            </PermissionGate>

            <div className="profile-review-box">
              <div>
                <strong>Revision interna</strong>
                <span>
                  {data.profile?.reviewedAt
                    ? `Ultima revision ${formatDateTime(data.profile.reviewedAt)}`
                    : "Sin revision registrada"}
                </span>
                {data.profile?.reviewNotes ? <p>{data.profile.reviewNotes}</p> : null}
              </div>

              <PermissionGate
                permission="tenants:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol puede consultar la revision, pero no aprobar ni rechazar datos.</span>
                  </div>
                }
              >
                <div className="profile-review-actions">
                  <label className="field">
                    <span>Nota de revision</span>
                    <textarea
                      value={profileReviewNotes}
                      onChange={(event) => {
                        setProfileReviewNotes(event.target.value);
                        setProfileReviewErrorMessage(null);
                        setProfileReviewSuccessMessage(null);
                      }}
                      placeholder="Dato validado, correccion solicitada, observacion interna..."
                      disabled={isReviewingProfile}
                    />
                  </label>
                  <div className="tenant-form__actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={!canReviewProfile}
                      onClick={() => void handleReviewProfile("APPROVED")}
                    >
                      {isReviewingProfile ? "Revisando..." : "Aprobar datos"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button secondary-button--danger"
                      disabled={!data.profile || isReviewingProfile}
                      onClick={() => void handleReviewProfile("REJECTED")}
                    >
                      Rechazar
                    </button>
                  </div>
                  {!isProfileComplete(data.profile) ? (
                    <p className="form-error">Completa razon social, CUIT, IVA, domicilio y email antes de aprobar.</p>
                  ) : null}
                  {profileReviewErrorMessage ? <p className="form-error">{profileReviewErrorMessage}</p> : null}
                  {profileReviewSuccessMessage ? <p className="form-success">{profileReviewSuccessMessage}</p> : null}
                </div>
              </PermissionGate>
            </div>
          </section> : null}

          {activeTab === "subscription" ? <section id="tenant-subscription" className="panel tenant-subscription-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Plan y suscripcion</span>
                <h2>Condiciones comerciales</h2>
              </div>
              <span className={`badge badge--${data.currentSubscription.planName ? "success" : "warning"}`}>
                {data.currentSubscription.planName ? data.currentSubscription.status : "Sin plan"}
              </span>
            </div>

            <div className="subscription-layout">
              <article className="subscription-summary">
                <span>Plan actual</span>
                <strong>{data.currentSubscription.planName ?? "Sin plan asignado"}</strong>
                <p>
                  {data.currentSubscription.planCode
                    ? `${data.currentSubscription.planCode} · ${data.currentSubscription.status}`
                    : "Selecciona un plan activo para ordenar la operacion comercial del cliente."}
                </p>
                {data.currentSubscription.billingProvider || data.currentSubscription.billingRef ? (
                  <small>
                    {[data.currentSubscription.billingProvider, data.currentSubscription.billingRef].filter(Boolean).join(" · ")}
                  </small>
                ) : null}
                {data.currentSubscription.updatedAt ? (
                  <small>{`Actualizada ${formatDateTime(data.currentSubscription.updatedAt)}`}</small>
                ) : null}
              </article>

              <PermissionGate
                permission="users:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol puede consultar la suscripcion, pero no modificar condiciones comerciales.</span>
                  </div>
                }
              >
                <form className="subscription-form" onSubmit={(event) => void handleSaveSubscription(event)}>
                  <label className="field">
                    <span>Plan</span>
                    <select
                      value={subscriptionPlanId}
                      onChange={(event) => {
                        setSubscriptionPlanId(event.target.value);
                        setSubscriptionErrorMessage(null);
                        setSubscriptionSuccessMessage(null);
                      }}
                      disabled={isSavingSubscription || arePlansLoading}
                    >
                      <option value="">Seleccionar plan</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id} disabled={plan.status !== "ACTIVE"}>
                          {`${plan.name} · ${formatPlanPrice(plan)} · ${getBillingCycleLabel(plan.billingCycle)}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Estado</span>
                    <select
                      value={subscriptionStatus}
                      onChange={(event) => setSubscriptionStatus(event.target.value)}
                      disabled={isSavingSubscription}
                    >
                      <option value="ACTIVE">Activa</option>
                      <option value="PAST_DUE">Con deuda</option>
                      <option value="CANCELED">Cancelada</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Proveedor de cobro</span>
                    <input
                      type="text"
                      value={subscriptionBillingProvider}
                      onChange={(event) => setSubscriptionBillingProvider(event.target.value)}
                      placeholder="mercadopago, transferencia..."
                      disabled={isSavingSubscription}
                    />
                  </label>

                  <label className="field">
                    <span>Referencia</span>
                    <input
                      type="text"
                      value={subscriptionBillingRef}
                      onChange={(event) => setSubscriptionBillingRef(event.target.value)}
                      placeholder="ID externo, comprobante o nota"
                      disabled={isSavingSubscription}
                    />
                  </label>

                  {selectedPlan ? (
                    <div className="subscription-selected-plan">
                      <strong>{selectedPlan.name}</strong>
                      <span>{`${formatPlanPrice(selectedPlan)} · ${getBillingCycleLabel(selectedPlan.billingCycle)}`}</span>
                      {selectedPlan.description ? <p>{selectedPlan.description}</p> : null}
                    </div>
                  ) : null}

                  <div className="tenant-form__actions">
                    <button type="submit" className="primary-button" disabled={!canSaveSubscription}>
                      {isSavingSubscription ? "Guardando..." : "Guardar suscripcion"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void reloadPlans()} disabled={arePlansLoading}>
                      {arePlansLoading ? "Cargando..." : "Actualizar planes"}
                    </button>
                  </div>

                  {plansErrorMessage ? <p className="form-error">{plansErrorMessage}</p> : null}
                  {subscriptionErrorMessage ? <p className="form-error">{subscriptionErrorMessage}</p> : null}
                  {subscriptionSuccessMessage ? <p className="form-success">{subscriptionSuccessMessage}</p> : null}
                </form>
              </PermissionGate>
            </div>
          </section> : null}

          {activeTab === "payments" ? <section id="tenant-payments" className="panel payments-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Operacion</span>
                <h2>Pagos y facturacion</h2>
              </div>
              <button type="button" className="secondary-button" onClick={() => void reloadPayments()}>
                Actualizar pagos
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isExportingPayments}
                onClick={() => void handleExportPayments()}
              >
                {isExportingPayments ? "Exportando..." : "Exportar CSV"}
              </button>
            </div>

            <div className="payments-filters">
              <label className="field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={paymentSearch}
                  onChange={(event) => {
                    setPaymentSearch(event.target.value);
                    setPaymentsPage(1);
                  }}
                  placeholder="cliente, comprobante, ID..."
                />
              </label>

              <label className="field">
                <span>Estado</span>
                <select
                  value={paymentStatusFilter}
                  onChange={(event) => {
                    setPaymentStatusFilter(event.target.value);
                    setPaymentsPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="afip_pending">ARCA pending</option>
                  <option value="pdf_pending">PDF pending</option>
                  <option value="drive_pending">Drive pending</option>
                  <option value="sheets_pending">Sheets pending</option>
                  <option value="complete">Complete</option>
                  <option value="failed">Failed</option>
                </select>
              </label>

              <label className="field">
                <span>Provider</span>
                <select
                  value={paymentProviderFilter}
                  onChange={(event) => {
                    setPaymentProviderFilter(event.target.value);
                    setPaymentsPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="MERCADOPAGO">Mercado Pago</option>
                </select>
              </label>
            </div>

            <PermissionGate permission="payments:manage">
              <form className="payment-import-form" onSubmit={(event) => void handleImportMercadoPagoPayments(event)}>
                <label className="field">
                  <span>Traer Mercado Pago desde</span>
                  <input
                    type="date"
                    value={mercadoPagoImportFrom}
                    onChange={(event) => {
                      setMercadoPagoImportFrom(event.target.value);
                      setMercadoPagoImportErrorMessage(null);
                      setMercadoPagoImportMessage(null);
                    }}
                    disabled={isImportingMercadoPagoPayments}
                  />
                </label>
                <button type="submit" className="secondary-button" disabled={!canImportMercadoPagoPayments}>
                  {isImportingMercadoPagoPayments ? "Solicitando..." : "Importar pagos MP"}
                </button>
                {mercadoPagoImportErrorMessage ? <p className="form-error">{mercadoPagoImportErrorMessage}</p> : null}
                {mercadoPagoImportMessage ? <p className="form-success">{mercadoPagoImportMessage}</p> : null}
              </form>
            </PermissionGate>

            {arePaymentsLoading ? (
              <div className="panel-state">
                <strong>Cargando pagos...</strong>
                <span>Estamos trayendo movimientos del cliente.</span>
              </div>
            ) : paymentsErrorMessage ? (
              <div className="panel-state panel-state--danger">
                <strong>No pudimos cargar los pagos</strong>
                <span>{paymentsErrorMessage}</span>
              </div>
            ) : payments && payments.items.length > 0 ? (
              <>
                <div className="payments-list" aria-label="Pagos del cliente">
                  {payments.items.map((payment) => (
                    <article key={payment.id} className="payment-card">
                      <div className="payment-card__main">
                        <div>
                          <strong>{payment.customer || payment.provider_payment_id || `Pago ${payment.id}`}</strong>
                          <span>
                            {payment.provider}
                            {payment.cbte_nro ? ` - ${payment.cbte_nro}` : ""}
                          </span>
                          <small>{formatDateTime(payment.createdAt)}</small>
                        </div>
                        <div className="payment-card__amount">
                          <strong>{formatCurrency(payment.amount)}</strong>
                          <span>{payment.currency ?? "ARS"}</span>
                        </div>
                      </div>

                      <div className="payment-card__meta">
                        <span className={`badge badge--${payment.status === "complete" ? "success" : payment.status === "failed" ? "danger" : "warning"}`}>
                          {prettifyStatus(payment.status)}
                        </span>
                        {payment.cae ? <span>CAE {payment.cae}</span> : null}
                        {payment.drive_file_link ? (
                          <a href={payment.drive_file_link} target="_blank" rel="noreferrer">
                            Ver Drive
                          </a>
                        ) : null}
                        {payment.error ? <span className="payment-card__error">{payment.error}</span> : null}
                        <Link to={`/admin/payments/${payment.id}`}>Ver detalle</Link>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="pagination-row">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={payments.pagination.page <= 1}
                    onClick={() => setPaymentsPage((currentPage) => Math.max(1, currentPage - 1))}
                  >
                    Anterior
                  </button>
                  <span>
                    Pagina {payments.pagination.page} de {payments.pagination.totalPages || 1} - {payments.pagination.total} pagos
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={payments.pagination.page >= payments.pagination.totalPages}
                    onClick={() => setPaymentsPage((currentPage) => currentPage + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : (
              <div className="panel-state">
                <strong>Todavia no hay pagos con esos filtros</strong>
                <span>Cuando Mercado Pago informe cobros de este cliente, van a aparecer aca.</span>
              </div>
            )}
            {paymentsExportErrorMessage ? <p className="form-error payments-export-error">{paymentsExportErrorMessage}</p> : null}
          </section> : null}

          {activeTab === "notes" ? <section id="tenant-notes" className="panel notes-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Seguimiento</span>
                <h2>Notas internas</h2>
              </div>
              <button type="button" className="secondary-button" onClick={() => void reloadNotes()}>
                Actualizar notas
              </button>
            </div>

            <div className="notes-layout">
              <PermissionGate
                permission="tenants:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol puede consultar notas, pero no crear nuevas.</span>
                  </div>
                }
              >
                <form className="note-form" onSubmit={(event) => void handleCreateNote(event)}>
                  <label className="field">
                    <span>Titulo</span>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(event) => {
                        setNoteTitle(event.target.value);
                        setNoteErrorMessage(null);
                        setNoteSuccessMessage(null);
                      }}
                      placeholder="Seguimiento comercial"
                      disabled={isCreatingNote}
                    />
                  </label>

                  <label className="field">
                    <span>Detalle</span>
                    <textarea
                      value={noteBody}
                      onChange={(event) => {
                        setNoteBody(event.target.value);
                        setNoteErrorMessage(null);
                        setNoteSuccessMessage(null);
                      }}
                      placeholder="Cliente reporta una diferencia, proximo contacto, decision operativa..."
                      disabled={isCreatingNote}
                    />
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={isNotePinned}
                      onChange={(event) => setIsNotePinned(event.target.checked)}
                      disabled={isCreatingNote}
                    />
                    <span>Fijar nota como importante</span>
                  </label>

                  <button type="submit" className="primary-button" disabled={!canCreateNote}>
                    {isCreatingNote ? "Creando nota..." : "Crear nota"}
                  </button>

                  {noteErrorMessage ? <p className="form-error">{noteErrorMessage}</p> : null}
                  {noteSuccessMessage ? <p className="form-success">{noteSuccessMessage}</p> : null}
                </form>
              </PermissionGate>

              <div className="notes-list" aria-label="Listado de notas internas">
                {areNotesLoading ? (
                  <div className="panel-state">
                    <strong>Cargando notas...</strong>
                    <span>Estamos trayendo el seguimiento interno del cliente.</span>
                  </div>
                ) : notesErrorMessage ? (
                  <div className="panel-state panel-state--danger">
                    <strong>No pudimos cargar las notas</strong>
                    <span>{notesErrorMessage}</span>
                  </div>
                ) : notes && notes.length > 0 ? (
                  notes.map((note) => (
                    <article key={note.id} className={`note-card${note.pinned ? " note-card--pinned" : ""}`}>
                      <div className="note-card__header">
                        <div>
                          <strong>{note.title}</strong>
                          <span>{formatDateTime(note.createdAt)}</span>
                        </div>
                        {note.pinned ? <span className="badge badge--warning">Fijada</span> : null}
                      </div>
                      <p>{note.body}</p>
                      {note.createdByAdmin ? (
                        <small>{`${note.createdByAdmin.email} · ${note.createdByAdmin.role}`}</small>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div className="panel-state">
                    <strong>Todavia no hay notas</strong>
                    <span>Cuando alguien registre seguimiento interno, va a aparecer aca.</span>
                  </div>
                )}
              </div>
            </div>
          </section> : null}

          {activeTab === "users" ? <section id="tenant-users" className="panel users-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Accesos</span>
                <h2>Usuarios del cliente</h2>
              </div>
              <button type="button" className="secondary-button" onClick={() => void reloadUsers()}>
                Actualizar usuarios
              </button>
            </div>

            <div className="users-layout">
              <PermissionGate
                permission="tenant-users:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol puede consultar usuarios, pero no crear ni actualizar accesos.</span>
                  </div>
                }
              >
                <form className="user-form" onSubmit={(event) => void handleSaveUser(event)}>
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(event) => {
                        setUserEmail(event.target.value);
                        setUserErrorMessage(null);
                        setUserSuccessMessage(null);
                      }}
                      placeholder="owner@cliente.com"
                      disabled={isSavingUser}
                      readOnly={Boolean(editingUserId)}
                    />
                    {editingUserId ? <small>El email no se puede cambiar. Para otro email, creá un usuario nuevo.</small> : null}
                  </label>

                  <label className="field">
                    <span>Rol</span>
                    <select
                      value={userRole}
                      onChange={(event) => {
                        setUserRole(event.target.value as TenantUserRole);
                        setUserErrorMessage(null);
                        setUserSuccessMessage(null);
                      }}
                      disabled={isSavingUser}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="approver">Approver</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Estado</span>
                    <select
                      value={userStatus}
                      onChange={(event) => {
                        setUserStatus(event.target.value as TenantStatus);
                        setUserErrorMessage(null);
                        setUserSuccessMessage(null);
                      }}
                      disabled={isSavingUser}
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="DISABLED">Deshabilitado</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>{editingUserId ? "Nueva contraseña (opcional)" : "Contraseña (opcional)"}</span>
                    <input
                      type="password"
                      value={userPassword}
                      onChange={(event) => {
                        setUserPassword(event.target.value);
                        setUserErrorMessage(null);
                        setUserSuccessMessage(null);
                      }}
                      placeholder="Mínimo 8 caracteres"
                      disabled={isSavingUser}
                    />
                  </label>

                  <div className="tenant-form__actions">
                    <button type="submit" className="primary-button" disabled={!canSaveUser}>
                      {isSavingUser ? "Guardando usuario..." : "Guardar usuario"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isSavingUser}
                      onClick={() => {
                        setEditingUserId(null);
                        setUserEmail("");
                        setUserRole("viewer");
                        setUserStatus("ACTIVE");
                        setUserPassword("");
                        setUserErrorMessage(null);
                        setUserSuccessMessage(null);
                      }}
                    >
                      {editingUserId ? "Cancelar edición" : "Limpiar"}
                    </button>
                  </div>

                  {userErrorMessage ? <p className="form-error">{userErrorMessage}</p> : null}
                  {userSuccessMessage ? <p className="form-success">{userSuccessMessage}</p> : null}
                </form>
              </PermissionGate>

              <div className="users-list" aria-label="Listado de usuarios del cliente">
                {areUsersLoading ? (
                  <div className="panel-state">
                    <strong>Cargando usuarios...</strong>
                    <span>Estamos trayendo los accesos del cliente.</span>
                  </div>
                ) : usersErrorMessage ? (
                  <div className="panel-state panel-state--danger">
                    <strong>No pudimos cargar los usuarios</strong>
                    <span>{usersErrorMessage}</span>
                  </div>
                ) : tenantUsers && tenantUsers.length > 0 ? (
                  tenantUsers.map((tenantUser) => (
                    <article key={tenantUser.id} className="user-card">
                      <div className="user-card__header">
                        <div>
                          <strong>{tenantUser.email}</strong>
                          <span>{tenantUser.role}</span>
                        </div>
                        <span className={`badge badge--${tenantUser.status === "ACTIVE" ? "success" : "muted"}`}>
                          {tenantUser.status === "ACTIVE" ? "Activo" : "Deshabilitado"}
                        </span>
                      </div>
                      <div className="user-card__meta">
                        <span>{tenantUser.lastLoginAt ? `Ultimo ingreso ${formatDateTime(tenantUser.lastLoginAt)}` : "Sin ingresos registrados"}</span>
                        <span>{`Actualizado ${formatDateTime(tenantUser.updatedAt)}`}</span>
                      </div>
                      <PermissionGate permission="tenant-users:manage">
                        <button type="button" className="secondary-button" onClick={() => startUserEdit(tenantUser)}>
                          Editar acceso
                        </button>
                      </PermissionGate>
                    </article>
                  ))
                ) : (
                  <div className="panel-state">
                    <strong>Todavia no hay usuarios</strong>
                    <span>Crea el primer acceso para que el cliente pueda entrar al portal.</span>
                  </div>
                )}
              </div>
            </div>
          </section> : null}

          {activeTab === "integrations" ? <section id="tenant-integrations" className="panel integrations-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Integraciones</span>
                <h2>Conexiones del cliente</h2>
              </div>
            </div>

            <div className="integration-warning">
              <strong>Guardado sensible</strong>
              <span>
                Cargá los datos como los envió el cliente. La configuración se guarda cifrada. Los secretos guardados se muestran
                enmascarados: si no los cambiás, se conservan tal cual al probar o guardar.
              </span>
            </div>

            <div className="integrations-layout">
              <PermissionGate
                permission="integrations:manage"
                fallback={
                  <div className="panel-state">
                    <strong>Solo lectura</strong>
                    <span>Tu rol puede consultar integraciones, pero no modificar secretos ni configuraciones.</span>
                  </div>
                }
              >
                <form className="integration-form" onSubmit={(event) => void handleSaveIntegration(event)}>
                  <label className="field">
                    <span>Proveedor</span>
                    <select
                      value={integrationProvider}
                      onChange={(event) => selectIntegrationProvider(event.target.value as IntegrationProvider)}
                      disabled={isSavingIntegration || isTestingIntegration}
                    >
                      {integrationProviders.map((provider) => (
                        <option key={provider} value={provider}>{getIntegrationProviderLabel(provider)}</option>
                      ))}
                    </select>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={isIntegrationEnabled}
                      onChange={(event) => {
                        setIsIntegrationEnabled(event.target.checked);
                        setIntegrationErrorMessage(null);
                        setIntegrationSuccessMessage(null);
                        setIntegrationTestResult(null);
                      }}
                      disabled={isSavingIntegration || isTestingIntegration}
                    />
                    <span>Integración activada (activala cuando la conexión esté probada)</span>
                  </label>

                  {integrationProvider === "MERCADOPAGO" ? (
                    <div className="integration-mode-panel">
                      <div>
                        <span>Modo de lectura</span>
                        {allowedMercadopagoPollingModes.length > 1 ? (
                          <div className="integration-segmented-control" role="group" aria-label="Modo de lectura">
                            {allowedMercadopagoPollingModes.map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={selectedMercadopagoPollingMode === mode ? "integration-segmented-control__active" : ""}
                                aria-pressed={selectedMercadopagoPollingMode === mode}
                                onClick={() => updateMercadopagoPollingMode(mode)}
                                disabled={isSavingIntegration || isTestingIntegration}
                              >
                                {getMercadopagoPollingModeLabel(mode)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <strong>{getMercadopagoPollingModeLabel(selectedMercadopagoPollingMode)}</strong>
                        )}
                        <small>
                          {!currentPlanPolicy
                            ? "El cliente no tiene plan: Mercado Pago no se va a poder guardar hasta asignarle uno."
                            : data.currentSubscription.status !== "ACTIVE"
                              ? "La suscripción del cliente no está activa: Mercado Pago no se va a poder guardar hasta regularizarla."
                            : allowedMercadopagoPollingModes.length === 0
                              ? "El plan actual no habilita la lectura automática de Mercado Pago."
                              : allowedMercadopagoPollingModes.length > 1
                                ? `${data.currentSubscription.planName ?? "El plan"} permite ambos modos.`
                                : `${data.currentSubscription.planName ?? "El plan"} solo permite ${getMercadopagoPollingModeLabel(allowedMercadopagoPollingModes[0]).toLowerCase()}.`}
                        </small>
                        {isSavedMercadopagoModeNotAllowed ? (
                          <small className="form-error">
                            {`La configuración guardada usa ${getMercadopagoPollingModeLabel(savedMercadopagoPollingMode as MercadopagoPollingMode).toLowerCase()}, que el plan actual no permite. Si guardás, pasa a ${getMercadopagoPollingModeLabel(selectedMercadopagoPollingMode).toLowerCase()}.`}
                          </small>
                        ) : null}
                        {selectedMercadopagoPollingMode === "realtime" && currentPlanPolicy?.processing.minRealtimeIntervalMs ? (
                          <small>{`Intervalo mínimo del plan: ${currentPlanPolicy.processing.minRealtimeIntervalMs} ms.`}</small>
                        ) : null}
                        {selectedMercadopagoPollingMode === "scheduled" && currentPlanPolicy?.processing.maxRunsPerDay ? (
                          <small>{`Máximo del plan: ${currentPlanPolicy.processing.maxRunsPerDay} lecturas por día.`}</small>
                        ) : null}
                      </div>
                      {selectedMercadopagoPollingMode === "scheduled" ? (
                        <div className="integration-segmented-control" role="group" aria-label="Tipo de programación">
                          <button
                            type="button"
                            className={selectedMercadopagoScheduleMode === "runs" ? "integration-segmented-control__active" : ""}
                            onClick={() => updateMercadopagoScheduleMode("runs")}
                            disabled={isSavingIntegration || isTestingIntegration}
                          >
                            Lecturas por día
                          </button>
                          <button
                            type="button"
                            className={selectedMercadopagoScheduleMode === "times" ? "integration-segmented-control__active" : ""}
                            onClick={() => updateMercadopagoScheduleMode("times")}
                            disabled={isSavingIntegration || isTestingIntegration}
                          >
                            Horarios
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {shouldSuggestProfileCuit ? (
                    <div className="integration-warning">
                      <strong>CUIT distinto al de Datos fiscales</strong>
                      <span>
                        {afipFormCuit
                          ? `El CUIT de ARCA (${afipFormCuit}) no coincide con el de Datos fiscales (${profileCuitSuggestion}).`
                          : `Datos fiscales tiene el CUIT ${profileCuitSuggestion}.`}
                      </span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => updateIntegrationField("CUIT", profileCuitSuggestion)}
                        disabled={isSavingIntegration || isTestingIntegration}
                      >
                        Usar el CUIT de Datos fiscales
                      </button>
                    </div>
                  ) : null}

                  {isGoogleProvider(integrationProvider) ? (
                    <p className={hasGoogleAuthorization(selectedSavedIntegration?.config) ? "form-success" : "form-error"}>
                      {hasGoogleAuthorization(selectedSavedIntegration?.config)
                        ? "Google está autorizado para este cliente."
                        : "Falta autorizar Google: usá “Conectar Google” antes de guardar o probar."}
                    </p>
                  ) : null}

                  <div className="integration-fields">
                    {selectedIntegrationFields.map((field) => (
                      <label key={field.key} className={`field${field.multiline ? " integration-field--wide" : ""}`}>
                        <span>{`${field.label}${field.required ? " *" : ""}`}</span>
                        {field.key === "RUN_AT_TIMES" ? (
                          <div className="integration-time-list">
                            {(parseRunTimes(integrationFormValues.RUN_AT_TIMES ?? "").length > 0
                              ? parseRunTimes(integrationFormValues.RUN_AT_TIMES ?? "")
                              : ["09:00"]
                            ).map((timeValue, index) => (
                              <div key={`${timeValue}-${index}`}>
                                <input
                                  type="time"
                                  value={timeValue}
                                  onChange={(event) => updateMercadopagoRunTime(index, event.target.value)}
                                  disabled={isSavingIntegration || isTestingIntegration}
                                />
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => removeMercadopagoRunTime(index)}
                                  disabled={isSavingIntegration || isTestingIntegration || parseRunTimes(integrationFormValues.RUN_AT_TIMES ?? "").length <= 1}
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={addMercadopagoRunTime}
                              disabled={isSavingIntegration || isTestingIntegration}
                            >
                              Agregar horario
                            </button>
                          </div>
                        ) : field.options ? (
                          <select
                            value={integrationFormValues[field.key] ?? ""}
                            onChange={(event) => updateIntegrationField(field.key, event.target.value)}
                            disabled={isSavingIntegration || isTestingIntegration}
                          >
                            <option value="">Sin definir</option>
                            {field.options.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : field.multiline ? (
                          <textarea
                            value={integrationFormValues[field.key] ?? ""}
                            onChange={(event) => updateIntegrationField(field.key, event.target.value)}
                            disabled={isSavingIntegration || isTestingIntegration}
                          />
                        ) : (
                          <div className={field.secret ? "integration-secret-input" : undefined}>
                            <input
                              type={field.secret
                                ? visibleIntegrationSecretFields[`${integrationProvider}:${field.key}:form`] ? "text" : "password"
                                : field.inputType ?? "text"}
                              value={integrationFormValues[field.key] ?? ""}
                              onChange={(event) => updateIntegrationField(field.key, event.target.value)}
                              disabled={isSavingIntegration || isTestingIntegration}
                            />
                            {field.secret && (canRevealSecrets || !hasMaskedValue(integrationFormValues[field.key])) ? (
                              <button
                                type="button"
                                className="integration-secret-button"
                                aria-label={visibleIntegrationSecretFields[`${integrationProvider}:${field.key}:form`] ? "Ocultar valor" : "Ver valor"}
                                title={visibleIntegrationSecretFields[`${integrationProvider}:${field.key}:form`] ? "Ocultar valor" : "Ver valor"}
                                onClick={() => void toggleIntegrationFormSecretVisibility(field.key)}
                                disabled={isSavingIntegration || isTestingIntegration || isRevealingIntegrationSecrets}
                              >
                                {visibleIntegrationSecretFields[`${integrationProvider}:${field.key}:form`] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                              </button>
                            ) : null}
                          </div>
                        )}
                        {field.helper ? <small>{field.helper}</small> : null}
                        {field.secret && hasMaskedValue(integrationFormValues[field.key]) ? (
                          <small>Valor guardado. Dejalo así para conservarlo o escribí uno nuevo para reemplazarlo.</small>
                        ) : null}
                      </label>
                    ))}
                  </div>

                  {integrationProvider === "AFIP" ? (
                    <div className="afip-file-fields">
                      <div className="field integration-file-field">
                        <span>Subir certificado ARCA</span>
                        <label className="integration-file-upload">
                          <input
                            type="file"
                            accept=".crt,.cer,.pem,.txt"
                            disabled={isSavingIntegration || isTestingIntegration}
                            onChange={(event) => void handleAfipFileUpload("CERT_B64", event.target.files?.[0])}
                          />
                          <span>Elegir archivo</span>
                          <small>{afipFileNames.CERT_B64 ?? (selectedSavedIntegration?.config.CERT_B64 ? "Archivo guardado (se conserva si no subís otro)" : "Sin archivo seleccionado")}</small>
                        </label>
                      </div>

                      <div className="field integration-file-field">
                        <span>Subir clave privada ARCA</span>
                        <label className="integration-file-upload">
                          <input
                            type="file"
                            accept=".key,.pem,.txt"
                            disabled={isSavingIntegration || isTestingIntegration}
                            onChange={(event) => void handleAfipFileUpload("KEY_B64", event.target.files?.[0])}
                          />
                          <span>Elegir archivo</span>
                          <small>{afipFileNames.KEY_B64 ?? (selectedSavedIntegration?.config.KEY_B64 ? "Archivo guardado (se conserva si no subís otro)" : "Sin archivo seleccionado")}</small>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className="integration-form__actions">
                    {isGoogleProvider(integrationProvider) ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={isAuthorizingGoogle || isSavingIntegration || isTestingIntegration}
                        onClick={() => void handleAuthorizeGoogle()}
                      >
                        {isAuthorizingGoogle
                          ? "Esperando autorización..."
                          : hasGoogleAuthorization(selectedSavedIntegration?.config) ? "Reautorizar Google" : "Conectar Google"}
                      </button>
                    ) : null}
                    <button type="button" className="secondary-button" disabled={!canTestIntegration} onClick={() => void handleTestIntegration()}>
                      {isTestingIntegration ? "Probando conexión..." : "Probar conexión"}
                    </button>
                    <button type="submit" className="primary-button" disabled={!canSaveIntegration}>
                      {isSavingIntegration ? "Guardando..." : "Guardar"}
                    </button>
                  </div>

                  {integrationErrorMessage ? <p className="form-error">{integrationErrorMessage}</p> : null}
                  {integrationSuccessMessage ? <p className="form-success">{integrationSuccessMessage}</p> : null}
                  {integrationTestResult ? (
                    <div className={`integration-test-result${integrationTestResult.connected ?? integrationTestResult.ok ? " integration-test-result--success" : ""}`}>
                      <strong>{integrationTestResult.connected ?? integrationTestResult.ok ? "Conexión OK" : "La prueba respondió con advertencias"}</strong>
                      {Array.isArray(integrationTestResult.warnings) && integrationTestResult.warnings.length > 0 ? (
                        <ul>
                          {integrationTestResult.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : null}
                      <dl>
                        {getIntegrationTestRows(integrationTestResult).map((row) => (
                          <div key={row.key}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </form>
              </PermissionGate>

              <div className="integrations-list" aria-label="Última integración guardada del proveedor seleccionado">
                {areIntegrationsLoading ? (
                  <div className="panel-state">
                    <strong>Cargando integraciones...</strong>
                    <span>Estamos trayendo las configuraciones del cliente.</span>
                  </div>
                ) : integrationsErrorMessage ? (
                  <div className="panel-state panel-state--danger">
                    <strong>No pudimos cargar las integraciones</strong>
                    <span>{integrationsErrorMessage}</span>
                  </div>
                ) : selectedSavedIntegrationForDisplay ? (
                    <article key={selectedSavedIntegrationForDisplay.id} className="integration-card">
                      <div className="integration-card__header">
                        <div>
                          <strong>{getIntegrationProviderLabel(selectedSavedIntegrationForDisplay.provider)}</strong>
                          <span>{`Actualizada ${formatDateTime(selectedSavedIntegrationForDisplay.updatedAt)}`}</span>
                        </div>
                        <span className={`badge badge--${selectedSavedIntegrationForDisplay.enabled ? "success" : "muted"}`}>
                          {selectedSavedIntegrationForDisplay.enabled ? "Activada" : "Desactivada"}
                        </span>
                      </div>
                      <dl className="integration-config-fields">
                        {getSavedIntegrationDisplayFields(selectedSavedIntegrationForDisplay.provider, selectedSavedIntegrationForDisplay.config).map((field) => {
                          const visibilityKey = `${integrationProvider}:${field.key}:saved`;
                          const displayedIntegration = visibleIntegrationSecretFields[visibilityKey]
                            ? revealedIntegrationByProvider[integrationProvider] ?? selectedSavedIntegrationForDisplay
                            : selectedSavedIntegrationForDisplay;
                          const displayedValue = displayedIntegration.config[field.key];

                          return (
                            <div key={field.key}>
                              <dt>{field.label}</dt>
                              <dd>
                                {field.secret ? (
                                  <span className="integration-secret-display">
                                    <span>
                                      {!visibleIntegrationSecretFields[visibilityKey]
                                        ? getMaskedDisplayValue(displayedValue)
                                        : getDisplayValue(displayedValue)}
                                    </span>
                                    {canRevealSecrets ? (
                                      <button
                                        type="button"
                                        className="integration-secret-button"
                                        aria-label={visibleIntegrationSecretFields[visibilityKey] ? "Ocultar valor" : "Ver valor"}
                                        title={visibleIntegrationSecretFields[visibilityKey] ? "Ocultar valor" : "Ver valor"}
                                        onClick={() => void toggleSavedIntegrationSecretVisibility(field.key)}
                                        disabled={isRevealingIntegrationSecrets}
                                      >
                                        {visibleIntegrationSecretFields[visibilityKey] ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                                      </button>
                                    ) : null}
                                  </span>
                                ) : (
                                  getDisplayValue(displayedValue)
                                )}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    </article>
                ) : (
                  <div className="panel-state">
                    <strong>No hay configuración guardada</strong>
                    <span>{`Cuando guardes ${getIntegrationProviderLabel(integrationProvider)}, la última versión va a aparecer acá.`}</span>
                  </div>
                )}
              </div>
            </div>
          </section> : null}

          {activeTab === "advanced" && isSuperadmin ? (
            <section id="tenant-advanced" className="panel danger-zone-panel" aria-label="Zona avanzada">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Avanzado</span>
                  <h2>Zona de peligro</h2>
                </div>
                <span className="badge badge--danger">Solo acceso total</span>
              </div>

              <form className="danger-zone-form" onSubmit={(event) => void handleDeleteTenant(event)}>
                <p>
                  Elimina el cliente y toda su información local: pagos, eventos, usuarios, integraciones, puntos de control, suscripciones, notas, auditoría, secuencias y envíos de onboarding.
                </p>
                <div className="danger-impact-grid">
                  <span>{data.metrics.totalPayments} pagos</span>
                  <span>{data.users.total} usuarios</span>
                  <span>{data.integrations.configuredCount} integraciones configuradas</span>
                  <span>{data.notes.total} notas internas</span>
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={shouldDeleteLocalFiles}
                    onChange={(event) => setShouldDeleteLocalFiles(event.target.checked)}
                    disabled={isDeletingTenant}
                  />
                  <span>Borrar PDFs locales referenciados por pagos</span>
                </label>
                <label className="field">
                  <span>{`Escribí ${data.identity.slug} para confirmar`}</span>
                  <input
                    type="text"
                    value={deleteConfirmationSlug}
                    onChange={(event) => {
                      setDeleteConfirmationSlug(event.target.value);
                      setDeleteErrorMessage(null);
                    }}
                    disabled={isDeletingTenant}
                  />
                </label>
                <button type="submit" className="secondary-button secondary-button--danger" disabled={!canDeleteTenant}>
                  {isDeletingTenant ? "Eliminando cliente..." : "Eliminar cliente completo"}
                </button>
                {deleteErrorMessage ? <p className="form-error">{deleteErrorMessage}</p> : null}
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
