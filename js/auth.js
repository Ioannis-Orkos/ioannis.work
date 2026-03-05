import { AUTH_API_BASE_URL } from "./config.js";

const TOKEN_KEYS = ["auth-token", "access-token", "site-auth-token"];

const endpoints = {
  signup: `${AUTH_API_BASE_URL}/api/auth/signup`,
  login: `${AUTH_API_BASE_URL}/api/auth/login`,
  logout: `${AUTH_API_BASE_URL}/api/auth/logout`,
  me: `${AUTH_API_BASE_URL}/api/auth/me`,
};

const getStoredAuthToken = () => {
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
};

const parseJwtPayload = (token) => {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const saveToken = (token) => {
  if (!token) return;
  TOKEN_KEYS.forEach((key) => {
    localStorage.setItem(key, token);
  });
  window.__IS_AUTHORIZED_USER = true;
  window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: true } }));
};

const setAuthUser = (user) => {
  window.__AUTH_USER = user || null;
};

const getAdminNavLinks = () => [...document.querySelectorAll('a[data-target="admin"]')];

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

const clearTokens = () => {
  TOKEN_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  window.__IS_AUTHORIZED_USER = false;
  setAuthUser(null);
  setAdminNavVisibility(false);
  window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: false } }));
};

const getNavLinks = () => [...document.querySelectorAll("#nav-login-link")];

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
  const statusEl = document.getElementById("login-status");

  if (!loginForm || !signupForm || !showLoginBtn || !showSignupBtn || !statusEl) return;

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

  const resetAuthForms = () => {
    loginForm.reset();
    signupForm.reset();
    setStatus("");
    setMode("login");
  };

  const bootstrapSession = async () => {
    const token = getStoredAuthToken();
    try {
      const response = await fetch(endpoints.me, {
        method: "GET",
        credentials: "include",
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });
      if (response.ok) {
        const body = await parseJsonSafe(response);
        window.__IS_AUTHORIZED_USER = true;
        setAuthUser(body?.user || null);
        setAdminNavVisibility(String(body?.user?.role || "").toLowerCase() === "admin");
        setNavLoggedState(true);
        window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: true } }));
        return;
      }
    } catch {
      // Keep default logged-out state.
    }

    const hasToken = Boolean(token);
    setNavLoggedState(hasToken);
    window.__IS_AUTHORIZED_USER = hasToken;
    if (hasToken) {
      const payload = parseJwtPayload(token);
      const inferredRole = String(payload?.role || "").toLowerCase();
      if (!window.__AUTH_USER) {
        setAuthUser({
          role: inferredRole || "user",
        });
      }
      setAdminNavVisibility(inferredRole === "admin");
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: { loggedIn: true } }));
      return;
    }
    setAdminNavVisibility(false);
  };

  showLoginBtn.addEventListener("click", () => setMode("login"));
  showSignupBtn.addEventListener("click", () => setMode("signup"));

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
      const response = await fetch(endpoints.signup, {
        method: "POST",
        credentials: "include",
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

      setStatus("Signup successful. Verify your email before login.");
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
      const response = await fetch(endpoints.login, {
        method: "POST",
        credentials: "include",
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
      setAuthUser(body?.user || null);
      setAdminNavVisibility(String(body?.user?.role || "").toLowerCase() === "admin");
      setNavLoggedState(true);
      setStatus("Logged in successfully.");
      resetAuthForms();
      closeLoginModal();
    } catch {
      setStatus("Login failed. Server unreachable.");
    }
  });

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("#nav-login-link");
    if (!link) return;

    const action = link.dataset.authAction;
    if (action !== "logout") return;

    event.preventDefault();

    try {
      await fetch(endpoints.logout, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Continue clearing local state even if server call fails.
    }

    clearTokens();
    setNavLoggedState(false);
    resetAuthForms();

    const hash = String(window.location.hash || "").replace(/^#/, "").trim();
    const pathname = String(window.location.pathname || "/");
    const isSharedOrProjectDetail =
      hash.startsWith("s-") ||
      pathname.startsWith("/projects/") ||
      pathname.startsWith("/project/s/");

    if (isSharedOrProjectDetail) {
      window.location.href = "/project";
    }
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
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash.replace("#", "") !== "login") {
      resetAuthForms();
    }
  });

  resetAuthForms();
  setAdminNavVisibility(false);
  bootstrapSession();
}
