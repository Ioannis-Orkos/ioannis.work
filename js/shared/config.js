export const THEME_STORAGE_KEY = "site-theme";
export const THEME_COLOR_STORAGE_KEY = "site-theme-color";
export const DEFAULT_THEME_COLOR = "forest";
export const THEME_COLOR_OPTIONS = Object.freeze(["forest", "copper", "red"]);
export const DESKTOP_MEDIA_QUERY = "(min-width: 769px)";
export const HEADER_SCROLL_DELTA = 8;
export const MODAL_ROUTE_IDS = [
  "contact",
  "login",
  "request-access",
  "settings",
  "admin-project-editor",
  "admin-user-projects",
  "admin-request-review",
];
export const AUTH_API_PRIMARY_BASE_URL = "https://api-ioannis-work.onrender.com";
export const AUTH_API_FALLBACK_BASE_URL = "https://api.ioannis.work";
export const AUTH_API_SELECTED_BASE_URL_KEY = "auth-api-selected-base-url";

export const PAGE_PATHS = Object.freeze({
  home: "/",
  about: "/about",
  project: "/project",
  blog: "/blog",
});

export const BLOG_BASE_PATH = "/blogs/";
export const PROJECT_BASE_PATH = "/projects/";
export const LOCAL_EMBED_FILE_NAME = "embed.html";

export const STATIC_DATA_URLS = Object.freeze({
  blogs: `${BLOG_BASE_PATH}blog-data.json`,
  projects: `${PROJECT_BASE_PATH}projects-data.json`,
});

const LOCAL_FRONTEND_HOSTS = new Set(["localhost", "127.0.0.1"]);

function getFrontendHostname() {
  try {
    return String(window.location.hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

export const IS_LOCAL_FRONTEND = LOCAL_FRONTEND_HOSTS.has(getFrontendHostname());
export const AUTH_API_LOCAL_BASE_URL = IS_LOCAL_FRONTEND
  ? `http://${getFrontendHostname()}:4000`
  : "http://127.0.0.1:4000";
export const AUTH_API_BASE_URL = IS_LOCAL_FRONTEND
  ? AUTH_API_LOCAL_BASE_URL
  : AUTH_API_PRIMARY_BASE_URL;
