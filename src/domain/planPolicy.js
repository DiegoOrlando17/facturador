export const ENTITLEMENTS = Object.freeze({
  CLIENT_PORTAL: "clientPortal",
  AUTOMATIC_INVOICING: "automaticInvoicing",
  PDF_DOWNLOAD: "pdfDownload",
  CLIENT_APPROVAL: "clientApproval",
  DEFERRED_AUTOMATIC_INVOICING: "deferredAutomaticInvoicing",
  CREDIT_NOTES: "creditNotes",
  MANUAL_INVOICING: "manualInvoicing",
  GOOGLE_DRIVE_SHEETS: "googleDriveSheets",
  OCR_IMPORT: "ocrImport",
});

export const PROCESSING_MODES = Object.freeze({
  REALTIME: "realtime",
  SCHEDULED: "scheduled",
  CONFIRMATION: "confirmation",
});

const DENY_POLICY = Object.freeze({
  schemaVersion: 1,
  tier: null,
  entitlements: Object.freeze({}),
  limits: Object.freeze({
    monthlyInvoices: null,
    tenantUsers: null,
    manualInvoicesMonthly: null,
    ocrDocumentsMonthly: null,
  }),
  processing: Object.freeze({
    allowedModes: Object.freeze([]),
    defaultMode: null,
    minRealtimeIntervalMs: null,
    maxRunsPerDay: null,
  }),
});

const LEGACY_PLAN_TIERS = Object.freeze({ A: 1, B: 1 });

function normalizeEntitlements(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((name) => [String(name), true]));
  }
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).map(([name, enabled]) => [name, enabled === true])
  );
}

function normalizeNullableLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function buildPlanPolicy({ tier, entitlements, limits = {}, processing = {} }) {
  const normalizedEntitlements = normalizeEntitlements(entitlements);
  const allowedModes = Array.isArray(processing.allowedModes)
    ? [...new Set(processing.allowedModes.map(String))]
    : [];

  return {
    schemaVersion: 1,
    tier: Number.isInteger(Number(tier)) ? Number(tier) : null,
    entitlements: normalizedEntitlements,
    limits: {
      monthlyInvoices: normalizeNullableLimit(limits.monthlyInvoices),
      tenantUsers: normalizeNullableLimit(limits.tenantUsers),
      manualInvoicesMonthly: normalizeNullableLimit(limits.manualInvoicesMonthly),
      ocrDocumentsMonthly: normalizeNullableLimit(limits.ocrDocumentsMonthly),
    },
    processing: {
      allowedModes,
      defaultMode: allowedModes.includes(processing.defaultMode)
        ? processing.defaultMode
        : allowedModes[0] ?? null,
      minRealtimeIntervalMs: normalizeNullableLimit(processing.minRealtimeIntervalMs),
      maxRunsPerDay: normalizeNullableLimit(processing.maxRunsPerDay),
    },
  };
}

function parseFeaturesJson(featuresJson) {
  if (!featuresJson) return null;
  try {
    return JSON.parse(featuresJson);
  } catch {
    return null;
  }
}

export function resolvePlanPolicy(plan) {
  if (!plan || plan.status !== "ACTIVE") return DENY_POLICY;

  const parsed = parseFeaturesJson(plan.featuresJson);
  if (parsed?.schemaVersion === 1 && parsed.entitlements) {
    return buildPlanPolicy(parsed);
  }

  const legacyEntitlements = normalizeEntitlements(parsed);
  const tierFromCode = /^TIER_([1-4])$/.exec(String(plan.code || ""))?.[1];
  const tier = Number(tierFromCode || LEGACY_PLAN_TIERS[plan.code] || legacyEntitlements.tier || 0) || null;
  const allowedModes = [
    ...(legacyEntitlements.realtimeProcessing ? [PROCESSING_MODES.REALTIME] : []),
    ...(legacyEntitlements.scheduledProcessing ? [PROCESSING_MODES.SCHEDULED] : []),
    ...(legacyEntitlements.clientApproval ? [PROCESSING_MODES.CONFIRMATION] : []),
  ];

  // A/B son planes operativos heredados anteriores al catalogo por tiers.
  if (LEGACY_PLAN_TIERS[plan.code] && !parsed) {
    legacyEntitlements.clientPortal = true;
    legacyEntitlements.automaticInvoicing = true;
    legacyEntitlements.realtimeProcessing = true;
    legacyEntitlements.pdfDownload = true;
    allowedModes.push(PROCESSING_MODES.REALTIME);
  }

  return buildPlanPolicy({
    tier,
    entitlements: legacyEntitlements,
    processing: { allowedModes, defaultMode: allowedModes[0] },
  });
}

export function hasEntitlement(policy, entitlement) {
  return policy?.entitlements?.[entitlement] === true;
}

export function supportsProcessingMode(policy, mode) {
  return policy?.processing?.allowedModes?.includes(mode) === true;
}
