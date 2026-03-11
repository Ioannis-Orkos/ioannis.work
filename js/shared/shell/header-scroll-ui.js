import { HEADER_SCROLL_DELTA } from "../config.js";

export function initHeaderScrollUi({ header }) {
  let lastScrollY = window.scrollY;

  window.addEventListener(
    "scroll",
    () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (Math.abs(delta) < HEADER_SCROLL_DELTA) return;

      if (delta < 0) {
        header.classList.remove("is-hidden-on-scroll");
      } else {
        header.classList.add("is-hidden-on-scroll");
      }

      lastScrollY = currentScrollY;
    },
    { passive: true }
  );
}

