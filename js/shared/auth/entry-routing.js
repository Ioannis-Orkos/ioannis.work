export const PUBLIC_ENTRY_PATH = "/";
export const ADMIN_ENTRY_PATH = "/admin/";
export const ADMIN_REDIRECT_INTENT_KEY = "admin-entry-intent";

function normalizePathname(pathname) {
  const normalizedPathname = String(pathname || "/").replace(/\/+$/, "");
  return normalizedPathname || "/";
}

function navigateToEntry(path, { replace = true } = {}) {
  const method = replace ? "replace" : "assign";
  window.location[method](path);
}

function readSessionStorage(key) {
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function removeSessionStorage(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures in static entry routing helpers.
  }
}

export function markAdminRedirectIntent(reason = "auth") {
  try {
    window.sessionStorage.setItem(ADMIN_REDIRECT_INTENT_KEY, String(reason || "auth"));
    return true;
  } catch {
    return false;
  }
}

export function consumeAdminRedirectIntent() {
  const value = readSessionStorage(ADMIN_REDIRECT_INTENT_KEY);
  if (!value) {
    return "";
  }

  removeSessionStorage(ADMIN_REDIRECT_INTENT_KEY);
  return value;
}

export function isPublicEntryPath(pathname = window.location.pathname) {
  return normalizePathname(pathname) === normalizePathname(PUBLIC_ENTRY_PATH);
}

export function isAdminEntryPath(pathname = window.location.pathname) {
  return normalizePathname(pathname) === normalizePathname(ADMIN_ENTRY_PATH);
}

export function redirectToAdminEntry({ replace = true, reason = "" } = {}) {
  if (isAdminEntryPath()) {
    return false;
  }

  console.log(
    `[Auth] Redirecting to admin entry${reason ? `: ${reason}` : ""}`
  );
  navigateToEntry(ADMIN_ENTRY_PATH, { replace });
  return true;
}

export function redirectToPublicEntry({ replace = true, hash = "", reason = "" } = {}) {
  const normalizedHash = hash
    ? String(hash).startsWith("#")
      ? String(hash)
      : `#${String(hash)}`
    : "";
  const nextPath = `${PUBLIC_ENTRY_PATH}${normalizedHash}`;

  if (isPublicEntryPath() && window.location.hash === normalizedHash) {
    return false;
  }

  console.log(
    `[Auth] Redirecting to public entry${reason ? `: ${reason}` : ""}`
  );
  navigateToEntry(nextPath, { replace });
  return true;
}
