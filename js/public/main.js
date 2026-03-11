import { initShell } from "../shared/bootstrap/shell-init.js";
import {
  consumeAdminRedirectIntent,
  redirectToAdminEntry,
} from "../shared/auth/entry-routing.js";
import { initBlogController } from "../logic/blog/blog-controller.js";
import { initContactController } from "../logic/contact/contact-controller.js";
import { initProjectsController } from "../logic/projects/projects-controller.js";
import { initAuthController } from "../logic/auth/auth-controller.js";

const shell = initShell({
  enableNavigation: true,
  fallbackPageId: "home",
  fallbackPath: "/",
});

if (shell.isReady) {
  initContactController();
  initBlogController({ navigationController: shell.navigationController });
  initProjectsController({ navigationController: shell.navigationController });
  initAuthController({
    onAdminSession(user, { source }) {
      const redirectIntent = source === "bootstrap" ? consumeAdminRedirectIntent() : "";
      const shouldRedirect = source === "login" || Boolean(redirectIntent);

      if (!shouldRedirect) {
        console.log(
          `[Auth] Admin session available on public entry without forced redirect (${source}).`
        );
        return;
      }

      console.log(
        `[Auth] Admin session resolved on public entry (${source}) for ${user.email || user.id}.`
      );
      redirectToAdminEntry({
        replace: true,
        reason: redirectIntent || `public entry ${source}`,
      });
    },
  });
}
