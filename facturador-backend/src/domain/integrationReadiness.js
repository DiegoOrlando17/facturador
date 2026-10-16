// Campos mínimos para considerar que una integración tiene credenciales reales.
// Ajustes operativos (agenda de polling, modalidad de facturación) no cuentan.
const REQUIRED_FIELDS = Object.freeze({
  MERCADOPAGO: ["ACCESS_TOKEN", "POS_ID"],
  AFIP: ["CUIT", "PTO_VTA", "CBTE_TIPO"],
  DRIVE: ["REFRESH_TOKEN", "DRIVE_FOLDER_ID"],
  SHEETS: ["REFRESH_TOKEN", "SHEETS_ID"],
});

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function hasRequiredIntegrationCredentials(provider, config) {
  const fields = REQUIRED_FIELDS[String(provider || "").toUpperCase()];
  if (!fields || !config || typeof config !== "object") return false;
  return fields.every((field) => hasValue(config[field]));
}

/**
 * Estado `enabled` a persistir cuando el portal guarda ajustes no sensibles
 * (agenda o modalidad). Nunca habilita una integración sin credenciales ni
 * reactiva una que un administrador dejó deshabilitada.
 */
export function resolveSettingsOnlyEnabled(provider, { existingEnabled = false, config = {} } = {}) {
  return Boolean(existingEnabled) && hasRequiredIntegrationCredentials(provider, config);
}
