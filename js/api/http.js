import {
  AUTH_API_BASE_URL,
  AUTH_API_FALLBACK_BASE_URL,
  AUTH_API_LOCAL_BASE_URL,
  AUTH_API_PRIMARY_BASE_URL,
  AUTH_API_SELECTED_BASE_URL_KEY,
  IS_LOCAL_FRONTEND,
} from "../shared/config.js";
import { getStoredAuthToken } from "../features/auth/session-store.js";

const API_RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

const KNOWN_API_BASE_URLS = Object.freeze(
  IS_LOCAL_FRONTEND
    ? [AUTH_API_LOCAL_BASE_URL]
    : [AUTH_API_PRIMARY_BASE_URL, AUTH_API_FALLBACK_BASE_URL]
);

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

function isKnownApiBaseUrl(value) {
  return KNOWN_API_BASE_URLS.includes(String(value || "").trim());
}

function getSelectedApiBaseUrl() {
  if (IS_LOCAL_FRONTEND) {
    return AUTH_API_LOCAL_BASE_URL;
  }

  const storedValue =
    readStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY) ||
    readStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY);

  return isKnownApiBaseUrl(storedValue) ? storedValue : AUTH_API_BASE_URL;
}

function saveSelectedApiBaseUrl(baseUrl) {
  if (IS_LOCAL_FRONTEND) return false;

  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!isKnownApiBaseUrl(normalizedBaseUrl)) return false;

  const wroteLocal = writeStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY, normalizedBaseUrl);
  const wroteSession = writeStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY, normalizedBaseUrl);
  return wroteLocal || wroteSession;
}

function getApiBaseUrlFromUrl(url) {
  const normalizedUrl = String(url || "");
  return KNOWN_API_BASE_URLS.find((baseUrl) => normalizedUrl.startsWith(baseUrl)) || "";
}

function isApiUrl(url) {
  return Boolean(getApiBaseUrlFromUrl(url));
}

function replaceApiBaseUrl(url, nextBaseUrl) {
  const currentBaseUrl = getApiBaseUrlFromUrl(url);
  if (!currentBaseUrl || !isKnownApiBaseUrl(nextBaseUrl)) return String(url || "");
  return String(url || "").replace(currentBaseUrl, nextBaseUrl);
}

function applySelectedApiBaseUrl(url) {
  const normalizedUrl = String(url || "");
  if (!isApiUrl(normalizedUrl)) return normalizedUrl;
  return replaceApiBaseUrl(normalizedUrl, getSelectedApiBaseUrl());
}

function getAlternativeApiUrl(url) {
  if (IS_LOCAL_FRONTEND) return "";

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

function persistApiBaseUrlFromUrl(url) {
  const baseUrl = getApiBaseUrlFromUrl(url);
  if (!baseUrl) return false;
  return saveSelectedApiBaseUrl(baseUrl);
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

export async function requestJson(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const body = await parseJsonSafe(response);
  return {
    response,
    body,
  };
}
