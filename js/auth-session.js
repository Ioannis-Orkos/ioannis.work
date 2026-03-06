import {
  AUTH_API_FALLBACK_BASE_URL,
  AUTH_API_PRIMARY_BASE_URL,
} from "./config.js";

export const AUTH_TOKEN_KEYS = Object.freeze([
  "auth-token",
  "access-token",
  "site-auth-token",
]);

const API_RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const AUTH_API_SELECTED_BASE_URL_KEY = "auth-api-selected-base-url";
const KNOWN_API_BASE_URLS = Object.freeze([
  AUTH_API_PRIMARY_BASE_URL,
  AUTH_API_FALLBACK_BASE_URL,
]);

function readStorageValue(storage, key) {
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorageValue(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorageValue(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function isKnownApiBaseUrl(value) {
  return KNOWN_API_BASE_URLS.includes(String(value || "").trim());
}

function getSelectedApiBaseUrl() {
  const storedValue =
    readStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY) ||
    readStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY);
  return isKnownApiBaseUrl(storedValue) ? storedValue : AUTH_API_PRIMARY_BASE_URL;
}

function saveSelectedApiBaseUrl(baseUrl) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!isKnownApiBaseUrl(normalizedBaseUrl)) return false;
  const wroteLocal = writeStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY, normalizedBaseUrl);
  const wroteSession = writeStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY, normalizedBaseUrl);
  return wroteLocal || wroteSession;
}

function clearSelectedApiBaseUrl() {
  removeStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY);
  removeStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY);
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
  clearSelectedApiBaseUrl();
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

  const requestOptions = {
    credentials: "include",
    ...options,
    headers,
  };

  const originalUrl = String(url || "");
  const preferredUrl = applySelectedApiBaseUrl(originalUrl);
  const fallbackUrl = getAlternativeApiUrl(preferredUrl);

  try {
    const response = await fetch(preferredUrl, requestOptions);
    if (response.ok) {
      persistApiBaseUrlFromUrl(preferredUrl);
      return response;
    }

    if (fallbackUrl && API_RETRYABLE_STATUS_CODES.has(response.status)) {
      const fallbackResponse = await fetch(fallbackUrl, requestOptions);
      if (fallbackResponse.ok) {
        persistApiBaseUrlFromUrl(fallbackUrl);
      }
      return fallbackResponse;
    }

    return response;
  } catch (error) {
    if (!fallbackUrl) {
      throw error;
    }

    const fallbackResponse = await fetch(fallbackUrl, requestOptions);
    if (fallbackResponse.ok) {
      persistApiBaseUrlFromUrl(fallbackUrl);
    }
    return fallbackResponse;
  }
}

function applySelectedApiBaseUrl(url) {
  const normalizedUrl = String(url || "");
  if (!isApiUrl(normalizedUrl)) return normalizedUrl;
  const selectedBaseUrl = getSelectedApiBaseUrl();
  return replaceApiBaseUrl(normalizedUrl, selectedBaseUrl);
}

function getAlternativeApiUrl(url) {
  const normalizedUrl = String(url || "");
  if (!isApiUrl(normalizedUrl)) return "";

  const currentBaseUrl = getApiBaseUrlFromUrl(normalizedUrl);
  if (currentBaseUrl === AUTH_API_PRIMARY_BASE_URL) {
    return replaceApiBaseUrl(normalizedUrl, AUTH_API_FALLBACK_BASE_URL);
  }
  if (currentBaseUrl === AUTH_API_FALLBACK_BASE_URL) {
    return replaceApiBaseUrl(normalizedUrl, AUTH_API_PRIMARY_BASE_URL);
  }
  return "";
}

function replaceApiBaseUrl(url, nextBaseUrl) {
  const currentBaseUrl = getApiBaseUrlFromUrl(url);
  if (!currentBaseUrl || !isKnownApiBaseUrl(nextBaseUrl)) return String(url || "");
  return String(url || "").replace(currentBaseUrl, nextBaseUrl);
}

function getApiBaseUrlFromUrl(url) {
  const normalizedUrl = String(url || "");
  return KNOWN_API_BASE_URLS.find((baseUrl) => normalizedUrl.startsWith(baseUrl)) || "";
}

function isApiUrl(url) {
  return Boolean(getApiBaseUrlFromUrl(url));
}

function persistApiBaseUrlFromUrl(url) {
  const baseUrl = getApiBaseUrlFromUrl(url);
  if (!baseUrl) return false;
  return saveSelectedApiBaseUrl(baseUrl);
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
