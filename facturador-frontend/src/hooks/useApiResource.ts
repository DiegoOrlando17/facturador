import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/AuthContext";
import { apiRequest, getApiErrorMessage, isAbortError } from "@/lib/api";

type UseApiResourceOptions = {
  enabled?: boolean;
  fallbackErrorMessage?: string;
};

type UseApiResourceResult<T> = {
  data: T | null;
  /** Primera carga: todavía no hay datos para mostrar. */
  isLoading: boolean;
  /** Recarga con datos ya visibles (guardado, filtros, paginación): no desmontar la página. */
  isRefreshing: boolean;
  errorMessage: string;
  lastLoadedAt: Date | null;
  reload: () => Promise<void>;
};

/**
 * GET del panel admin con el token de la sesión.
 *
 * - `isLoading` solo es true mientras no hay datos; las recargas usan `isRefreshing`
 *   y conservan los datos anteriores (sin parpadeo).
 * - Cada recarga aborta la anterior, así una respuesta vieja nunca pisa una nueva
 *   (por ejemplo al cambiar rápido de página o de filtro).
 * - Si una recarga falla, los datos anteriores se mantienen y se informa `errorMessage`.
 */
export function useApiResource<T>(
  path: string,
  options: UseApiResourceOptions = {},
): UseApiResourceResult<T> {
  const { token } = useAuth();
  const enabled = options.enabled ?? true;
  const fallback = options.fallbackErrorMessage ?? "No pudimos cargar la información.";
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    if (!token || !enabled) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    if (hasDataRef.current) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await apiRequest<T>(path, { token, signal: controller.signal });
      if (controller.signal.aborted) return;
      hasDataRef.current = true;
      setData(response);
      setLastLoadedAt(new Date());
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setErrorMessage(getApiErrorMessage(error, fallback));
    } finally {
      if (controllerRef.current === controller) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, fallback, path, token]);

  useEffect(() => {
    void reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return {
    data,
    isLoading,
    isRefreshing,
    errorMessage,
    lastLoadedAt,
    reload,
  };
}
