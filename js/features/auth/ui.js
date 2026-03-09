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

export function closeLoginModal() {
  const closeBtn = document.querySelector("#login-modal [data-modal-close]");
  if (closeBtn) closeBtn.click();
}

export function createAuthUi(refs, { getCurrentUser }) {
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

    refs.settingsAuthMethod.textContent = hasPassword ? "Email/password enabled" : "Google-only account";
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

  return {
    setMode,
    setStatus,
    setSettingsStatus,
    syncUiForUser,
    resetAuthForms,
    resetSettingsForms,
  };
}
