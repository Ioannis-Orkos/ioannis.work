import { getDomRefs, hasRequiredDom } from "./dom.js";
import { initThemeUi } from "../ui/shell/theme-ui.js";
import { createMobileNavUi } from "../ui/shell/mobile-nav-ui.js";
import { createNavigationUi } from "../ui/shell/navigation-ui.js";
import { initHeaderScrollUi } from "../ui/shell/header-scroll-ui.js";
import { createModalRouterUi } from "../ui/shell/modal-router-ui.js";
import { initBlogController } from "../logic/blog/blog-controller.js";
import { initContactController } from "../logic/contact/contact-controller.js";
import { initAuthController } from "../logic/auth/auth-controller.js";
import { initProjectsController } from "../logic/projects/projects-controller.js";
import { initAdminController } from "../logic/admin/admin-controller.js";

const refs = getDomRefs();

if (hasRequiredDom(refs)) {
  initThemeUi({
    root: refs.root,
    themeButtons: refs.themeButtons,
    themeIcons: refs.themeIcons,
  });

  const mobileNavController = createMobileNavUi({
    mobileNav: refs.mobileNav,
    burgerButton: refs.burgerButton,
  });

  const navigationController = createNavigationUi({
    pages: refs.pages,
    navLinks: refs.navLinks,
    pageMap: refs.pageMap,
    mobileNavController,
  });

  createModalRouterUi({
    mobileNavController,
    navigationController,
  });

  initContactController();
  initHeaderScrollUi({ header: refs.header });
  initBlogController({ navigationController });
  initProjectsController({ navigationController });
  initAdminController({ navigationController });
  initAuthController();
}
