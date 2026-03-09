import { authApi } from "../../api/auth-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { getAuthRefs } from "./dom.js";
import { getAuthUser } from "./session-store.js";
import { closeLoginModal, createAuthUi } from "./ui.js";
import {
  emitSessionChanged,
  fetchCurrentSession,
  loginWithEmail,
  logoutSession,
  signupWithEmail,
  updatePassword,
  updateProfile,
} from "./session-service.js";

function formatStatusDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function initAuth() {
  const refs = getAuthRefs();
  if (!refs.isReady) {
    return;
  }

  const ui = createAuthUi(refs, {
    getCurrentUser: getAuthUser,
  });

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
  };

  refs.showLoginBtn.addEventListener("click", () => ui.setMode("login"));
  refs.showSignupBtn.addEventListener("click", () => ui.setMode("signup"));
  refs.googleAuthBtn.addEventListener("click", () => {
    window.location.assign(authApi.endpoints.google);
  });

  refs.signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(refs.signupForm);
    const payload = {
      fullName: String(formData.get("fullName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
    };

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
    ui.setMode("login");
    refs.loginForm.querySelector("#login-email").value = payload.email;
    refs.signupForm.reset();
  });

  refs.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(refs.loginForm);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
    };

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
    ui.setStatus("Logged in successfully.");
    ui.resetAuthForms();
    closeLoginModal();
  });

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-auth-link]");
    if (!link || link.dataset.authAction !== "logout") return;

    event.preventDefault();
    await performLogout();
  });

  refs.settingsProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = String(new FormData(refs.settingsProfileForm).get("fullName") || "").trim();
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
  });

  refs.settingsPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(refs.settingsPasswordForm);
    const payload = {
      currentPassword: String(formData.get("currentPassword") || ""),
      newPassword: String(formData.get("newPassword") || "").trim(),
    };

    if (!payload.newPassword) {
      ui.setSettingsStatus("password", "New password is required.");
      return;
    }

    const result = await updatePassword(payload);
    if (!result.ok) {
      ui.setSettingsStatus("password", result.error);
      return;
    }

    refs.settingsPasswordForm.reset();
    ui.syncUiForUser(result.user);
    emitSessionChanged(result.user);
    ui.setSettingsStatus("password", result.message);
  });

  refs.settingsLogoutBtn.addEventListener("click", async () => {
    await performLogout();
  });

  document.addEventListener("click", (event) => {
    const loginCloseButton = event.target.closest("#login-modal [data-modal-close]");
    if (loginCloseButton) {
      ui.resetAuthForms();
      return;
    }

    const loginOverlay = document.getElementById("login-modal");
    if (loginOverlay && event.target === loginOverlay) {
      ui.resetAuthForms();
    }

    const settingsCloseButton = event.target.closest("#settings-modal [data-modal-close]");
    if (settingsCloseButton) {
      ui.resetSettingsForms();
      return;
    }

    const settingsOverlay = document.getElementById("settings-modal");
    if (settingsOverlay && event.target === settingsOverlay) {
      ui.resetSettingsForms();
    }
  });

  window.addEventListener("hashchange", () => {
    const modalHash = window.location.hash.replace("#", "");
    if (modalHash !== "login") {
      ui.resetAuthForms();
    }
    if (modalHash !== "settings") {
      ui.resetSettingsForms();
    }
  });

  ui.resetAuthForms();
  ui.syncUiForUser(null);
  bootstrapSession();
}
