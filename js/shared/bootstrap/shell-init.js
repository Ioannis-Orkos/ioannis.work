import { getShellDomRefs, hasShellDom } from "../dom/shell-dom.js";
import { initThemeUi } from "../../ui/shell/theme-ui.js";
import { createMobileNavUi } from "../../ui/shell/mobile-nav-ui.js";
import { createNavigationUi } from "../../ui/shell/navigation-ui.js";
import { initHeaderScrollUi } from "../../ui/shell/header-scroll-ui.js";
import { createModalRouterUi } from "../../ui/shell/modal-router-ui.js";

function createStaticNavigationController(activePageId) {
  let currentPageId = String(activePageId || "page");

  return {
    navigateTo(targetId) {
      currentPageId = String(targetId || currentPageId);
      return true;
    },
    setActivePage(targetId) {
      currentPageId = String(targetId || currentPageId);
      return true;
    },
    syncFromUrl() {},
    getActivePageId() {
      return currentPageId;
    },
    getDefaultPageId() {
      return currentPageId;
    },
  };
}

function createFallbackMobileNavController() {
  return {
    close() {},
    open() {},
    isOpen() {
      return false;
    },
  };
}

export function initShell({
  enableNavigation = false,
  fallbackPageId = "home",
  fallbackPath = "/",
} = {}) {
  const refs = getShellDomRefs();
  if (!hasShellDom(refs)) {
    return {
      isReady: false,
      refs,
      mobileNavController: createFallbackMobileNavController(),
      navigationController: createStaticNavigationController(fallbackPageId),
    };
  }

  initThemeUi({
    root: refs.root,
    themeButtons: refs.themeButtons,
    themeIcons: refs.themeIcons,
  });

  const mobileNavController =
    refs.mobileNav && refs.burgerButton
      ? createMobileNavUi({
          mobileNav: refs.mobileNav,
          burgerButton: refs.burgerButton,
        })
      : createFallbackMobileNavController();

  const navigationController =
    enableNavigation && refs.pages.length
      ? createNavigationUi({
          pages: refs.pages,
          navLinks: refs.navLinks,
          pageMap: refs.pageMap,
          mobileNavController,
        })
      : createStaticNavigationController(refs.pages[0]?.id || fallbackPageId);

  createModalRouterUi({
    mobileNavController,
    navigationController,
    fallbackPageId,
    fallbackPath,
  });

  initHeaderScrollUi({ header: refs.header });

  return {
    isReady: true,
    refs,
    mobileNavController,
    navigationController,
  };
}
