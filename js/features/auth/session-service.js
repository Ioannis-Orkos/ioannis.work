import { authApi } from "../../api/auth-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import {
  clearStoredAuthTokens,
  getAuthUser,
  hasStoredAuthToken,
  isAuthorizedUser,
  saveAuthToken,
  setAuthUser,
  setAuthorizedFlag,
} from "./session-store.js";

function normalizeAuthenticatedUser(user) {
  return user?.id ? user : null;
}

export function syncSessionUser(user) {
  const authenticatedUser = normalizeAuthenticatedUser(user);
  setAuthorizedFlag(Boolean(authenticatedUser?.id));
  setAuthUser(authenticatedUser);
  return authenticatedUser;
}

export function emitSessionChanged(user) {
  emitAppEvent(APP_EVENT_NAMES.authChanged, {
    loggedIn: Boolean(user?.id),
    user: user || null,
  });
}

export function clearSessionState() {
  clearStoredAuthTokens();
  return syncSessionUser(null);
}

export async function fetchCurrentSession({ clearOnFailure = true } = {}) {
  try {
    const { response, body } = await authApi.getCurrentSession();
    if (!response.ok) {
      if (clearOnFailure && hasStoredAuthToken()) {
        clearSessionState();
      } else {
        setAuthorizedFlag(false);
      }
      return null;
    }

    return syncSessionUser(body?.user || getAuthUser() || null);
  } catch {
    if (clearOnFailure && hasStoredAuthToken()) {
      clearSessionState();
    } else {
      setAuthorizedFlag(false);
    }
    return null;
  }
}

export async function ensureAuthorizedSession() {
  if (isAuthorizedUser() && getAuthUser()) {
    return true;
  }

  if (!hasStoredAuthToken() && !getAuthUser()) {
    setAuthorizedFlag(false);
    return false;
  }

  const user = await fetchCurrentSession({ clearOnFailure: false });
  return Boolean(user?.id);
}

export async function signupWithEmail(payload) {
  try {
    const { response, body } = await authApi.signup(payload);
    return {
      ok: response.ok,
      body,
      error: response.ok ? "" : body.error || "Signup failed.",
    };
  } catch {
    return {
      ok: false,
      body: {},
      error: "Signup failed. Server unreachable.",
    };
  }
}

export async function loginWithEmail(payload) {
  try {
    const { response, body } = await authApi.login(payload);
    if (!response.ok) {
      return {
        ok: false,
        body,
        user: null,
        error: body.error || "Login failed.",
      };
    }

    saveAuthToken(body?.token || "");
    const user = syncSessionUser(body?.user || null);
    return {
      ok: Boolean(user?.id),
      body,
      user,
      error: user?.id ? "" : "Login failed.",
    };
  } catch {
    return {
      ok: false,
      body: {},
      user: null,
      error: "Login failed. Server unreachable.",
    };
  }
}

export async function logoutSession() {
  try {
    await authApi.logout();
  } catch {
    // Continue clearing local state even if the server call fails.
  }

  return clearSessionState();
}

export async function updateProfile(fullName) {
  try {
    const { response, body } = await authApi.updateProfile({ fullName });
    if (!response.ok) {
      return {
        ok: false,
        user: null,
        error: body.error || "Unable to update profile.",
      };
    }

    return {
      ok: true,
      user: syncSessionUser(body?.user || getAuthUser()),
      message: body.message || "Profile updated.",
      error: "",
    };
  } catch {
    return {
      ok: false,
      user: null,
      error: "Unable to update profile.",
    };
  }
}

export async function updatePassword(payload) {
  try {
    const { response, body } = await authApi.updatePassword(payload);
    if (!response.ok) {
      return {
        ok: false,
        user: null,
        error: body.error || "Unable to update password.",
      };
    }

    return {
      ok: true,
      user: syncSessionUser(body?.user || getAuthUser()),
      message: body.message || "Password updated.",
      error: "",
    };
  } catch {
    return {
      ok: false,
      user: null,
      error: "Unable to update password.",
    };
  }
}
