import { THEME_STORAGE_KEY } from "./config.js";

export function initTheme({ root, themeButtons, themeIcons }) {
  const setTheme = (theme) => {
    root.setAttribute("data-theme", theme);

    const nextIcon = theme === "dark" ? "☀️" : "🌙";
    const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

    for (const icon of themeIcons) {
      icon.textContent = nextIcon;
    }

    for (const button of themeButtons) {
      button.setAttribute("aria-label", nextLabel);
    }

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  };

  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
  setTheme(initialTheme);

  for (const themeButton of themeButtons) {
    themeButton.addEventListener("click", () => {
      const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });
  }
}
