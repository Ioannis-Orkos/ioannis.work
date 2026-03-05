import { MODAL_ROUTE_IDS } from "./config.js";

export function initNavigation({ pages, navLinks, pageMap, mobileNavController }) {
  const isModalHash = (hash) => MODAL_ROUTE_IDS.includes(hash);
  const isBlogDetailHash = (hash) => hash.startsWith("blog-") && hash.length > 5;
  const isProjectDetailHash = (hash) => hash.startsWith("project-") && hash.length > 8;
  const blogNavTarget = "blog";
  const projectNavTarget = "project";
  const pagePathMap = new Map([
    ["home", "/"],
    ["about", "/about"],
    ["project", "/project"],
    ["blog", "/blog"],
  ]);

  const getPagesState = () => {
    const livePages = [...document.querySelectorAll(".page")];
    const livePageMap = new Map(livePages.map((page) => [page.id, page]));
    return { livePages, livePageMap };
  };

  const normalizePathname = () => {
    const pathname = window.location.pathname || "/";
    const normalized = pathname.replace(/\/+$/, "");
    return normalized || "/";
  };

  const getTargetFromPathname = () => {
    const pathname = normalizePathname();

    if (pathname === "/") return "home";

    for (const [pageId, path] of pagePathMap.entries()) {
      if (path !== "/" && pathname === path) {
        return pageId;
      }
    }

    if (pathname.startsWith("/blogs/")) {
      const folder = pathname.slice("/blogs/".length).split("/")[0];
      return folder ? `blog-${folder}` : "blog";
    }

    // Backward compatibility for older blog detail route.
    if (pathname.startsWith("/blog/")) {
      const folder = pathname.slice("/blog/".length).split("/")[0];
      return folder ? `blog-${folder}` : "blog";
    }

    if (pathname.startsWith("/projects/")) {
      const folder = pathname.slice("/projects/".length).split("/")[0];
      return folder ? `project-${folder}` : "project";
    }

    // Backward compatibility for older project detail route.
    if (pathname.startsWith("/project/")) {
      const folder = pathname.slice("/project/".length).split("/")[0];
      return folder ? `project-${folder}` : "project";
    }

    return null;
  };

  const buildPathForTarget = (targetId) => {
    if (targetId.startsWith("blog-") && targetId.length > 5) {
      const folder = targetId.replace("blog-", "");
      return `/blogs/${folder}`;
    }

    if (targetId.startsWith("project-") && targetId.length > 8) {
      const folder = targetId.replace("project-", "");
      return `/projects/${folder}`;
    }

    return pagePathMap.get(targetId) || "/";
  };

  const setActiveLink = (targetId) => {
    let navTarget = targetId;
    if (targetId.startsWith("blog-")) navTarget = blogNavTarget;
    if (targetId.startsWith("project-")) navTarget = projectNavTarget;
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
      history.pushState({ type: "page", targetId }, "", buildPathForTarget(targetId));
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
    const pathTarget = getTargetFromPathname();
    const hasHashPageTarget = Boolean(hash && livePageMap.has(hash));
    const hasHashBlogTarget = isBlogDetailHash(hash) && livePageMap.has("blog");
    const hasHashProjectTarget = isProjectDetailHash(hash) && livePageMap.has("project");

    // Hash-based SPA routes (e.g. /#project) should win over default path '/'.
    if (hasHashPageTarget) {
      setActivePage(hash);
      history.replaceState({ type: "page", targetId: hash }, "", buildPathForTarget(hash));
      return;
    }

    if (hasHashBlogTarget) {
      setActivePage("blog");
      history.replaceState({ type: "page", targetId: hash }, "", buildPathForTarget(hash));
      return;
    }

    if (hasHashProjectTarget) {
      setActivePage("project");
      history.replaceState({ type: "page", targetId: hash }, "", buildPathForTarget(hash));
      return;
    }

    if (pathTarget && livePageMap.has(pathTarget)) {
      setActivePage(pathTarget);
      return;
    }

    if (pathTarget && pathTarget.startsWith("blog-") && livePageMap.has("blog")) {
      setActivePage("blog");
      return;
    }

    if (pathTarget && pathTarget.startsWith("project-") && livePageMap.has("project")) {
      setActivePage("project");
      return;
    }

    setActivePage(getDefaultPageId());
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
  const initialPathTarget = getTargetFromPathname();
  const { livePageMap } = getPagesState();
  const hasInitialHashPageTarget = Boolean(initialHash && livePageMap.has(initialHash));
  const hasInitialHashBlogTarget = isBlogDetailHash(initialHash) && livePageMap.has("blog");
  const hasInitialHashProjectTarget = isProjectDetailHash(initialHash) && livePageMap.has("project");

  let startPage = getDefaultPageId();

  if (hasInitialHashPageTarget) {
    startPage = initialHash;
  } else if (hasInitialHashBlogTarget) {
    startPage = "blog";
  } else if (hasInitialHashProjectTarget) {
    startPage = "project";
  } else if (initialPathTarget && livePageMap.has(initialPathTarget)) {
    startPage = initialPathTarget;
  } else if (initialPathTarget && initialPathTarget.startsWith("blog-") && livePageMap.has("blog")) {
    startPage = "blog";
  } else if (initialPathTarget && initialPathTarget.startsWith("project-") && livePageMap.has("project")) {
    startPage = "project";
  } else if (
    !isModalHash(initialHash) &&
    (
      livePageMap.has(initialHash) ||
      (isBlogDetailHash(initialHash) && livePageMap.has("blog")) ||
      (isProjectDetailHash(initialHash) && livePageMap.has("project"))
    )
  ) {
    startPage = isBlogDetailHash(initialHash)
      ? "blog"
      : isProjectDetailHash(initialHash)
        ? "project"
        : initialHash;
  }

  setActivePage(startPage);

  if (!initialPathTarget && !initialHash) {
    history.replaceState({ type: "page", targetId: startPage }, "", buildPathForTarget(startPage));
  } else if (!initialPathTarget && initialHash && !isModalHash(initialHash)) {
    const targetId = (isBlogDetailHash(initialHash) || isProjectDetailHash(initialHash))
      ? initialHash
      : startPage;
    history.replaceState({ type: "page", targetId }, "", buildPathForTarget(targetId));
  }

  return {
    navigateTo,
    setActivePage,
    syncFromUrl,
    getActivePageId,
    getDefaultPageId,
  };
}
