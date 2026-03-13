import { contentAccessApi } from "../../shared/api/content-access-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { getFolderFromLocation } from "../../shared/location.js";
import { ensureAuthorizedSession } from "../../shared/auth/auth-service.js";
import { isAdminUser } from "../../shared/auth/session-state.js";
import { PAGE_PATHS } from "../../shared/config.js";
import { createAviationCatalog } from "./aviation-catalog.js";
import {
  buildAviationContentUrl,
  buildAviationPublicPath,
  canAccessAviationItem,
  createFallbackAviationItem,
  getAviationSlug,
  getContentAccessStatus,
  sectionIdForAviationItem,
} from "./aviation-model.js";

function redirectToTarget(url) {
  try {
    window.location.href = new URL(url, window.location.href).toString();
  } catch {
    window.location.href = url;
  }
}

function resolveLockedDeliveryType(item, contentItem) {
  if (contentItem?.deliveryType === "link") {
    return "link";
  }

  return String(item?.lockedDelivery || "").trim().toLowerCase() === "link" ? "link" : "content";
}

function resolveRedirectTarget(item, contentItem) {
  return String(item?.contentEndpoint || contentItem?.externalUrl || buildAviationPublicPath(item)).trim();
}

export function createAviationService({
  state,
  navigationController,
  embeddedDetailUi,
  requestAccessModalUi,
  setStatus,
  renderCatalog,
}) {
  const catalog = createAviationCatalog(state);

  const getAviationSlugFromLocation = () =>
    getFolderFromLocation({
      hashPrefix: "aviation-",
    });

  const getAviationFolderFromLocation = () =>
    getFolderFromLocation({
      primaryPathPrefix: "/aviation/",
      hashPrefix: "aviation-",
    });

  const rerenderCatalog = () => {
    catalog.refresh();
    renderCatalog();
  };

  const navigateToAviationSection = (sectionId, item, { push = true, preserveContentUrl = false } = {}) => {
    if (navigationController?.navigateTo) {
      navigationController.navigateTo(sectionId, { push });

      if (preserveContentUrl) {
        const slug = getAviationSlug(item);
        if (slug) {
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#aviation-${slug}`);
        }
      }
      return;
    }

    window.location.hash = sectionId;
  };

  const normalizeToCatalogRoute = () => {
    if (navigationController?.navigateTo) {
      navigationController.navigateTo("aviation", { push: false });
      history.replaceState({ type: "page", targetId: "aviation" }, "", PAGE_PATHS.aviation || "/aviation");
      return;
    }

    window.location.hash = "aviation";
  };

  const openLoginWithMessage = (message, { openModal = true, normalizeRoute = false } = {}) => {
    if (normalizeRoute) {
      normalizeToCatalogRoute();
    }

    setStatus(message || "Login required for this aviation content.");
    if (openModal) {
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "login" });
    }
  };

  const openRequestAccessModal = (
    item,
    contentItem,
    requestStatus = "not_requested",
    { normalizeRoute = false } = {}
  ) => {
    if (!requestAccessModalUi) {
      return;
    }

    if (normalizeRoute) {
      normalizeToCatalogRoute();
    }

    state.pendingAccessItem = item;
    state.pendingAccessContent = contentItem;

    const slug = getAviationSlug(item);
    requestAccessModalUi.open({
      project: item,
      entityLabel: "Aviation",
      requestStatus,
      canSubmit: Number.isFinite(Number(contentItem?.id)),
      requestNote: String(contentItem?.accessRequestNote || state.accessRequestNotesBySlug.get(slug) || "").trim(),
      reviewNote: String(contentItem?.accessReviewNote || state.accessReviewNotesBySlug.get(slug) || "").trim(),
    });
  };

  const syncPendingAccessState = (item, contentItem, requestNote) => {
    const slug = getAviationSlug(item);
    if (!slug) {
      return null;
    }

    const existingContent = contentItem || catalog.getProtectedContentForItem(item) || {};
    const nextContent = {
      ...existingContent,
      slug,
      title: String(existingContent.title || item?.title || slug),
      description: String(existingContent.description || item?.description || ""),
      locked: true,
      deliveryType: String(existingContent.deliveryType || resolveLockedDeliveryType(item, contentItem)).toLowerCase(),
      canAccess: false,
      requestStatus: "pending",
      accessRequestNote: requestNote,
      accessReviewNote: "",
    };

    state.protectedContentBySlug = new Map(state.protectedContentBySlug);
    state.protectedContentBySlug.set(slug, nextContent);

    state.accessRequestNotesBySlug = new Map(state.accessRequestNotesBySlug);
    state.accessRequestNotesBySlug.set(slug, requestNote);

    state.accessReviewNotesBySlug = new Map(state.accessReviewNotesBySlug);
    state.accessReviewNotesBySlug.delete(slug);

    state.pendingAccessContent = nextContent;
    return nextContent;
  };

  const loadApprovedContent = async (item, contentItem, { push = true } = {}) => {
    try {
      if (resolveLockedDeliveryType(item, contentItem) === "link") {
        const redirectTarget = resolveRedirectTarget(item, contentItem);
        if (!redirectTarget) {
          setStatus("No redirect URL configured for this locked aviation content.");
          return;
        }

        redirectToTarget(redirectTarget);
        return;
      }

      if (!Number.isFinite(Number(contentItem?.id))) {
        setStatus("Content reference missing.");
        return;
      }

      const result = await contentAccessApi.getContent(contentItem.id);
      if (!result.ok) {
        setStatus(result.error || "Failed to load aviation content.");
        return;
      }

      const sectionId = sectionIdForAviationItem(item);
      const section = embeddedDetailUi.ensureSection({
        sectionId,
        folder: item.folder,
      });

      embeddedDetailUi.renderHtmlIntoSection(
        section,
        String(result.data?.htmlContent || ""),
        contentAccessApi.endpoints.detail(contentItem.id)
      );

      navigateToAviationSection(sectionId, item, {
        push,
        preserveContentUrl: true,
      });
    } catch {
      setStatus("Failed to load aviation content.");
    }
  };

  const openItem = async (item, { push = true, promptLogin = true, normalizeRouteOnBlock = false } = {}) => {
    if (!item?.folder) {
      return;
    }

    setStatus("");

    const contentItem = catalog.getProtectedContentForItem(item);
    const redirectTarget = resolveRedirectTarget(item, contentItem);

    if (item.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This aviation content is locked. Please login and request access.", {
          openModal: promptLogin,
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      if (!contentItem) {
        await catalog.loadProtectedContent();
        catalog.refresh();
        const refreshedContent = catalog.getProtectedContentForItem(item);
        if (!refreshedContent) {
          openRequestAccessModal(item, null, "not_requested", {
            normalizeRoute: normalizeRouteOnBlock,
          });
          return;
        }

        if (
          canAccessAviationItem({
            item,
            contentItem: refreshedContent,
            isAdmin: isAdminUser(),
          })
        ) {
          await loadApprovedContent(item, refreshedContent, { push });
          return;
        }

        openRequestAccessModal(item, refreshedContent, getContentAccessStatus(refreshedContent), {
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      if (
        !canAccessAviationItem({
          item,
          contentItem,
          isAdmin: isAdminUser(),
        })
      ) {
        openRequestAccessModal(item, contentItem, getContentAccessStatus(contentItem), {
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      await loadApprovedContent(item, contentItem, { push });
      return;
    }

    if ((contentItem?.deliveryType === "link" || item.lockedDelivery === "link") && redirectTarget) {
      redirectToTarget(redirectTarget);
      return;
    }

    if (contentItem && contentItem.deliveryType === "content") {
      await loadApprovedContent(item, contentItem, { push });
      return;
    }

    const sectionId = sectionIdForAviationItem(item);
    const section = embeddedDetailUi.ensureSection({
      sectionId,
      folder: item.folder,
    });

    await embeddedDetailUi.renderUrlIntoSection(section, buildAviationContentUrl(item));
    navigateToAviationSection(sectionId, item, {
      push,
      preserveContentUrl: Boolean(contentItem),
    });
  };

  const openItemByFolder = async (
    folder,
    { push = false, allowFallback = true, promptLogin = true, normalizeRouteOnBlock = false } = {}
  ) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) {
      return;
    }

    const knownItem = state.items.find((entry) => entry.folder === normalizedFolder);
    if (knownItem) {
      await openItem(knownItem, { push, promptLogin, normalizeRouteOnBlock });
      return;
    }

    await catalog.loadProtectedContent();
    catalog.refresh();

    const mergedItem = state.items.find((entry) => getAviationSlug(entry) === normalizedFolder);
    if (mergedItem) {
      await openItem(mergedItem, { push, promptLogin, normalizeRouteOnBlock });
      return;
    }

    if (!allowFallback) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This aviation content requires login and access approval.", {
          openModal: promptLogin,
          normalizeRoute: normalizeRouteOnBlock,
        });
      } else {
        if (normalizeRouteOnBlock) {
          normalizeToCatalogRoute();
        }
        setStatus("Aviation content unavailable.");
      }
      return;
    }

    await openItem(createFallbackAviationItem(normalizedFolder), { push });
  };

  const handleLocation = async () => {
    const sharedSlug = getAviationSlugFromLocation();
    if (sharedSlug) {
      await openItemByFolder(sharedSlug, {
        push: false,
        allowFallback: false,
        promptLogin: true,
        normalizeRouteOnBlock: true,
      });
      return;
    }

    const folderFromLocation = getAviationFolderFromLocation();
    if (!folderFromLocation) {
      return;
    }

    await openItemByFolder(folderFromLocation, {
      push: false,
      allowFallback: false,
      promptLogin: true,
      normalizeRouteOnBlock: true,
    });
  };

  const refreshAuthSensitiveState = async () => {
    await catalog.loadProtectedContent();
    rerenderCatalog();
    await handleLocation();
  };

  const submitPendingAccessRequest = async () => {
    if (!requestAccessModalUi || !state.pendingAccessItem) {
      requestAccessModalUi?.setStatus("No aviation content selected.");
      return false;
    }

    const note = requestAccessModalUi.getNote();
    const item = state.pendingAccessItem;
    const contentItem = state.pendingAccessContent;
    const contentId = Number(contentItem?.id);

    if (!note) {
      requestAccessModalUi.setStatus("Please enter a message.");
      return false;
    }

    if (!Number.isFinite(contentId)) {
      const message = "This aviation content is not connected to the API yet.";
      setStatus(message);
      requestAccessModalUi.setStatus(message);
      return false;
    }

    try {
      const result = await contentAccessApi.requestAccess(contentId, { note });

      if (!result.ok) {
        const fallbackMessage =
          result.status === 409
            ? "Access request already submitted."
            : "Failed to submit access request.";
        const errorMessage = result.error || fallbackMessage;
        setStatus(errorMessage);
        requestAccessModalUi.setStatus(errorMessage);
        return false;
      }

      const slug = getAviationSlug(item);
      const savedNote = String(result.data?.request?.note || note).trim();
      const nextContent = syncPendingAccessState(item, contentItem, savedNote || note);

      console.log(`[Aviation] Access request submitted for ${slug || item?.folder || "aviation"}.`);

      setStatus("Access request sent. Waiting for admin approval.");
      requestAccessModalUi.syncState({
        project: item,
        entityLabel: "Aviation",
        requestStatus: "pending",
        canSubmit: false,
        requestNote: savedNote || note,
        reviewNote: "",
      });
      requestAccessModalUi.setStatus("Access request sent.");
      state.pendingAccessContent = nextContent;
      rerenderCatalog();
      return true;
    } catch {
      setStatus("Failed to submit access request.");
      requestAccessModalUi.setStatus("Failed to submit access request.");
      return false;
    }
  };

  const initialize = async () => {
    await catalog.loadBaseItems();
    rerenderCatalog();
    await catalog.loadProtectedContent();
    rerenderCatalog();
    await handleLocation();
  };

  return {
    handleLocation,
    initialize,
    openItem,
    refreshAuthSensitiveState,
    submitPendingAccessRequest,
  };
}
