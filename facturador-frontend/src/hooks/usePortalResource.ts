import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTenantAuth } from "@/app/TenantAuthContext";
import { getApiErrorMessage, isAbortError, isUnauthorizedError } from "@/lib/api";
import { portalBlobRequest, portalFileRequest, portalRequest } from "@/lib/portalApi";

export type PortalApi = {
  request: <T>(path: string, options?: Parameters<typeof portalRequest>[2]) => Promise<T>;
  requestBlob: (path: string, options?: { signal?: AbortSignal }) => Promise<Blob>;
  requestFile: (path: string, options?: { signal?: AbortSignal }) => Promise<{ blob: Blob; headers: Headers }>;
};

/** Cliente del portal ligado al token del tenant logueado. */
export function usePortalApi(): PortalApi {
  const { token } = useTenantAuth();
  return useMemo<PortalApi>(() => ({
    request: <T,>(path: string, options?: Parameters<typeof portalRequest>[2]) => portalRequest<T>(token, path, options),
    requestBlob: (path: string, options?: { signal?: AbortSignal }) => portalBlobRequest(token, path, options),
    requestFile: (path: string, options?: { signal?: AbortSignal }) => portalFileRequest(token, path, options),
  }), [token]);
}

/**
 * Mensaje de error para mostrar en el portal. Un 401 ya lo resuelve
 * TenantAuthContext (redirige al login con aviso), así que no se muestra nada.
 */
export function getPortalErrorMessage(error: unknown, fallback: string) {
  if (isUnauthorizedError(error) || isAbortError(error)) return "";
  return getApiErrorMessage(error, fallback);
}

type UsePortalQueryOptions = {
  fallbackErrorMessage?: string;
};

export type UsePortalQueryResult<T> = {
  data: T | null;
  setData: Dispatch<SetStateAction<T | null>>;
  /** Primera carga (todavía no hay datos). */
  isLoading: boolean;
  /** Recarga con datos ya visibles: no hace falta desmontar la página. */
  isRefreshing: boolean;
  errorMessage: string;
  lastLoadedAt: Date | null;
  reload: () => Promise<void>;
};

/**
 * Carga datos del portal. `key` identifica la consulta: cuando cambia se vuelve
 * a cargar y la request anterior se aborta (nunca pisa datos nuevos con viejos).
 * Con `key` en null no se carga nada.
 */
export function usePortalQuery<T>(
  key: string | null,
  loader: (api: PortalApi, signal: AbortSignal) => Promise<T>,
  options: UsePortalQueryOptions = {},
): UsePortalQueryResult<T> {
  const api = usePortalApi();
  const { token } = useTenantAuth();
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);
  const fallback = options.fallbackErrorMessage ?? "No pudimos cargar la información.";

  const [data, setDataState] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(key));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const setData = useCallback<Dispatch<SetStateAction<T | null>>>((value) => {
    setDataState((current) => {
      const next = typeof value === "function" ? (value as (previous: T | null) => T | null)(current) : value;
      hasDataRef.current = next !== null;
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    if (!key || !token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    if (hasDataRef.current) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await loaderRef.current(api, controller.signal);
      if (controller.signal.aborted) return;
      hasDataRef.current = true;
      setDataState(result);
      setLastLoadedAt(new Date());
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setErrorMessage(getPortalErrorMessage(error, fallback));
    } finally {
      if (controllerRef.current === controller) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [api, fallback, key, token]);

  useEffect(() => {
    void reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return { data, setData, isLoading, isRefreshing, errorMessage, lastLoadedAt, reload };
}

/** Atajo para un único GET del portal. */
export function usePortalResource<T>(path: string | null, options: UsePortalQueryOptions = {}) {
  return usePortalQuery<T>(path, (api, signal) => api.request<T>(path as string, { signal }), options);
}
