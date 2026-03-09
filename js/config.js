export const THEME_STORAGE_KEY = "site-theme";
export const DESKTOP_MEDIA_QUERY = "(min-width: 769px)";
export const HEADER_SCROLL_DELTA = 8;
export const MODAL_ROUTE_IDS = ["contact", "login", "request-access", "settings"];
export const AUTH_API_PRIMARY_BASE_URL = "https://api-ioannis-work.onrender.com";
export const AUTH_API_FALLBACK_BASE_URL = "https://api.ioannis.work";

const LOCAL_FRONTEND_HOSTS = new Set(["localhost", "127.0.0.1"]);

const getFrontendHostname = () => {
  try {
    return String(window.location.hostname || "").toLowerCase();
  } catch {
    return "";
  }
};

export const IS_LOCAL_FRONTEND = LOCAL_FRONTEND_HOSTS.has(getFrontendHostname());
export const AUTH_API_LOCAL_BASE_URL = IS_LOCAL_FRONTEND
  ? `http://${getFrontendHostname()}:4000`
  : "http://127.0.0.1:4000";
export const AUTH_API_BASE_URL = IS_LOCAL_FRONTEND
  ? AUTH_API_LOCAL_BASE_URL
  : AUTH_API_PRIMARY_BASE_URL;
