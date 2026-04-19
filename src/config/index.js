import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 5000;
const ngrokUrl = process.env.NGROK_URL;
const googleRedirectBase = process.env.GOOGLE_REDIRECT_BASE_URL || ngrokUrl || `http://localhost:${port}`;

export const config = {
  PORT: port,
  CUIT: Number(process.env.CUIT),

  MP: {
    ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
    PUBLIC_KEY: process.env.MP_PUBLIC_KEY,
    API_URL: process.env.MP_API_URL,
    POLLING_INTERVAL: process.env.MP_POLLING_INTERVAL,
    POS_ID: process.env.MP_POS_ID
  },
  
  PAYWAY: {
    API_URL: process.env.PAYWAY_API_URL,
    API_TOKEN: process.env.PAYWAY_API_TOKEN,
    POLLING_INTERVAL: process.env.PAYWAY_POLLING_INTERVAL
  },
  
  AFIP: {
    TRA_B64: process.env.AFIP_TRA_B64,
    TRACMS_B64: process.env.AFIP_TRACMS_B64,
    TA_B64: process.env.AFIP_TA_B64,
    CERT_B64: process.env.AFIP_CERT_B64,
    KEY_B64: process.env.AFIP_KEY_B64,
    TRA: process.env.AFIP_TRA_PATH,
    TRACMS: process.env.AFIP_TRACMS_PATH,
    TA: process.env.AFIP_TA_PATH,
    CERT: process.env.AFIP_CERT_PATH,
    KEY: process.env.AFIP_KEY_PATH,
    WSAA_URL: process.env.AFIP_WSAA_URL,
    WSFE_URL: process.env.AFIP_WSFE_URL,
    PRODUCTION: process.env.AFIP_PRODUCTION || "false",
    PTO_VTA: Number(process.env.AFIP_PTO_VTA || 1),
    CBTE_TIPO: Number(process.env.AFIP_CBTE_TIPO || 6),
    ALIC_IVA: Number(process.env.AFIP_ALIC_IVA || 21),
  },

  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID,
    SHEETS_ID: process.env.SHEET_ID,
    SHEET_NAME: process.env.SHEET_NAME || "Hoja1",
    TOKEN_B64: process.env.GOOGLE_TOKEN_B64,
    TOKEN: process.env.GOOGLE_TOKEN_PATH,
    REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `${googleRedirectBase}/google/oauth/callback`,
    STATE_SECRET: process.env.GOOGLE_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "google-state-secret",
  },

  NGROK_URL: ngrokUrl,

  REDIS_URL: process.env.REDIS_URL,

  DATABASE_URL: process.env.DATABASE_URL,

  SECRETS: {
    MASTER_KEY: process.env.APP_MASTER_KEY || process.env.SECRETS_MASTER_KEY || "dev-master-key",
  },

  AUTH: {
    ADMIN_TOKEN_SECRET:
      process.env.ADMIN_TOKEN_SECRET
      || process.env.APP_MASTER_KEY
      || process.env.SECRETS_MASTER_KEY
      || "dev-admin-token-secret",
    ADMIN_TOKEN_TTL_HOURS: Number(process.env.ADMIN_TOKEN_TTL_HOURS || 12),
    TENANT_TOKEN_SECRET:
      process.env.TENANT_TOKEN_SECRET
      || process.env.APP_MASTER_KEY
      || process.env.SECRETS_MASTER_KEY
      || "dev-tenant-token-secret",
    TENANT_TOKEN_TTL_HOURS: Number(process.env.TENANT_TOKEN_TTL_HOURS || 12),
  },

  ENABLE_WORKERS: process.env.ENABLE_WORKERS,

  DEFAULT_TENANT_SLUG: process.env.DEFAULT_TENANT_SLUG || "demo",

};
