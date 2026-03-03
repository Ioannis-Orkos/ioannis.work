import { getDomRefs, hasRequiredDom } from "./dom.js";
import { initTheme } from "./theme.js";
import { initMobileNav } from "./mobile-nav.js";
import { initNavigation } from "./navigation.js";
import { initHeaderScroll } from "./header-scroll.js";
import { initModals } from "./modals.js";

const refs = getDomRefs();

if (hasRequiredDom(refs)) {
  initTheme({
    root: refs.root,
    themeButtons: refs.themeButtons,
    themeIcons: refs.themeIcons,
  });

  const mobileNavController = initMobileNav({
    mobileNav: refs.mobileNav,
    burgerButton: refs.burgerButton,
  });

  const navigationController = initNavigation({
    pages: refs.pages,
    navLinks: refs.navLinks,
    pageMap: refs.pageMap,
    mobileNavController,
  });

  initModals({
    mobileNavController,
    navigationController,
  });

  initHeaderScroll({
    header: refs.header,
  });
}
