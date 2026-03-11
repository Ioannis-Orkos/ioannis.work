import { initShell } from "../shared/bootstrap/shell-init.js";
import { redirectToPublicEntry } from "../shared/auth/entry-routing.js";
import { fetchCurrentSession } from "../logic/auth/auth-service.js";
import { initAuthController } from "../logic/auth/auth-controller.js";
import { initAdminController } from "../logic/admin/admin-controller.js";

async function bootstrapAdminEntry() {
  const user = await fetchCurrentSession({ clearOnFailure: false });
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  if (!user?.id || !isAdmin) {
    console.log("[Admin] Admin session missing. Redirecting to public entry.");
    redirectToPublicEntry({
      replace: true,
      reason: "admin entry requires an admin session",
    });
    return;
  }

  const shell = initShell({
    enableNavigation: false,
    fallbackPageId: "admin",
    fallbackPath: "/admin/",
  });

  if (!shell.isReady) {
    return;
  }

  initAuthController();
  initAdminController({
    onUnauthorized(authState) {
      redirectToPublicEntry({
        replace: true,
        reason: authState?.reason || "admin access required",
      });
    },
  });
}

bootstrapAdminEntry();
