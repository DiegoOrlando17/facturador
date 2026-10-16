import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 5000;
const ngrokUrl = process.env.NGROK_URL;
const googleRedirectBase = process.env.GOOGLE_REDIRECT_BASE_URL || ngrokUrl || `http://localhost:${port}`;

export const config = {
  PORT: port,

  // Solo configuracion de plataforma. Las credenciales de cada cliente (token/POS de
  // Mercado Pago, CUIT y certificado/clave ARCA, Google) viven en TenantIntegration (DB)
  // y nunca se leen del .env.
  MP: {
    API_URL: process.env.MP_API_URL || "https://api.mercadopago.com",
  },

  BILLING: {
    MP_ACCESS_TOKEN: process.env.MP_BILLING_ACCESS_TOKEN,
    MP_API_URL: process.env.MP_BILLING_API_URL || "https://api.mercadopago.com",
    BACK_URL: process.env.BILLING_BACK_URL || "http://localhost:5173/portal-cliente",
    BNA_URL: process.env.BNA_EXCHANGE_RATE_URL || "https://www.bna.com.ar/Personas",
  },

  EMAIL: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM: process.env.EMAIL_FROM || "Facturador <onboarding@resend.dev>",
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || "http://localhost:5173",
  },

  AFIP: {
    // URLs por defecto de la plataforma. Cada cliente puede elegir ambiente (ENV)
    // o URLs propias (WSAA_URL/WSFE_URL) en su integracion AFIP, que tienen prioridad.
    WSAA_URL: process.env.AFIP_WSAA_URL,
    WSFE_URL: process.env.AFIP_WSFE_URL,
    PRODUCTION: process.env.AFIP_PRODUCTION || "false",
  },

  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `${googleRedirectBase}/google/oauth/callback`,
    REDIRECT_URI_EXPLICIT: Boolean(process.env.GOOGLE_REDIRECT_URI),
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
};
