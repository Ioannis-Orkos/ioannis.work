export const AUTH_TOKEN_KEYS = Object.freeze([
  "auth-token",
  "access-token",
  "site-auth-token",
]);

function readStorageValue(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function getStoredAuthToken() {
  for (const key of AUTH_TOKEN_KEYS) {
    const value = readStorageValue(localStorage, key) || readStorageValue(sessionStorage, key);
    if (value) return value;
  }
  return "";
}

export function hasStoredAuthToken() {
  return Boolean(getStoredAuthToken());
}

export function setAuthUser(user) {
  window.__AUTH_USER = user || null;
  return window.__AUTH_USER;
}

export function getAuthUser() {
  return window.__AUTH_USER || null;
}

export function setAuthorizedFlag(isAuthorized) {
  window.__IS_AUTHORIZED_USER = Boolean(isAuthorized);
  return window.__IS_AUTHORIZED_USER;
}

export function isAuthorizedUser() {
  if (window.__IS_AUTHORIZED_USER === true) return true;
  return hasStoredAuthToken();
}

export function getAuthRole() {
  return String(getAuthUser()?.role || "").toLowerCase();
}

export function isAdminUser() {
  return getAuthRole() === "admin";
}

export function saveAuthToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return false;

  AUTH_TOKEN_KEYS.forEach((key) => {
    try {
      localStorage.setItem(key, normalizedToken);
    } catch {
      // Ignore storage write failures and rely on cookie session fallback.
    }
  });
  setAuthorizedFlag(true);
  return true;
}

export function clearStoredAuthTokens() {
  AUTH_TOKEN_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }

    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
  });
}

export async function parseJsonSafe(response) {
  if (!response || typeof response.json !== "function") return {};
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function authenticatedFetch(url, options = {}) {
  const token = getStoredAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}

export async function ensureAuthorizedSession(meEndpoint) {
  if (!meEndpoint) return false;
  if (isAuthorizedUser() && getAuthUser()) return true;
  if (!hasStoredAuthToken() && !getAuthUser()) {
    setAuthorizedFlag(false);
    return false;
  }

  try {
    const response = await authenticatedFetch(meEndpoint, { method: "GET" });
    if (!response.ok) {
      setAuthorizedFlag(false);
      return false;
    }

    const body = await parseJsonSafe(response);
    setAuthorizedFlag(true);
    setAuthUser(body?.user || getAuthUser() || null);
    return true;
  } catch {
    setAuthorizedFlag(false);
    return false;
  }
}
