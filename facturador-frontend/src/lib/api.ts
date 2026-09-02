const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const unauthorizedListeners = new Set<() => void>();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message = "No se pudo conectar con la API.") {
    super(message);
    this.name = "NetworkError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  skipAuthHandling?: boolean;
};

type BlobRequestOptions = {
  token?: string | null;
  skipAuthHandling?: boolean;
};

export function subscribeToUnauthorized(handler: () => void) {
  unauthorizedListeners.add(handler);

  return () => {
    unauthorizedListeners.delete(handler);
  };
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener());
}

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export function getApiErrorMessage(error: unknown, fallback = "Ocurrio un error al comunicarse con la API.") {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "Tu usuario no tiene permisos para realizar esta accion.";
    }

    return error.message;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 204) {
    return null as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : "Ocurrio un error al comunicarse con la API.";

    if (response.status === 401 && options.token && !options.skipAuthHandling) {
      notifyUnauthorized();
    }

    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function apiBlobRequest(path: string, options: BlobRequestOptions = {}) {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
    });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = payload?.error ?? "Ocurrio un error al comunicarse con la API.";

    if (response.status === 401 && options.token && !options.skipAuthHandling) {
      notifyUnauthorized();
    }

    throw new ApiError(message, response.status);
  }

  return response.blob();
}
