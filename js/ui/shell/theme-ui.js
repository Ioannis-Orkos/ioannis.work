import { THEME_STORAGE_KEY } from "../../shared/config.js";

export function initThemeUi({ root, themeButtons, themeIcons }) {
  const setTheme = (theme) => {
    root.setAttribute("data-theme", theme);

    const nextIcon = theme === "dark" ? "☀️" : "🌙";
    const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

    themeIcons.forEach((icon) => {
      icon.textContent = nextIcon;
    });

    themeButtons.forEach((button) => {
      button.setAttribute("aria-label", nextLabel);
    });

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  };

  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
  setTheme(initialTheme);

  themeButtons.forEach((themeButton) => {
    themeButton.addEventListener("click", () => {
      const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });
  });
}
