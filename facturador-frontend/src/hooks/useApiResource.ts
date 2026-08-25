import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/AuthContext";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type UseApiResourceOptions = {
  enabled?: boolean;
  fallbackErrorMessage?: string;
};

type UseApiResourceResult<T> = {
  data: T | null;
  isLoading: boolean;
  errorMessage: string;
  reload: () => Promise<void>;
};

export function useApiResource<T>(
  path: string,
  options: UseApiResourceOptions = {},
): UseApiResourceResult<T> {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(options.enabled ?? true));
  const [errorMessage, setErrorMessage] = useState("");

  const reload = useCallback(async () => {
    if (!token || options.enabled === false) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await apiRequest<T>(path, { token });
      setData(response);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, options.fallbackErrorMessage ?? "No se pudo cargar la informacion."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [options.enabled, options.fallbackErrorMessage, path, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    data,
    isLoading,
    errorMessage,
    reload,
  };
}
