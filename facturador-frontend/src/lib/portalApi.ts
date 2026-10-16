import { apiBlobRequest, apiFileRequest, apiRequest } from "@/lib/api";

type PortalRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Requests del portal cliente. Siempre usan el token del tenant y el canal de
 * sesión "tenant": un 401 lo maneja TenantAuthContext en un único lugar
 * (cierra la sesión del cliente y deja el aviso "Tu sesión venció").
 */
export function portalRequest<T>(token: string | null, path: string, options: PortalRequestOptions = {}) {
  return apiRequest<T>(path, { ...options, token, authScope: "tenant" });
}

export function portalBlobRequest(token: string | null, path: string, options: { signal?: AbortSignal } = {}) {
  return apiBlobRequest(path, { ...options, token, authScope: "tenant" });
}

export function portalFileRequest(token: string | null, path: string, options: { signal?: AbortSignal } = {}) {
  return apiFileRequest(path, { ...options, token, authScope: "tenant" });
}

/** Descarga un blob como archivo. El link se agrega al DOM y la URL se revoca después. */
export function saveBlobAsFile(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}
