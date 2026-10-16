import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, getApiErrorMessage, isUnauthorizedError, subscribeToUnauthorized } from "@/lib/api";
import {
  clearStoredTenantAuth,
  readStoredTenantAuth,
  writeStoredTenantAuth,
} from "@/lib/tenantAuthStorage";

export type TenantPortalUser = {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  status: string;
  tenant?: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
};

type LoginInput = {
  tenantSlug: string;
  email: string;
  password: string;
  remember: boolean;
};

export const TENANT_SESSION_EXPIRED_NOTICE = "Tu sesión venció. Ingresá de nuevo.";

type TenantAuthContextValue = {
  isBootstrapping: boolean;
  token: string | null;
  user: TenantPortalUser | null;
  /**
   * Aviso para mostrar en el login del portal cuando la sesión se cerró sola
   * (token vencido o revocado). Se limpia con `clearSessionNotice` o al ingresar.
   */
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  /** Cierra la sesión local. Con `notice` deja el aviso para el login. */
  invalidateSession: (notice?: string | null) => void;
};

const TenantAuthContext = createContext<TenantAuthContextValue | null>(null);

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<TenantPortalUser | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const invalidateSession = useCallback((notice: string | null = null) => {
    clearStoredTenantAuth();
    setToken(null);
    setUser(null);
    if (notice) setSessionNotice(notice);
  }, []);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  // Único punto que maneja los 401 del portal: cualquier request del canal
  // "tenant" que vuelva con 401 cierra la sesión del cliente (nunca la del admin).
  useEffect(() => subscribeToUnauthorized(() => {
    invalidateSession(TENANT_SESSION_EXPIRED_NOTICE);
  }, "tenant"), [invalidateSession]);

  useEffect(() => {
    const storedAuth = readStoredTenantAuth();
    if (!storedAuth?.token) {
      setIsBootstrapping(false);
      return;
    }

    apiRequest<TenantPortalUser>("/portal/me", {
      token: storedAuth.token,
      skipAuthHandling: true,
    })
      .then((tenantUser) => {
        setToken(storedAuth.token);
        setUser(tenantUser);
      })
      .catch((error) => {
        clearStoredTenantAuth();
        if (isUnauthorizedError(error)) setSessionNotice(TENANT_SESSION_EXPIRED_NOTICE);
      })
      .finally(() => setIsBootstrapping(false));
  }, []);

  const value = useMemo<TenantAuthContextValue>(() => ({
    isBootstrapping,
    token,
    user,
    sessionNotice,
    clearSessionNotice,
    async login({ tenantSlug, email, password, remember }) {
      if (!tenantSlug.trim() || !email.trim() || !password) {
        return { ok: false, message: "Completá empresa, email y contraseña." };
      }

      try {
        const response = await apiRequest<{ token: string; tenantUser: TenantPortalUser }>(
          "/portal/auth/login",
          {
            method: "POST",
            body: {
              tenantSlug: tenantSlug.trim().toLowerCase(),
              email: email.trim().toLowerCase(),
              password,
            },
            skipAuthHandling: true,
          },
        );

        writeStoredTenantAuth({ token: response.token, remember });
        setToken(response.token);
        setUser(response.tenantUser);
        setSessionNotice(null);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: getApiErrorMessage(error, "No pudimos iniciar sesión en el portal."),
        };
      }
    },
    logout() {
      if (token) {
        void apiRequest("/portal/auth/logout", {
          method: "POST",
          token,
          skipAuthHandling: true,
        }).catch(() => null);
      }
      clearStoredTenantAuth();
      setToken(null);
      setUser(null);
      setSessionNotice(null);
    },
    invalidateSession,
  }), [clearSessionNotice, invalidateSession, isBootstrapping, sessionNotice, token, user]);

  return <TenantAuthContext.Provider value={value}>{children}</TenantAuthContext.Provider>;
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error("useTenantAuth debe usarse dentro de TenantAuthProvider");
  }
  return context;
}
