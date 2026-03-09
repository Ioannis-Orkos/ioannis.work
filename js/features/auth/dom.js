export function getAuthRefs() {
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
      refs.settingsLogoutBtn
  );

  return {
    ...refs,
    isReady,
  };
}
