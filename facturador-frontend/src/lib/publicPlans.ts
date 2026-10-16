/** Plan tal como lo devuelve GET /public/plans. */
export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  billingCycle?: string | null;
  policy: { tier?: number; entitlements?: Record<string, boolean> };
};

/** Qué incluye cada plan, en el orden en que se muestra. Las claves salen de policy.entitlements. */
export const PLAN_FEATURE_LABELS: [key: string, label: string][] = [
  ["automaticInvoicing", "Facturación automática de tus ventas"],
  ["pdfDownload", "PDF de cada comprobante"],
  ["clientPortal", "Portal para tu equipo"],
  ["realtimeProcessing", "Lectura de ventas al instante"],
  ["scheduledProcessing", "Emisión en los horarios que elijas"],
  ["clientApproval", "Confirmás antes de emitir"],
  ["deferredAutomaticInvoicing", "Emisión diferida"],
  ["creditNotes", "Notas de crédito"],
  ["manualInvoicing", "Facturas manuales"],
  ["googleDriveSheets", "Google Drive y Sheets"],
  ["ocrImport", "Carga asistida con OCR"],
];

export function enabledPlanFeatures(plan: PublicPlan | undefined) {
  const entitlements = plan?.policy.entitlements ?? {};
  return PLAN_FEATURE_LABELS.filter(([key]) => entitlements[key]).map(([key]) => key);
}

export function planFeatureLabel(key: string) {
  return PLAN_FEATURE_LABELS.find(([featureKey]) => featureKey === key)?.[1] ?? key;
}

export function isMonthlyPlan(plan: PublicPlan) {
  return plan.billingCycle === "monthly" || !plan.billingCycle;
}

/** Aclaración del cobro: precio en dólares, cobro en pesos a cotización BNA. */
export const PLAN_BILLING_NOTE = "Precio mensual en dólares, cobrado en pesos al tipo de cambio vendedor del Banco Nación.";
