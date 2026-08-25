const AUTH_STORAGE_KEY = "facturador.admin.auth";

export type StoredAuth = {
  token: string;
  remember: boolean;
};

function clearInternal() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function readStoredAuth() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue =
    window.localStorage.getItem(AUTH_STORAGE_KEY)
    ?? window.sessionStorage.getItem(AUTH_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredAuth;
  } catch {
    clearInternal();
    return null;
  }
}

export function writeStoredAuth(value: StoredAuth) {
  clearInternal();

  const storage = value.remember ? window.localStorage : window.sessionStorage;
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") {
    return;
  }

  clearInternal();
}
