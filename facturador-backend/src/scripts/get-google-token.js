import { config } from "../config/index.js";

function requireConfig(value, name) {
  if (!String(value || "").trim()) {
    throw new Error(`${name} es obligatorio para generar un token Google`);
  }
}

async function main() {
  requireConfig(config.GOOGLE.CLIENT_ID, "GOOGLE_CLIENT_ID");
  requireConfig(config.GOOGLE.CLIENT_SECRET, "GOOGLE_CLIENT_SECRET");
  requireConfig(config.GOOGLE.TOKEN, "GOOGLE_TOKEN_PATH");

  if (process.argv.includes("--check")) {
    console.log("Configuracion Google OAuth valida. No se inicio autorizacion ni se modifico el token.");
    return;
  }

  const { getNewToken } = await import("../services/google-auth.js");
  const result = await getNewToken();

  if (!result.hasRefreshToken) {
    console.warn("Google no devolvio refresh_token. Revoca el acceso previo y repite el comando.");
  }
}

main().catch((error) => {
  console.error(`No se pudo generar el token Google: ${error.message}`);
  process.exitCode = 1;
});
