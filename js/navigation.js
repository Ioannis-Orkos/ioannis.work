import { MODAL_ROUTE_IDS } from "./config.js";

export function initNavigation({ pages, navLinks, pageMap, mobileNavController }) {
  const isModalHash = (hash) => MODAL_ROUTE_IDS.includes(hash);

  const setActiveLink = (targetId) => {
    navLinks.forEach((link) => {
      const isActive = link.dataset.target === targetId;
      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const setActivePage = (targetId) => {
    if (!pageMap.has(targetId)) return false;

    pages.forEach((page) => {
      page.classList.toggle("active", page.id === targetId);
    });

    setActiveLink(targetId);
    return true;
  };

  const navigateTo = (targetId, { push = true } = {}) => {
    if (!setActivePage(targetId)) return;

    if (mobileNavController.isOpen()) {
      mobileNavController.close();
    }

    if (push) {
      history.pushState({ targetId }, "", `#${targetId}`);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const getDefaultPageId = () =>
    pages.find((page) => page.classList.contains("active"))?.id || pages[0].id;

  const getActivePageId = () =>
    pages.find((page) => page.classList.contains("active"))?.id || getDefaultPageId();

  const syncFromUrl = () => {
    const hash = window.location.hash.replace("#", "");
    if (isModalHash(hash)) return;

    const targetId = pageMap.has(hash) ? hash : getDefaultPageId();
    setActivePage(targetId);
  };

  window.addEventListener("popstate", syncFromUrl);
  window.addEventListener("hashchange", syncFromUrl);

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-target]");
    if (!link) return;

    event.preventDefault();
    navigateTo(link.dataset.target, { push: true });
  });

  const initialHash = window.location.hash.replace("#", "");
  const startPage =
    !isModalHash(initialHash) && pageMap.has(initialHash)
      ? initialHash
      : getDefaultPageId();
  setActivePage(startPage);

  if (!initialHash) {
    history.replaceState(null, "", `#${startPage}`);
  }

  return {
    navigateTo,
    setActivePage,
    syncFromUrl,
    getActivePageId,
    getDefaultPageId,
  };
}
