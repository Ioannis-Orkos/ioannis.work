import { AUTH_API_SELECTED_BASE_URL_KEY } from "../config.js";

const AUTH_TOKEN_KEYS = Object.freeze([
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

export function getAuthToken() {
  for (const key of AUTH_TOKEN_KEYS) {
    const value = readStorageValue(localStorage, key) || readStorageValue(sessionStorage, key);
    if (value) return value;
  }

  return "";
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export function saveAuthToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return false;

  let wroteLocal = false;
  let wroteSession = false;

  AUTH_TOKEN_KEYS.forEach((key) => {
    wroteLocal = writeStorageValue(localStorage, key, normalizedToken) || wroteLocal;
    wroteSession = writeStorageValue(sessionStorage, key, normalizedToken) || wroteSession;
  });

  return wroteLocal || wroteSession;
}

export function clearAuthTokens() {
  AUTH_TOKEN_KEYS.forEach((key) => {
    removeStorageValue(localStorage, key);
    removeStorageValue(sessionStorage, key);
  });

  removeStorageValue(localStorage, AUTH_API_SELECTED_BASE_URL_KEY);
  removeStorageValue(sessionStorage, AUTH_API_SELECTED_BASE_URL_KEY);
}

