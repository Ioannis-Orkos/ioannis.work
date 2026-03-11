import {
  DEFAULT_THEME_COLOR,
  THEME_COLOR_OPTIONS,
  THEME_COLOR_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../config.js";

export const THEME_CHANGED_EVENT_NAME = "app:theme-changed";
const PALETTE_STYLESHEET_ID = "theme-palette-stylesheet";

function normalizeTheme(theme) {
  return String(theme || "").toLowerCase() === "dark" ? "dark" : "light";
}

function normalizeThemeColor(themeColor) {
  const normalized = String(themeColor || "").toLowerCase();
  return THEME_COLOR_OPTIONS.includes(normalized) ? normalized : DEFAULT_THEME_COLOR;
}

function buildThemePaletteHref(themeColor) {
  return `/css/tokens.${normalizeThemeColor(themeColor)}.css`;
}

function getThemeDomRefs() {
  return {
    root: document.documentElement,
    themeButtons: [
      document.getElementById("theme-toggle"),
      document.getElementById("theme-toggle-mobile"),
    ].filter(Boolean),
    themeIcons: [
      document.getElementById("theme-icon"),
      document.getElementById("theme-icon-mobile"),
    ].filter(Boolean),
    paletteStylesheet: document.getElementById(PALETTE_STYLESHEET_ID),
  };
}

export function getStoredThemePreference() {
  return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function getStoredThemeColorPreference() {
  return normalizeThemeColor(localStorage.getItem(THEME_COLOR_STORAGE_KEY));
}

export function getActiveTheme(root = document.documentElement) {
  return normalizeTheme(root?.getAttribute("data-theme"));
}

export function getActiveThemeColor(root = document.documentElement) {
  return normalizeThemeColor(root?.getAttribute("data-theme-color"));
}

function emitThemeChanged(root) {
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGED_EVENT_NAME, {
      detail: {
        theme: getActiveTheme(root),
        themeColor: getActiveThemeColor(root),
      },
    })
  );
}

export function applyThemePreference(
  theme,
  { root, themeButtons, themeIcons, emitEvent = true } = {}
) {
  const refs = getThemeDomRefs();
  const nextTheme = normalizeTheme(theme);
  const resolvedRoot = root || refs.root;
  const resolvedThemeButtons = themeButtons || refs.themeButtons;
  const resolvedThemeIcons = themeIcons || refs.themeIcons;

  resolvedRoot.setAttribute("data-theme", nextTheme);

  const nextIcon = nextTheme === "dark" ? "☀️" : "🌙";
  const nextLabel = nextTheme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  resolvedThemeIcons.forEach((icon) => {
    icon.textContent = nextIcon;
  });

  resolvedThemeButtons.forEach((button) => {
    button.setAttribute("aria-label", nextLabel);
  });

  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  if (emitEvent) {
    emitThemeChanged(resolvedRoot);
  }

  return nextTheme;
}

export function applyThemeColorPreference(
  themeColor,
  { root, paletteStylesheet, emitEvent = true } = {}
) {
  const refs = getThemeDomRefs();
  const nextThemeColor = normalizeThemeColor(themeColor);
  const resolvedRoot = root || refs.root;
  const resolvedPaletteStylesheet = paletteStylesheet || refs.paletteStylesheet;

  resolvedRoot.setAttribute("data-theme-color", nextThemeColor);

  if (resolvedPaletteStylesheet) {
    resolvedPaletteStylesheet.setAttribute("href", buildThemePaletteHref(nextThemeColor));
  }

  localStorage.setItem(THEME_COLOR_STORAGE_KEY, nextThemeColor);
  if (emitEvent) {
    emitThemeChanged(resolvedRoot);
  }

  return nextThemeColor;
}

export function initThemeUi({ root, themeButtons, themeIcons }) {
  const refs = getThemeDomRefs();

  applyThemeColorPreference(getStoredThemeColorPreference(), {
    root,
    paletteStylesheet: refs.paletteStylesheet,
    emitEvent: false,
  });

  applyThemePreference(getStoredThemePreference(), {
    root,
    themeButtons,
    themeIcons,
    emitEvent: false,
  });
  emitThemeChanged(root);

  themeButtons.forEach((themeButton) => {
    themeButton.addEventListener("click", () => {
      const nextTheme = getActiveTheme(root) === "dark" ? "light" : "dark";
      applyThemePreference(nextTheme, {
        root,
        themeButtons,
        themeIcons,
      });
    });
  });
}

