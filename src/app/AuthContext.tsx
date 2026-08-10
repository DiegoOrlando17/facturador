import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, getApiErrorMessage, subscribeToUnauthorized } from "@/lib/api";
import { hasAdminPermission, type AdminPermission } from "@/lib/adminPermissions";
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from "@/lib/authStorage";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoginInput = {
  email: string;
  password: string;
  remember: boolean;
};

type LoginResponse = {
  token: string;
  adminUser: AuthUser;
};

type AuthContextValue = {
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  authNotice: string | null;
  can: (permission: AdminPermission) => boolean;
  login: (input: LoginInput) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  clearAuthNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    return subscribeToUnauthorized(() => {
      if (isLoggingOutRef.current) {
        return;
      }

      clearStoredAuth();
      setToken(null);
      setUser(null);
      setAuthNotice("Tu sesion vencio. Ingresa nuevamente para continuar.");
    });
  }, []);

  async function bootstrapSession() {
    const storedAuth = readStoredAuth();

    if (!storedAuth?.token) {
      setIsBootstrapping(false);
      return;
    }

    try {
      const adminUser = await apiRequest<AuthUser>("/admin/me", {
        token: storedAuth.token,
      });

      setToken(storedAuth.token);
      setUser(adminUser);
      setAuthNotice(null);
    } catch {
      clearStoredAuth();
      setToken(null);
      setUser(null);
      setAuthNotice("Tu sesion vencio. Ingresa nuevamente para continuar.");
    } finally {
      setIsBootstrapping(false);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isBootstrapping,
      isAuthenticated: user !== null,
      token,
      user,
      authNotice,
      can(permission) {
        return hasAdminPermission(user?.role, permission);
      },
      async login({ email, password, remember }) {
        if (!email || !password) {
          return {
            ok: false,
            message: "Completa email y contrasena.",
          };
        }

        try {
          const response = await apiRequest<LoginResponse>("/admin/auth/login", {
            method: "POST",
            body: {
              email: email.trim().toLowerCase(),
              password,
            },
          });

          setToken(response.token);
          setUser(response.adminUser);
          setAuthNotice(null);
          writeStoredAuth({
            token: response.token,
            remember,
          });

          return { ok: true };
        } catch (error) {
          return {
            ok: false,
            message: getApiErrorMessage(error, "No se pudo iniciar sesion."),
          };
        }
      },
      logout() {
        isLoggingOutRef.current = true;

        if (token) {
          void apiRequest("/admin/auth/logout", {
            method: "POST",
            token,
            skipAuthHandling: true,
          }).catch(() => null);
        }

        clearStoredAuth();
        setToken(null);
        setUser(null);
        setAuthNotice("Cerraste sesion correctamente.");
        isLoggingOutRef.current = false;
      },
      async refreshSession() {
        if (!token) {
          return;
        }

        try {
          const adminUser = await apiRequest<AuthUser>("/admin/me", { token });
          setUser(adminUser);
        } catch {
          return;
        }
      },
      clearAuthNotice() {
        setAuthNotice(null);
      },
    }),
    [authNotice, isBootstrapping, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
