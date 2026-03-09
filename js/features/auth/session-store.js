import { AUTH_API_SELECTED_BASE_URL_KEY } from "../../shared/config.js";

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

function removeStorageValue(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
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

  return true;
}

export function clearStoredAuthTokens() {
  AUTH_TOKEN_KEYS.forEach((key) => {
    removeStorageValue(localStorage, key);
    removeStorageValue(sessionStorage, key);
  });

  removeStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY);
  removeStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY);
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
  return window.__IS_AUTHORIZED_USER === true && Boolean(getAuthUser()?.id);
}

export function getAuthRole() {
  return String(getAuthUser()?.role || "").toLowerCase();
}

export function isAdminUser() {
  return getAuthRole() === "admin";
}
