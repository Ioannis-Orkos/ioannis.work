import { AUTH_API_BASE_URL } from "./config.js";
import {
  authenticatedFetch,
  clearStoredAuthTokens,
  getAuthUser,
  getStoredAuthToken,
  parseJsonSafe,
  saveAuthToken,
  setAuthUser,
  setAuthorizedFlag,
} from "./auth-session.js";

const endpoints = {
  signup: `${AUTH_API_BASE_URL}/api/auth/signup`,
  login: `${AUTH_API_BASE_URL}/api/auth/login`,
  logout: `${AUTH_API_BASE_URL}/api/auth/logout`,
  me: `${AUTH_API_BASE_URL}/api/auth/me`,
  profile: `${AUTH_API_BASE_URL}/api/auth/profile`,
  password: `${AUTH_API_BASE_URL}/api/auth/password`,
  google: `${AUTH_API_BASE_URL}/api/auth/google`,
};

const formatStatusDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const saveToken = (token) => {
  return saveAuthToken(token);
};

const getAdminNavLinks = () => [...document.querySelectorAll('a[data-target="admin"]')];
const getSettingsButtons = () => [...document.querySelectorAll(".settings-toggle[data-modal='settings']")];

const setAdminNavVisibility = (visible) => {
  getAdminNavLinks().forEach((link) => {
    const navItem = link.closest("li");
    if (navItem) {
      navItem.hidden = !visible;
      return;
    }
    link.hidden = !visible;
  });
};

const setSettingsVisibility = (visible) => {
  getSettingsButtons().forEach((button) => {
    button.hidden = !visible;
    button.setAttribute("aria-hidden", visible ? "false" : "true");
  });
};

const clearTokens = () => {
  clearStoredAuthTokens();
  setAuthorizedFlag(false);
  setAuthUser(null);
  setAdminNavVisibility(false);
  setSettingsVisibility(false);
  window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: false } }));
};

const getNavLinks = () => [...document.querySelectorAll("[data-auth-link]")];

const setNavLoggedState = (isLoggedIn) => {
  getNavLinks().forEach((link) => {
    if (isLoggedIn) {
      link.textContent = "Logout";
      link.setAttribute("href", "#");
      link.removeAttribute("data-modal");
      link.dataset.authAction = "logout";
    } else {
      link.textContent = "Login";
      link.setAttribute("href", "#login");
      link.setAttribute("data-modal", "login");
      link.dataset.authAction = "login";
    }
  });
};

const closeLoginModal = () => {
  const closeBtn = document.querySelector("#login-modal [data-modal-close]");
  if (closeBtn) closeBtn.click();
};

export function initAuth() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const showLoginBtn = document.getElementById("show-login");
  const showSignupBtn = document.getElementById("show-signup");
  const googleAuthBtn = document.getElementById("auth-google-button");
  const statusEl = document.getElementById("login-status");
  const settingsProfileForm = document.getElementById("settings-profile-form");
  const settingsPasswordForm = document.getElementById("settings-password-form");
  const settingsFullNameInput = document.getElementById("settings-fullname");
  const settingsCurrentPasswordGroup = document.getElementById("settings-current-password-group");
  const settingsCurrentPasswordInput = document.getElementById("settings-current-password");
  const settingsPasswordSubmit = document.getElementById("settings-password-submit");
  const settingsProfileStatus = document.getElementById("settings-profile-status");
  const settingsPasswordStatus = document.getElementById("settings-password-status");
  const settingsEmail = document.getElementById("settings-email");
  const settingsRole = document.getElementById("settings-role");
  const settingsStatus = document.getElementById("settings-status");
  const settingsRoleCopies = [...document.querySelectorAll("[data-settings-role-copy='1']")];
  const settingsStatusCopies = [...document.querySelectorAll("[data-settings-status-copy='1']")];
  const settingsAuthMethod = document.getElementById("settings-auth-method");
  const settingsLogoutBtn = document.getElementById("settings-logout");

  if (
    !loginForm ||
    !signupForm ||
    !showLoginBtn ||
    !showSignupBtn ||
    !googleAuthBtn ||
    !statusEl ||
    !settingsProfileForm ||
    !settingsPasswordForm ||
    !settingsFullNameInput ||
    !settingsCurrentPasswordGroup ||
    !settingsCurrentPasswordInput ||
    !settingsPasswordSubmit ||
    !settingsProfileStatus ||
    !settingsPasswordStatus ||
    !settingsEmail ||
    !settingsRole ||
    !settingsStatus ||
    !settingsAuthMethod ||
    !settingsLogoutBtn
  ) return;

  const setMode = (mode) => {
    const isLogin = mode === "login";
    loginForm.hidden = !isLogin;
    signupForm.hidden = isLogin;
    showLoginBtn.classList.toggle("active", isLogin);
    showSignupBtn.classList.toggle("active", !isLogin);
    statusEl.textContent = "";
  };

  const setStatus = (message) => {
    statusEl.textContent = message || "";
  };

  const setSettingsStatus = (type, message) => {
    if (type === "profile") settingsProfileStatus.textContent = message || "";
    if (type === "password") settingsPasswordStatus.textContent = message || "";
  };

  const syncSettingsModal = (user) => {
    const safeUser = user || {};
    const hasPassword = Boolean(safeUser.hasPassword);
    settingsFullNameInput.value = String(safeUser.fullName || "");
    settingsEmail.textContent = String(safeUser.email || "-");
    settingsRole.textContent = String(safeUser.role || "-");
    settingsStatus.textContent = String(safeUser.status || "-");
    settingsRoleCopies.forEach((el) => {
      el.textContent = String(safeUser.role || "-");
    });
    settingsStatusCopies.forEach((el) => {
      el.textContent = String(safeUser.status || "-");
    });
    settingsAuthMethod.textContent = hasPassword ? "Email/password enabled" : "Google-only account";
    settingsCurrentPasswordGroup.hidden = !hasPassword;
    settingsCurrentPasswordInput.required = hasPassword;
    settingsPasswordSubmit.textContent = hasPassword ? "Update Password" : "Set Password";
  };

  const resetAuthForms = () => {
    loginForm.reset();
    signupForm.reset();
    setStatus("");
    setMode("login");
  };

  const resetSettingsForms = () => {
    settingsPasswordForm.reset();
    setSettingsStatus("profile", "");
    setSettingsStatus("password", "");
    syncSettingsModal(getAuthUser());
  };

  const applyAuthenticatedUser = (user) => {
    const authenticatedUser = user?.id ? user : null;
    setAuthorizedFlag(Boolean(authenticatedUser?.id));
    setAuthUser(authenticatedUser);
    setAdminNavVisibility(String(authenticatedUser?.role || "").toLowerCase() === "admin");
    setSettingsVisibility(Boolean(authenticatedUser?.id));
    syncSettingsModal(authenticatedUser);
    return authenticatedUser;
  };

  const performLogout = async () => {
    try {
      await authenticatedFetch(endpoints.logout, {
        method: "POST",
      });
    } catch {
      // Continue clearing local state even if server call fails.
    }

    clearTokens();
    setNavLoggedState(false);
    setSettingsVisibility(false);
    resetAuthForms();
    resetSettingsForms();
    window.dispatchEvent(new CustomEvent("app:close-modal"));

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
    const token = getStoredAuthToken();
    try {
      const response = await authenticatedFetch(endpoints.me, {
        method: "GET",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });
      if (response.ok) {
        const body = await parseJsonSafe(response);
        const authenticatedUser = applyAuthenticatedUser(body?.user || null);
        const isLoggedIn = Boolean(authenticatedUser?.id);
        setNavLoggedState(isLoggedIn);
        window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: isLoggedIn } }));
        return;
      }
    } catch {
      // Keep default logged-out state.
    }

    if (token) {
      clearStoredAuthTokens();
    }
    setAuthUser(null);
    setAuthorizedFlag(false);
    setNavLoggedState(false);
    setAdminNavVisibility(false);
    setSettingsVisibility(false);
    syncSettingsModal(null);
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: false } }));
  };

  showLoginBtn.addEventListener("click", () => setMode("login"));
  showSignupBtn.addEventListener("click", () => setMode("signup"));
  googleAuthBtn.addEventListener("click", () => {
    window.location.assign(endpoints.google);
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(signupForm);
    const payload = {
      fullName: String(formData.get("fullName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
    };

    if (!payload.email || !payload.password) {
      setStatus("Email and password are required.");
      return;
    }

    try {
      const response = await authenticatedFetch(endpoints.signup, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await parseJsonSafe(response);
      if (!response.ok) {
        setStatus(body.error || "Signup failed.");
        return;
      }

      const sentAt = formatStatusDate(body?.verificationSentAt);
      setStatus(
        sentAt
          ? `Verify your email. Verification sent on ${sentAt}.`
          : "Verify your email. Verification sent."
      );
      setMode("login");
      loginForm.querySelector("#login-email").value = payload.email;
      signupForm.reset();
    } catch {
      setStatus("Signup failed. Server unreachable.");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const payload = {
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || "").trim(),
    };

    if (!payload.email || !payload.password) {
      setStatus("Email and password are required.");
      return;
    }

    try {
      const response = await authenticatedFetch(endpoints.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await parseJsonSafe(response);
      if (!response.ok) {
        setStatus(body.error || "Login failed.");
        return;
      }

      saveToken(body.token);
      const authenticatedUser = applyAuthenticatedUser(body?.user || null);
      const isLoggedIn = Boolean(authenticatedUser?.id);
      setNavLoggedState(isLoggedIn);
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: isLoggedIn } }));
      if (!isLoggedIn) {
        setStatus("Login failed.");
        clearTokens();
        return;
      }
      setStatus("Logged in successfully.");
      resetAuthForms();
      closeLoginModal();
    } catch {
      setStatus("Login failed. Server unreachable.");
    }
  });

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-auth-link]");
    if (!link) return;

    const action = link.dataset.authAction;
    if (action !== "logout") return;

    event.preventDefault();
    await performLogout();
  });

  settingsProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = String(new FormData(settingsProfileForm).get("fullName") || "").trim();
    if (!fullName) {
      setSettingsStatus("profile", "Username is required.");
      return;
    }

    try {
      const response = await authenticatedFetch(endpoints.profile, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        setSettingsStatus("profile", body.error || "Unable to update profile.");
        return;
      }

      applyAuthenticatedUser(body?.user || getAuthUser());
      setSettingsStatus("profile", body.message || "Profile updated.");
    } catch {
      setSettingsStatus("profile", "Unable to update profile.");
    }
  });

  settingsPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(settingsPasswordForm);
    const payload = {
      currentPassword: String(formData.get("currentPassword") || ""),
      newPassword: String(formData.get("newPassword") || "").trim(),
    };

    if (!payload.newPassword) {
      setSettingsStatus("password", "New password is required.");
      return;
    }

    try {
      const response = await authenticatedFetch(endpoints.password, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        setSettingsStatus("password", body.error || "Unable to update password.");
        return;
      }

      settingsPasswordForm.reset();
      applyAuthenticatedUser(body?.user || getAuthUser());
      setSettingsStatus("password", body.message || "Password updated.");
    } catch {
      setSettingsStatus("password", "Unable to update password.");
    }
  });

  settingsLogoutBtn.addEventListener("click", async () => {
    await performLogout();
  });

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("#login-modal [data-modal-close]");
    if (closeButton) {
      resetAuthForms();
      return;
    }

    const overlay = document.getElementById("login-modal");
    if (overlay && event.target === overlay) {
      resetAuthForms();
    }

    const settingsCloseButton = event.target.closest("#settings-modal [data-modal-close]");
    if (settingsCloseButton) {
      resetSettingsForms();
      return;
    }

    const settingsOverlay = document.getElementById("settings-modal");
    if (settingsOverlay && event.target === settingsOverlay) {
      resetSettingsForms();
    }
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash.replace("#", "") !== "login") {
      resetAuthForms();
    }
    if (window.location.hash.replace("#", "") !== "settings") {
      resetSettingsForms();
    }
  });

  resetAuthForms();
  setAdminNavVisibility(false);
  setSettingsVisibility(false);
  syncSettingsModal(null);
  bootstrapSession();
}
