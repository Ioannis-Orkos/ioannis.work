function getAdminNavLinks() {
  return [...document.querySelectorAll('a[data-target="admin"]')];
}

function getSettingsButtons() {
  return [...document.querySelectorAll(".settings-toggle[data-modal='settings']")];
}

function getAuthLinks() {
  return [...document.querySelectorAll("[data-auth-link]")];
}

function setAdminNavVisibility(visible) {
  getAdminNavLinks().forEach((link) => {
    const navItem = link.closest("li");
    if (navItem) {
      navItem.hidden = !visible;
      return;
    }

    link.hidden = !visible;
  });
}

function setSettingsVisibility(visible) {
  getSettingsButtons().forEach((button) => {
    button.hidden = !visible;
    button.setAttribute("aria-hidden", visible ? "false" : "true");
  });
}

function setNavLoggedState(isLoggedIn) {
  getAuthLinks().forEach((link) => {
    if (isLoggedIn) {
      link.textContent = "Logout";
      link.setAttribute("href", "#");
      link.removeAttribute("data-modal");
      link.dataset.authAction = "logout";
      return;
    }

    link.textContent = "Login";
    link.setAttribute("href", "#login");
    link.setAttribute("data-modal", "login");
    link.dataset.authAction = "login";
  });
}

function getRefs() {
  const refs = {
    loginForm: document.getElementById("login-form"),
    signupForm: document.getElementById("signup-form"),
    showLoginBtn: document.getElementById("show-login"),
    showSignupBtn: document.getElementById("show-signup"),
    googleAuthBtn: document.getElementById("auth-google-button"),
    statusEl: document.getElementById("login-status"),
    settingsProfileForm: document.getElementById("settings-profile-form"),
    settingsPasswordForm: document.getElementById("settings-password-form"),
    settingsFullNameInput: document.getElementById("settings-fullname"),
    settingsCurrentPasswordGroup: document.getElementById("settings-current-password-group"),
    settingsCurrentPasswordInput: document.getElementById("settings-current-password"),
    settingsPasswordSubmit: document.getElementById("settings-password-submit"),
    settingsProfileStatus: document.getElementById("settings-profile-status"),
    settingsPasswordStatus: document.getElementById("settings-password-status"),
    settingsEmail: document.getElementById("settings-email"),
    settingsRole: document.getElementById("settings-role"),
    settingsStatus: document.getElementById("settings-status"),
    settingsRoleCopies: [...document.querySelectorAll("[data-settings-role-copy='1']")],
    settingsStatusCopies: [...document.querySelectorAll("[data-settings-status-copy='1']")],
    settingsAuthMethod: document.getElementById("settings-auth-method"),
    settingsLogoutBtn: document.getElementById("settings-logout"),
    loginOverlay: document.getElementById("login-modal"),
    settingsOverlay: document.getElementById("settings-modal"),
  };

  const isReady = Boolean(
    refs.loginForm &&
      refs.signupForm &&
      refs.showLoginBtn &&
      refs.showSignupBtn &&
      refs.googleAuthBtn &&
      refs.statusEl &&
      refs.settingsProfileForm &&
      refs.settingsPasswordForm &&
      refs.settingsFullNameInput &&
      refs.settingsCurrentPasswordGroup &&
      refs.settingsCurrentPasswordInput &&
      refs.settingsPasswordSubmit &&
      refs.settingsProfileStatus &&
      refs.settingsPasswordStatus &&
      refs.settingsEmail &&
      refs.settingsRole &&
      refs.settingsStatus &&
      refs.settingsAuthMethod &&
      refs.settingsLogoutBtn &&
      refs.loginOverlay &&
      refs.settingsOverlay
  );

  return {
    ...refs,
    isReady,
  };
}

export function createAuthUi({ getCurrentUser }) {
  const refs = getRefs();
  if (!refs.isReady) {
    return {
      isReady: false,
    };
  }

  const setMode = (mode) => {
    const isLogin = mode === "login";
    refs.loginForm.hidden = !isLogin;
    refs.signupForm.hidden = isLogin;
    refs.showLoginBtn.classList.toggle("active", isLogin);
    refs.showSignupBtn.classList.toggle("active", !isLogin);
    refs.statusEl.textContent = "";
  };

  const setStatus = (message) => {
    refs.statusEl.textContent = message || "";
  };

  const setSettingsStatus = (type, message) => {
    if (type === "profile") refs.settingsProfileStatus.textContent = message || "";
    if (type === "password") refs.settingsPasswordStatus.textContent = message || "";
  };

  const syncSettingsModal = (user) => {
    const safeUser = user || {};
    const hasPassword = Boolean(safeUser.hasPassword);

    refs.settingsFullNameInput.value = String(safeUser.fullName || "");
    refs.settingsEmail.textContent = String(safeUser.email || "-");
    refs.settingsRole.textContent = String(safeUser.role || "-");
    refs.settingsStatus.textContent = String(safeUser.status || "-");

    refs.settingsRoleCopies.forEach((el) => {
      el.textContent = String(safeUser.role || "-");
    });

    refs.settingsStatusCopies.forEach((el) => {
      el.textContent = String(safeUser.status || "-");
    });

    refs.settingsAuthMethod.textContent = hasPassword
      ? "Email/password enabled"
      : "Google-only account";
    refs.settingsCurrentPasswordGroup.hidden = !hasPassword;
    refs.settingsCurrentPasswordInput.required = hasPassword;
    refs.settingsPasswordSubmit.textContent = hasPassword ? "Update Password" : "Set Password";
  };

  const syncUiForUser = (user) => {
    const authenticatedUser = user?.id ? user : null;
    const isLoggedIn = Boolean(authenticatedUser?.id);
    const isAdmin = String(authenticatedUser?.role || "").toLowerCase() === "admin";

    setNavLoggedState(isLoggedIn);
    setAdminNavVisibility(isAdmin);
    setSettingsVisibility(isLoggedIn);
    syncSettingsModal(authenticatedUser);
    return authenticatedUser;
  };

  const resetAuthForms = () => {
    refs.loginForm.reset();
    refs.signupForm.reset();
    setStatus("");
    setMode("login");
  };

  const resetSettingsForms = () => {
    refs.settingsPasswordForm.reset();
    setSettingsStatus("profile", "");
    setSettingsStatus("password", "");
    syncSettingsModal(getCurrentUser());
  };

  const bindHandlers = ({
    onGoogleLogin,
    onLoginSubmit,
    onSignupSubmit,
    onLogout,
    onProfileSubmit,
    onPasswordSubmit,
    onLoginModalExit,
    onSettingsModalExit,
  }) => {
    refs.showLoginBtn.addEventListener("click", () => setMode("login"));
    refs.showSignupBtn.addEventListener("click", () => setMode("signup"));

    refs.googleAuthBtn.addEventListener("click", () => {
      onGoogleLogin?.();
    });

    refs.signupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      onSignupSubmit?.({
        fullName: String(new FormData(refs.signupForm).get("fullName") || "").trim(),
        email: String(new FormData(refs.signupForm).get("email") || "").trim(),
        password: String(new FormData(refs.signupForm).get("password") || "").trim(),
      });
    });

    refs.loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      onLoginSubmit?.({
        email: String(new FormData(refs.loginForm).get("email") || "").trim(),
        password: String(new FormData(refs.loginForm).get("password") || "").trim(),
      });
    });

    refs.settingsProfileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      onProfileSubmit?.({
        fullName: String(new FormData(refs.settingsProfileForm).get("fullName") || "").trim(),
      });
    });

    refs.settingsPasswordForm.addEventListener("submit", (event) => {
      event.preventDefault();
      onPasswordSubmit?.({
        currentPassword: String(new FormData(refs.settingsPasswordForm).get("currentPassword") || ""),
        newPassword: String(new FormData(refs.settingsPasswordForm).get("newPassword") || "").trim(),
      });
    });

    refs.settingsLogoutBtn.addEventListener("click", () => {
      onLogout?.();
    });

    document.addEventListener("click", (event) => {
      const authLink = event.target.closest("[data-auth-link]");
      if (authLink && authLink.dataset.authAction === "logout") {
        event.preventDefault();
        onLogout?.();
        return;
      }

      const loginCloseButton = event.target.closest("#login-modal [data-modal-close]");
      if (loginCloseButton) {
        onLoginModalExit?.();
        return;
      }

      if (event.target === refs.loginOverlay) {
        onLoginModalExit?.();
        return;
      }

      const settingsCloseButton = event.target.closest("#settings-modal [data-modal-close]");
      if (settingsCloseButton) {
        onSettingsModalExit?.();
        return;
      }

      if (event.target === refs.settingsOverlay) {
        onSettingsModalExit?.();
      }
    });

    window.addEventListener("hashchange", () => {
      const modalHash = window.location.hash.replace("#", "");
      if (modalHash !== "login") {
        onLoginModalExit?.();
      }
      if (modalHash !== "settings") {
        onSettingsModalExit?.();
      }
    });
  };

  return {
    isReady: true,
    setMode,
    setStatus,
    setSettingsStatus,
    syncUiForUser,
    resetAuthForms,
    resetSettingsForms,
    bindHandlers,
  };
}
