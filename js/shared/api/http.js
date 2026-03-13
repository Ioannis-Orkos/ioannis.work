import { getAuthToken } from "./token-store.js";

export async function parseJsonSafe(response) {
  if (!response || typeof response.json !== "function") return {};

  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getNormalizedErrorMessage(data, status) {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  }

  if (status === 401) return "Unauthorized request.";
  if (status === 403) return "Forbidden request.";
  if (status >= 500) return "Server error.";
  return "Request failed.";
}

function normalizeApiResult(response, data) {
  return {
    ok: Boolean(response?.ok),
    status: Number(response?.status || 0),
    response,
    data,
    error: response?.ok ? "" : getNormalizedErrorMessage(data, Number(response?.status || 0)),
  };
}

export async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
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

  return fetch(String(url || ""), requestOptions);
}

export async function requestJson(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const data = await parseJsonSafe(response);
  return normalizeApiResult(response, data);
}

