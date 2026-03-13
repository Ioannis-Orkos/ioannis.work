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
  "admin-content-editor",
  "admin-user-content",
  "admin-request-review",
];

export const PAGE_PATHS = Object.freeze({
  home: "/",
  about: "/about",
  project: "/project",
  blog: "/blog",
  aviation: "/aviation",
});

export const BLOG_BASE_PATH = "/blog/";
export const PROJECT_BASE_PATH = "/project/";
export const AVIATION_BASE_PATH = "/aviation/";
export const LOCAL_EMBED_FILE_NAME = "index.html";

export const STATIC_DATA_URLS = Object.freeze({
  blogs: `${BLOG_BASE_PATH}blog-data.json`,
  projects: `${PROJECT_BASE_PATH}project-data.json`,
  aviation: `${AVIATION_BASE_PATH}aviation-data.json`,
});
