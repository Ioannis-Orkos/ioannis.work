import { authApi } from "../api/auth-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../events.js";
import { createAuthUi } from "./auth-ui.js";
import { getSessionUser } from "./session-state.js";
import {
  emitSessionChanged,
  fetchCurrentSession,
  loginWithEmail,
  logoutSession,
  signupWithEmail,
  updatePassword,
  updateProfile,
} from "./auth-service.js";

function formatStatusDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function initAuthController({ onAdminSession } = {}) {
  const ui = createAuthUi({
    getCurrentUser: getSessionUser,
  });

  if (!ui.isReady) {
    return;
  }

  const handleAdminSession = (user, source) => {
    const isAdmin = String(user?.role || "").toLowerCase() === "admin";
    if (!isAdmin || typeof onAdminSession !== "function") {
      return false;
    }

    onAdminSession(user, { source });
    return true;
  };

  const performLogout = async () => {
    const user = await logoutSession();
    ui.syncUiForUser(user);
    ui.resetAuthForms();
    ui.resetSettingsForms();
    emitSessionChanged(user);
    emitAppEvent(APP_EVENT_NAMES.closeModal);

    const hash = String(window.location.hash || "").replace(/^#/, "").trim();
    const pathname = String(window.location.pathname || "/");
    const isSharedOrProjectDetail =
      hash.startsWith("s-") ||
      pathname.startsWith("/projects/") ||
      pathname.startsWith("/project/s/");

    if (isSharedOrProjectDetail) {
      window.location.href = "/project";
    }
  };

  const bootstrapSession = async () => {
    const user = await fetchCurrentSession();
    ui.syncUiForUser(user);
    emitSessionChanged(user);
    handleAdminSession(user, "bootstrap");
  };

  ui.bindHandlers({
    onGoogleLogin() {
      window.location.assign(authApi.endpoints.google);
    },
    async onSignupSubmit(payload) {
      if (!payload.email || !payload.password) {
        ui.setStatus("Email and password are required.");
        return;
      }

      const result = await signupWithEmail(payload);
      if (!result.ok) {
        ui.setStatus(result.error);
        return;
      }

      const sentAt = formatStatusDate(result.body?.verificationSentAt);
      ui.setStatus(
        sentAt
          ? `Verify your email. Verification sent on ${sentAt}.`
          : "Verify your email. Verification sent."
      );
      ui.resetAuthForms();

      const loginEmailInput = document.getElementById("login-email");
      if (loginEmailInput) {
        loginEmailInput.value = payload.email;
      }
    },
    async onLoginSubmit(payload) {
      if (!payload.email || !payload.password) {
        ui.setStatus("Email and password are required.");
        return;
      }

      const result = await loginWithEmail(payload);
      if (!result.ok || !result.user?.id) {
        ui.setStatus(result.error || "Login failed.");
        ui.syncUiForUser(null);
        return;
      }

      ui.syncUiForUser(result.user);
      emitSessionChanged(result.user);

      if (handleAdminSession(result.user, "login")) {
        ui.setStatus("Redirecting to admin...");
        return;
      }

      ui.setStatus("Logged in successfully.");
      ui.resetAuthForms();
      emitAppEvent(APP_EVENT_NAMES.closeModal);
    },
    async onLogout() {
      await performLogout();
    },
    async onProfileSubmit({ fullName }) {
      if (!fullName) {
        ui.setSettingsStatus("profile", "Username is required.");
        return;
      }

      const result = await updateProfile(fullName);
      if (!result.ok) {
        ui.setSettingsStatus("profile", result.error);
        return;
      }

      ui.syncUiForUser(result.user);
      emitSessionChanged(result.user);
      ui.setSettingsStatus("profile", result.message);
    },
    async onPasswordSubmit(payload) {
      if (!payload.newPassword) {
        ui.setSettingsStatus("password", "New password is required.");
        return;
      }

      const result = await updatePassword(payload);
      if (!result.ok) {
        ui.setSettingsStatus("password", result.error);
        return;
      }

      ui.resetSettingsForms();
      ui.syncUiForUser(result.user);
      emitSessionChanged(result.user);
      ui.setSettingsStatus("password", result.message);
    },
    onLoginModalExit() {
      ui.resetAuthForms();
    },
    onSettingsModalExit() {
      ui.resetSettingsForms();
    },
  });

  ui.resetAuthForms();
  ui.syncUiForUser(null);
  bootstrapSession();
}

