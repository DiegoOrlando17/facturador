import arcaLogo from "@/assets/integrations/arca.ico";
import driveLogo from "@/assets/integrations/google-drive.ico";
import sheetsLogo from "@/assets/integrations/google-sheets.ico";
import mercadoPagoLogo from "@/assets/integrations/mercado-pago.ico";
import postgresqlLogo from "@/assets/integrations/postgresql.ico";
import railwayLogo from "@/assets/integrations/railway.ico";
import redisLogo from "@/assets/integrations/redis.ico";

export type IntegrationLogoName =
  | "MERCADOPAGO"
  | "ARCA"
  | "AFIP"
  | "DRIVE"
  | "SHEETS"
  | "POSTGRESQL"
  | "RAILWAY"
  | "REDIS"
  | "mp"
  | "arca"
  | "afip"
  | "drive"
  | "postgresql"
  | "railway"
  | "redis"
  | "sheets";

const logos: Record<IntegrationLogoName, { src: string; alt: string; className: string }> = {
  MERCADOPAGO: { src: mercadoPagoLogo, alt: "Mercado Pago", className: "integration-logo--mercadopago" },
  mp: { src: mercadoPagoLogo, alt: "Mercado Pago", className: "integration-logo--mercadopago" },
  ARCA: { src: arcaLogo, alt: "ARCA", className: "integration-logo--arca" },
  AFIP: { src: arcaLogo, alt: "ARCA", className: "integration-logo--arca" },
  arca: { src: arcaLogo, alt: "ARCA", className: "integration-logo--arca" },
  afip: { src: arcaLogo, alt: "ARCA", className: "integration-logo--arca" },
  DRIVE: { src: driveLogo, alt: "Google Drive", className: "integration-logo--drive" },
  drive: { src: driveLogo, alt: "Google Drive", className: "integration-logo--drive" },
  SHEETS: { src: sheetsLogo, alt: "Google Sheets", className: "integration-logo--sheets" },
  sheets: { src: sheetsLogo, alt: "Google Sheets", className: "integration-logo--sheets" },
  POSTGRESQL: { src: postgresqlLogo, alt: "PostgreSQL", className: "integration-logo--postgresql" },
  postgresql: { src: postgresqlLogo, alt: "PostgreSQL", className: "integration-logo--postgresql" },
  RAILWAY: { src: railwayLogo, alt: "Railway", className: "integration-logo--railway" },
  railway: { src: railwayLogo, alt: "Railway", className: "integration-logo--railway" },
  REDIS: { src: redisLogo, alt: "Redis", className: "integration-logo--redis" },
  redis: { src: redisLogo, alt: "Redis", className: "integration-logo--redis" },
};

export function isIntegrationLogoName(value: string): value is IntegrationLogoName {
  return value in logos;
}

export function IntegrationLogo({ name }: { name: IntegrationLogoName }) {
  const logo = logos[name];

  return <img src={logo.src} alt={logo.alt} className={`integration-logo ${logo.className}`} />;
}
