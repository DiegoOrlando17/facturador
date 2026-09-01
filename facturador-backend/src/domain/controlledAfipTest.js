export const CONTROLLED_AFIP_ERROR = "Falla ARCA sintetica controlada";

export function buildControlledAfipError(jobData, payment, afipConfig) {
  if (jobData?.testFault !== "afip_error_once") return null;

  const environment = String(afipConfig?.ENV || "").trim().toLowerCase();
  const urls = [afipConfig?.WSAA_URL, afipConfig?.WSFE_URL].filter(Boolean).map(String);
  const isHomologation = !["prod", "production", "produccion"].includes(environment)
    && urls.length === 2
    && urls.every((url) => /homo|test/i.test(url));

  if (payment?.payment_method_id !== "test_flow" || !isHomologation) {
    throw new Error("La falla ARCA controlada solo admite pagos test_flow con configuracion de homologacion");
  }

  return { error: CONTROLLED_AFIP_ERROR };
}
