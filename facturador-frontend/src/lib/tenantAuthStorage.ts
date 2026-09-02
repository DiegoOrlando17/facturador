const TENANT_AUTH_STORAGE_KEY = "facturador.tenant.auth";

export type StoredTenantAuth = {
  token: string;
  remember: boolean;
};

function clearInternal() {
  window.localStorage.removeItem(TENANT_AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(TENANT_AUTH_STORAGE_KEY);
}

export function readStoredTenantAuth() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue =
    window.localStorage.getItem(TENANT_AUTH_STORAGE_KEY)
    ?? window.sessionStorage.getItem(TENANT_AUTH_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredTenantAuth;
  } catch {
    clearInternal();
    return null;
  }
}

export function writeStoredTenantAuth(value: StoredTenantAuth) {
  clearInternal();
  const storage = value.remember ? window.localStorage : window.sessionStorage;
  storage.setItem(TENANT_AUTH_STORAGE_KEY, JSON.stringify(value));
}

export function clearStoredTenantAuth() {
  if (typeof window !== "undefined") {
    clearInternal();
  }
}
