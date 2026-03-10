export function setSessionUser(user) {
  const normalizedUser = user?.id ? user : null;
  window.__AUTH_USER = normalizedUser;
  window.__IS_AUTHORIZED_USER = Boolean(normalizedUser?.id);
  return normalizedUser;
}

export function clearSessionUser() {
  return setSessionUser(null);
}

export function getSessionUser() {
  return window.__AUTH_USER || null;
}

export function isAuthorizedUser() {
  return window.__IS_AUTHORIZED_USER === true && Boolean(getSessionUser()?.id);
}

export function getAuthRole() {
  return String(getSessionUser()?.role || "").toLowerCase();
}

export function isAdminUser() {
  return getAuthRole() === "admin";
}
