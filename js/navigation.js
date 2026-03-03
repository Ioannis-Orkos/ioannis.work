import { MODAL_ROUTE_IDS } from "./config.js";

export function initNavigation({ pages, navLinks, pageMap, mobileNavController }) {
  const isModalHash = (hash) => MODAL_ROUTE_IDS.includes(hash);
  const isBlogDetailHash = (hash) => hash.startsWith("blog-") && hash.length > 5;
  const blogNavTarget = "blog";

  const getPagesState = () => {
    const livePages = [...document.querySelectorAll(".page")];
    const livePageMap = new Map(livePages.map((page) => [page.id, page]));
    return { livePages, livePageMap };
  };

  const setActiveLink = (targetId) => {
    const navTarget = targetId.startsWith("blog-") ? blogNavTarget : targetId;
    navLinks.forEach((link) => {
      const isActive = link.dataset.target === navTarget;
      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const setActivePage = (targetId) => {
    const { livePages, livePageMap } = getPagesState();
    if (!livePageMap.has(targetId)) return false;

    livePages.forEach((page) => {
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

  const getDefaultPageId = () => {
    const { livePages } = getPagesState();
    return livePages.find((page) => page.classList.contains("active"))?.id || livePages[0]?.id;
  };

  const getActivePageId = () => {
    const { livePages } = getPagesState();
    return livePages.find((page) => page.classList.contains("active"))?.id || getDefaultPageId();
  };

  const syncFromUrl = () => {
    const hash = window.location.hash.replace("#", "");
    if (isModalHash(hash)) return;
    const { livePageMap } = getPagesState();

    const targetId = livePageMap.has(hash)
      ? hash
      : isBlogDetailHash(hash) && livePageMap.has("blog")
      ? "blog"
      : getDefaultPageId();
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
  const { livePageMap } = getPagesState();
  const startPage =
    !isModalHash(initialHash) &&
    (livePageMap.has(initialHash) || (isBlogDetailHash(initialHash) && livePageMap.has("blog")))
      ? isBlogDetailHash(initialHash)
        ? "blog"
        : initialHash
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
