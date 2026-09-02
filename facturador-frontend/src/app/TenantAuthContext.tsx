import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
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

type TenantAuthContextValue = {
  isBootstrapping: boolean;
  token: string | null;
  user: TenantPortalUser | null;
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  invalidateSession: () => void;
};

const TenantAuthContext = createContext<TenantAuthContextValue | null>(null);

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<TenantPortalUser | null>(null);

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
      .catch(() => clearStoredTenantAuth())
      .finally(() => setIsBootstrapping(false));
  }, []);

  const value = useMemo<TenantAuthContextValue>(() => ({
    isBootstrapping,
    token,
    user,
    async login({ tenantSlug, email, password, remember }) {
      if (!tenantSlug.trim() || !email.trim() || !password) {
        return { ok: false, message: "Completa empresa, email y contrasena." };
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
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: getApiErrorMessage(error, "No se pudo iniciar sesion en el portal."),
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
    },
    invalidateSession() {
      clearStoredTenantAuth();
      setToken(null);
      setUser(null);
    },
  }), [isBootstrapping, token, user]);

  return <TenantAuthContext.Provider value={value}>{children}</TenantAuthContext.Provider>;
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error("useTenantAuth debe usarse dentro de TenantAuthProvider");
  }
  return context;
}
