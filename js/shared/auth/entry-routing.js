export const PUBLIC_ENTRY_PATH = "/";
export const ADMIN_ENTRY_PATH = "/admin/";

function normalizePathname(pathname) {
  const normalizedPathname = String(pathname || "/").replace(/\/+$/, "");
  return normalizedPathname || "/";
}

function navigateToEntry(path, { replace = true } = {}) {
  const method = replace ? "replace" : "assign";
  window.location[method](path);
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
