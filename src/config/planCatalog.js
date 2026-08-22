import { buildPlanPolicy } from "../domain/planPolicy.js";

const baseFeatures = {
  clientPortal: true,
  automaticInvoicing: true,
  realtimeProcessing: true,
  scheduledProcessing: true,
  pdfDownload: true,
};

const tier2Features = {
  ...baseFeatures,
  clientApproval: true,
  deferredAutomaticInvoicing: true,
  creditNotes: true,
};

const tier3Features = {
  ...tier2Features,
  manualInvoicing: true,
  googleDriveSheets: true,
};

const tier4Features = {
  ...tier3Features,
  ocrImport: true,
};

export const PLAN_CATALOG = [
  {
    code: "TIER_1",
    name: "Tier 1",
    description: "Facturacion automatica o programada desde Mercado Pago POS, portal cliente y PDF bajo demanda.",
    features: baseFeatures,
  },
  {
    code: "TIER_2",
    name: "Tier 2",
    description: "Incluye Tier 1, confirmacion del cliente, emision diferida y notas de credito.",
    features: tier2Features,
  },
  {
    code: "TIER_3",
    name: "Tier 3",
    description: "Incluye Tier 2, facturacion manual e integracion opcional con Google Drive y Sheets.",
    features: tier3Features,
  },
  {
    code: "TIER_4",
    name: "Tier 4",
    description: "Incluye Tier 3 y generacion asistida por OCR desde documentos.",
    features: tier4Features,
  },
].map((plan, index) => {
  const tier = index + 1;
  const allowedModes = ["realtime", "scheduled"];
  if (plan.features.clientApproval) allowedModes.push("confirmation");

  const policy = buildPlanPolicy({
    tier,
    entitlements: plan.features,
    limits: {
      monthlyInvoices: null,
      tenantUsers: null,
      manualInvoicesMonthly: null,
      ocrDocumentsMonthly: null,
    },
    processing: {
      allowedModes,
      defaultMode: "realtime",
      minRealtimeIntervalMs: null,
      maxRunsPerDay: null,
    },
  });

  return {
    ...plan,
    price: null,
    currency: "ARS",
    billingCycle: "monthly",
    status: "ACTIVE",
    featuresJson: JSON.stringify(policy, null, 2),
  };
});
