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
    name: "Esencial",
    description: "Facturacion automatica o programada desde Mercado Pago POS, portal cliente y PDF bajo demanda.",
    features: baseFeatures,
  },
  {
    code: "TIER_2",
    name: "Control",
    description: "Incluye Esencial, confirmacion del cliente, emision diferida y notas de credito.",
    features: tier2Features,
  },
  {
    code: "TIER_3",
    name: "Profesional",
    description: "Incluye Control, facturacion manual e integracion opcional con Google Drive y Sheets.",
    features: tier3Features,
  },
  {
    code: "TIER_4",
    name: "Inteligente",
    description: "Incluye Profesional y generacion asistida por OCR desde documentos.",
    features: tier4Features,
  },
].map((plan, index) => {
  const tier = index + 1;
  const allowedModes = ["realtime", "scheduled"];

  const policy = buildPlanPolicy({
    tier,
    entitlements: plan.features,
    limits: {
      monthlyInvoices: null,
      tenantUsers: null,
      manualInvoicesMonthly: null,
      ocrDocumentsMonthly: tier === 4 ? 500 : null,
    },
    processing: {
      allowedModes,
      defaultMode: "realtime",
      minRealtimeIntervalMs: 15000,
      maxRunsPerDay: null,
    },
  });

  return {
    ...plan,
    price: [50, 75, 100, 125][index],
    currency: "USD",
    billingCycle: "monthly",
    status: "ACTIVE",
    featuresJson: JSON.stringify(policy, null, 2),
  };
});
