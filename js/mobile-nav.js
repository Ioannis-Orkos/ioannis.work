import { DESKTOP_MEDIA_QUERY } from "./config.js";

export function initMobileNav({ mobileNav, burgerButton }) {
  const close = () => {
    mobileNav.classList.remove("active");
    burgerButton.classList.remove("active");
    burgerButton.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  const open = () => {
    mobileNav.classList.add("active");
    burgerButton.classList.add("active");
    burgerButton.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const isOpen = () => mobileNav.classList.contains("active");

  burgerButton.setAttribute("role", "button");
  burgerButton.setAttribute("aria-label", "Toggle mobile navigation");
  burgerButton.setAttribute("aria-expanded", "false");
  burgerButton.setAttribute("tabindex", "0");

  burgerButton.addEventListener("click", () => {
    isOpen() ? close() : open();
  });

  burgerButton.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      burgerButton.click();
    }
  });

  const desktopMq = window.matchMedia(DESKTOP_MEDIA_QUERY);
  desktopMq.addEventListener("change", (event) => {
    if (event.matches) {
      close();
    }
  });

  return {
    close,
    open,
    isOpen,
  };
}
