export function getFolderFromLocation({
  primaryPathPrefix,
  legacyPathPrefix = "",
  hashPrefix = "",
}) {
  const pathname = (window.location.pathname || "/").replace(/\/+$/, "") || "/";

  if (primaryPathPrefix && pathname.startsWith(primaryPathPrefix)) {
    const folder = pathname.slice(primaryPathPrefix.length).split("/")[0];
    if (folder) return folder;
  }

  if (legacyPathPrefix && pathname.startsWith(legacyPathPrefix)) {
    const folder = pathname.slice(legacyPathPrefix.length).split("/")[0];
    if (folder) return folder;
  }

  const hash = window.location.hash.replace("#", "");
  return hashPrefix && hash.startsWith(hashPrefix)
    ? hash.slice(hashPrefix.length)
    : "";
}
