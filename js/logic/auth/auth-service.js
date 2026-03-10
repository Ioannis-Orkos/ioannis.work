import { authApi } from "../../api/auth-api.js";
import { clearAuthTokens, hasAuthToken, saveAuthToken } from "../../api/token-store.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import {
  clearSessionUser,
  getSessionUser,
  isAuthorizedUser,
  setSessionUser,
} from "./session-state.js";

function normalizeAuthenticatedUser(user) {
  return user?.id ? user : null;
}

export function syncSessionUser(user) {
  return setSessionUser(normalizeAuthenticatedUser(user));
}

export function emitSessionChanged(user) {
  emitAppEvent(APP_EVENT_NAMES.authChanged, {
    loggedIn: Boolean(user?.id),
    user: user || null,
  });
}

export function clearSessionState() {
  clearAuthTokens();
  return clearSessionUser();
}

export async function fetchCurrentSession({ clearOnFailure = true } = {}) {
  try {
    const result = await authApi.getCurrentSession();
    if (!result.ok) {
      if (clearOnFailure && hasAuthToken()) {
        clearSessionState();
      } else {
        clearSessionUser();
      }
      return null;
    }

    return syncSessionUser(result.data?.user || getSessionUser() || null);
  } catch {
    if (clearOnFailure && hasAuthToken()) {
      clearSessionState();
    } else {
      clearSessionUser();
    }
    return null;
  }
}

export async function ensureAuthorizedSession() {
  if (isAuthorizedUser() && getSessionUser()) {
    return true;
  }

  if (!hasAuthToken() && !getSessionUser()) {
    clearSessionUser();
    return false;
  }

  const user = await fetchCurrentSession({ clearOnFailure: false });
  return Boolean(user?.id);
}

export async function signupWithEmail(payload) {
  try {
    const result = await authApi.signup(payload);
    return {
      ok: result.ok,
      body: result.data,
      error: result.ok ? "" : result.error || "Signup failed.",
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
    const result = await authApi.login(payload);
    if (!result.ok) {
      return {
        ok: false,
        body: result.data,
        user: null,
        error: result.error || "Login failed.",
      };
    }

    saveAuthToken(result.data?.token || "");
    const user = syncSessionUser(result.data?.user || null);
    return {
      ok: Boolean(user?.id),
      body: result.data,
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
    const result = await authApi.updateProfile({ fullName });
    if (!result.ok) {
      return {
        ok: false,
        user: null,
        error: result.error || "Unable to update profile.",
      };
    }

    return {
      ok: true,
      user: syncSessionUser(result.data?.user || getSessionUser()),
      message: result.data?.message || "Profile updated.",
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
    const result = await authApi.updatePassword(payload);
    if (!result.ok) {
      return {
        ok: false,
        user: null,
        error: result.error || "Unable to update password.",
      };
    }

    return {
      ok: true,
      user: syncSessionUser(result.data?.user || getSessionUser()),
      message: result.data?.message || "Password updated.",
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
