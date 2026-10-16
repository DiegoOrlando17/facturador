const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const GENERIC_API_ERROR = "Ocurrió un error al comunicarse con el servidor.";
const GENERIC_FORBIDDEN_ERROR = "Tu usuario no tiene permisos para realizar esta acción.";

/**
 * Canal de sesión de una request. Un 401 solo notifica a los listeners de su
 * propio canal: un token vencido del portal cliente nunca cierra la sesión admin.
 */
export type AuthScope = "admin" | "tenant";

const unauthorizedListeners: Record<AuthScope, Set<() => void>> = {
  admin: new Set(),
  tenant: new Set(),
};

export class ApiError extends Error {
  status: number;
  /** true cuando el mensaje vino del backend (no es el texto genérico del cliente). */
  hasServerMessage: boolean;
  /** Código de error del backend ("RESET_EXPIRED"), si lo mandó. */
  code?: string;

  constructor(message: string, status: number, hasServerMessage = true, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.hasServerMessage = hasServerMessage;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export class NetworkError extends Error {
  constructor(message = "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.") {
    super(message);
    this.name = "NetworkError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  skipAuthHandling?: boolean;
  authScope?: AuthScope;
  signal?: AbortSignal;
};

type BlobRequestOptions = {
  token?: string | null;
  skipAuthHandling?: boolean;
  authScope?: AuthScope;
  signal?: AbortSignal;
};

/** Suscribe un handler a los 401 de un canal. Por defecto, el canal admin. */
export function subscribeToUnauthorized(handler: () => void, scope: AuthScope = "admin") {
  unauthorizedListeners[scope].add(handler);

  return () => {
    unauthorizedListeners[scope].delete(handler);
  };
}

function notifyUnauthorized(scope: AuthScope) {
  unauthorizedListeners[scope].forEach((listener) => listener());
}

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function getApiErrorMessage(error: unknown, fallback = GENERIC_API_ERROR) {
  if (error instanceof ApiError) {
    // Un 403 suele traer el motivo real ("Tu plan no incluye…"): solo usamos el
    // texto genérico de permisos si el backend no mandó ninguno.
    if (error.status === 403 && !error.hasServerMessage) {
      return GENERIC_FORBIDDEN_ERROR;
    }

    return error.hasServerMessage ? error.message : fallback;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  return fallback;
}

async function performFetch(path: string, init: RequestInit) {
  try {
    return await fetch(buildApiUrl(path), init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new NetworkError();
  }
}

function buildApiError(payload: unknown, response: Response, options: { token?: string | null; skipAuthHandling?: boolean; authScope?: AuthScope }) {
  const serverMessage =
    payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string"
      ? String((payload as { error: string }).error).trim()
      : "";

  if (response.status === 401 && options.token && !options.skipAuthHandling) {
    notifyUnauthorized(options.authScope ?? "admin");
  }

  const code =
    payload && typeof payload === "object" && typeof (payload as { code?: unknown }).code === "string"
      ? (payload as { code: string }).code
      : undefined;

  return new ApiError(serverMessage || GENERIC_API_ERROR, response.status, Boolean(serverMessage), code);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await performFetch(path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    throw buildApiError(payload, response, options);
  }

  return payload as T;
}

export async function apiBlobRequest(path: string, options: BlobRequestOptions = {}) {
  const response = await performFetch(path, {
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw buildApiError(payload, response, options);
  }

  return response.blob();
}
