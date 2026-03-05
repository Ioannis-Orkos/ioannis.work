import { MODAL_ROUTE_IDS } from "./config.js";

export function initNavigation({ pages, navLinks, pageMap, mobileNavController }) {
  const isModalHash = (hash) => MODAL_ROUTE_IDS.includes(hash);
  const isBlogDetailHash = (hash) => hash.startsWith("blog-") && hash.length > 5;
  const isProjectDetailHash = (hash) => hash.startsWith("project-") && hash.length > 8;
  const isSharedProjectHash = (hash) => hash.startsWith("s-") && hash.length > 2;
  const blogNavTarget = "blog";
  const projectNavTarget = "project";
  const pagePathMap = new Map([
    ["home", "/"],
    ["about", "/about"],
    ["project", "/project"],
    ["blog", "/blog"],
    ["admin", "/admin"],
  ]);

  let livePages = [...pages];
  let livePageMap = new Map(pageMap);

  const refreshPagesState = () => {
    const nextPages = [...document.querySelectorAll(".page")];
    if (
      nextPages.length === livePages.length &&
      nextPages.every((page, index) => page === livePages[index])
    ) {
      return;
    }

    livePages = nextPages;
    livePageMap = new Map(livePages.map((page) => [page.id, page]));
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
    for (const link of navLinks) {
      const isActive = link.dataset.target === navTarget;
      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  const setActivePage = (targetId) => {
    refreshPagesState();
    if (!livePageMap.has(targetId)) return false;

    for (const page of livePages) {
      page.classList.toggle("active", page.id === targetId);
    }

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
    refreshPagesState();
    return livePages.find((page) => page.classList.contains("active"))?.id || livePages[0]?.id;
  };

  const getActivePageId = () => {
    refreshPagesState();
    return livePages.find((page) => page.classList.contains("active"))?.id || getDefaultPageId();
  };

  const resolveFromHash = (hash) => {
    if (!hash) return null;
    refreshPagesState();

    if (livePageMap.has(hash)) {
      return {
        pageId: hash,
        historyTargetId: hash,
        historyPath: buildPathForTarget(hash),
      };
    }

    if (isBlogDetailHash(hash) && livePageMap.has("blog")) {
      return {
        pageId: "blog",
        historyTargetId: hash,
        historyPath: buildPathForTarget(hash),
      };
    }

    if (isProjectDetailHash(hash) && livePageMap.has("project")) {
      return {
        pageId: "project",
        historyTargetId: hash,
        historyPath: buildPathForTarget(hash),
      };
    }

    if (isSharedProjectHash(hash) && livePageMap.has("project")) {
      return {
        pageId: "project",
        historyTargetId: hash,
        historyPath: `/#${hash}`,
      };
    }

    return null;
  };

  const resolveRouteState = ({ hash, pathTarget }) => {
    const hashState = resolveFromHash(hash);
    if (hashState) return hashState;

    refreshPagesState();

    if (pathTarget && livePageMap.has(pathTarget)) {
      return { pageId: pathTarget };
    }

    if (pathTarget && pathTarget.startsWith("blog-") && livePageMap.has("blog")) {
      return { pageId: "blog" };
    }

    if (pathTarget && pathTarget.startsWith("project-") && livePageMap.has("project")) {
      return { pageId: "project" };
    }

    return { pageId: getDefaultPageId() };
  };

  const syncFromUrl = () => {
    const hash = window.location.hash.replace("#", "");
    if (isModalHash(hash)) return;
    const pathTarget = getTargetFromPathname();
    const resolved = resolveRouteState({ hash, pathTarget });
    setActivePage(resolved.pageId);

    if (resolved.historyTargetId && resolved.historyPath) {
      history.replaceState({ type: "page", targetId: resolved.historyTargetId }, "", resolved.historyPath);
    }
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
  const resolvedInitial = resolveRouteState({ hash: initialHash, pathTarget: initialPathTarget });
  const startPage = resolvedInitial.pageId || getDefaultPageId();

  setActivePage(startPage);

  if (!initialPathTarget && !initialHash) {
    history.replaceState({ type: "page", targetId: startPage }, "", buildPathForTarget(startPage));
  } else if (!initialPathTarget && resolvedInitial.historyTargetId && !isModalHash(initialHash)) {
    history.replaceState(
      { type: "page", targetId: resolvedInitial.historyTargetId },
      "",
      resolvedInitial.historyPath
    );
  }

  return {
    navigateTo,
    setActivePage,
    syncFromUrl,
    getActivePageId,
    getDefaultPageId,
  };
}
