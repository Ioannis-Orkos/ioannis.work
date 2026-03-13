import { contentAccessApi } from "../../shared/api/content-access-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { getFolderFromLocation } from "../../shared/location.js";
import { ensureAuthorizedSession } from "../../shared/auth/auth-service.js";
import { isAdminUser } from "../../shared/auth/session-state.js";
import { PAGE_PATHS } from "../../shared/config.js";
import { createBlogCatalog } from "./blog-catalog.js";
import {
  buildBlogContentUrl,
  buildBlogPublicPath,
  canAccessBlog,
  createFallbackBlog,
  getBlogSlug,
  getContentAccessStatus,
  sectionIdForBlog,
} from "./blog-model.js";

function redirectToTarget(url) {
  try {
    window.location.href = new URL(url, window.location.href).toString();
  } catch {
    window.location.href = url;
  }
}

function resolveLockedDeliveryType(blog, contentItem) {
  if (contentItem?.deliveryType === "link") {
    return "link";
  }

  return String(blog?.lockedDelivery || "").trim().toLowerCase() === "link" ? "link" : "content";
}

function resolveBlogRedirectTarget(blog, contentItem) {
  return String(blog?.contentEndpoint || contentItem?.externalUrl || buildBlogPublicPath(blog)).trim();
}

export function createBlogService({
  state,
  navigationController,
  embeddedDetailUi,
  requestAccessModalUi,
  setBlogStatus,
  renderCatalog,
}) {
  const catalog = createBlogCatalog(state);

  const getServerBlogFromLocation = () =>
    getFolderFromLocation({
      hashPrefix: "blog-",
    }) ||
    getFolderFromLocation({
      hashPrefix: "b-",
    });

  const getBlogFolderFromLocation = () =>
    getFolderFromLocation({
      primaryPathPrefix: "/blog/",
      legacyPathPrefix: "/blogs/",
      hashPrefix: "blog-",
    });

  const rerenderCatalog = () => {
    catalog.refresh();
    renderCatalog();
  };

  const navigateToBlogSection = (sectionId, blog, { push = true, preserveContentUrl = false } = {}) => {
    if (navigationController?.navigateTo) {
      navigationController.navigateTo(sectionId, { push });

      if (preserveContentUrl) {
        const blogSlug = getBlogSlug(blog);
        if (blogSlug) {
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#blog-${blogSlug}`);
        }
      }
      return;
    }

    window.location.hash = sectionId;
  };

  const normalizeToCatalogRoute = () => {
    if (navigationController?.navigateTo) {
      navigationController.navigateTo("blog", { push: false });
      history.replaceState({ type: "page", targetId: "blog" }, "", PAGE_PATHS.blog || "/blog");
      return;
    }

    window.location.hash = "blog";
  };

  const openLoginWithMessage = (message, { openModal = true, normalizeRoute = false } = {}) => {
    if (normalizeRoute) {
      normalizeToCatalogRoute();
    }

    setBlogStatus(message || "Login required for this blog.");
    if (openModal) {
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "login" });
    }
  };

  const openRequestAccessModal = (
    blog,
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

    state.pendingAccessBlog = blog;
    state.pendingAccessContent = contentItem;

    const slug = getBlogSlug(blog);
    requestAccessModalUi.open({
      project: blog,
      entityLabel: "Blog",
      requestStatus,
      canSubmit: Number.isFinite(Number(contentItem?.id)),
      requestNote: String(contentItem?.accessRequestNote || state.accessRequestNotesBySlug.get(slug) || "").trim(),
      reviewNote: String(contentItem?.accessReviewNote || state.accessReviewNotesBySlug.get(slug) || "").trim(),
    });
  };

  const syncPendingAccessState = (blog, contentItem, requestNote) => {
    const slug = getBlogSlug(blog);
    if (!slug) {
      return null;
    }

    const existingContent = contentItem || catalog.getProtectedContentForBlog(blog) || {};
    const nextContent = {
      ...existingContent,
      slug,
      title: String(existingContent.title || blog?.title || slug),
      description: String(existingContent.description || blog?.description || ""),
      locked: true,
      deliveryType: String(existingContent.deliveryType || resolveLockedDeliveryType(blog, contentItem)).toLowerCase(),
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

  const loadApprovedContent = async (blog, contentItem, { push = true } = {}) => {
    try {
      if (resolveLockedDeliveryType(blog, contentItem) === "link") {
        const redirectTarget = resolveBlogRedirectTarget(blog, contentItem);
        if (!redirectTarget) {
          setBlogStatus("No redirect URL configured for this locked blog.");
          return;
        }

        redirectToTarget(redirectTarget);
        return;
      }

      if (!Number.isFinite(Number(contentItem?.id))) {
        setBlogStatus("Content reference missing.");
        return;
      }

      const result = await contentAccessApi.getContent(contentItem.id);
      if (!result.ok) {
        setBlogStatus(result.error || "Failed to load blog content.");
        return;
      }

      const sectionId = sectionIdForBlog(blog);
      const section = embeddedDetailUi.ensureSection({
        sectionId,
        folder: blog.folder,
      });

      embeddedDetailUi.renderHtmlIntoSection(
        section,
        String(result.data?.htmlContent || ""),
        contentAccessApi.endpoints.detail(contentItem.id)
      );

      navigateToBlogSection(sectionId, blog, {
        push,
        preserveContentUrl: true,
      });
    } catch {
      setBlogStatus("Failed to load blog content.");
    }
  };

  const openBlog = async (blog, { push = true, promptLogin = true, normalizeRouteOnBlock = false } = {}) => {
    if (!blog?.folder) {
      return;
    }

    setBlogStatus("");

    const contentItem = catalog.getProtectedContentForBlog(blog);
    const redirectTarget = resolveBlogRedirectTarget(blog, contentItem);

    if (blog.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This blog is locked. Please login and request access.", {
          openModal: promptLogin,
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      if (!contentItem) {
        await catalog.loadProtectedContent();
        catalog.refresh();
        const refreshedContent = catalog.getProtectedContentForBlog(blog);
        if (!refreshedContent) {
          openRequestAccessModal(blog, null, "not_requested", {
            normalizeRoute: normalizeRouteOnBlock,
          });
          return;
        }

        if (
          canAccessBlog({
            blog,
            contentItem: refreshedContent,
            isAdmin: isAdminUser(),
          })
        ) {
          await loadApprovedContent(blog, refreshedContent, { push });
          return;
        }

        openRequestAccessModal(blog, refreshedContent, getContentAccessStatus(refreshedContent), {
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      if (
        !canAccessBlog({
          blog,
          contentItem,
          isAdmin: isAdminUser(),
        })
      ) {
        openRequestAccessModal(blog, contentItem, getContentAccessStatus(contentItem), {
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      await loadApprovedContent(blog, contentItem, { push });
      return;
    }

    if ((contentItem?.deliveryType === "link" || blog.lockedDelivery === "link") && redirectTarget) {
      redirectToTarget(redirectTarget);
      return;
    }

    if (contentItem && contentItem.deliveryType === "content") {
      await loadApprovedContent(blog, contentItem, { push });
      return;
    }

    const sectionId = sectionIdForBlog(blog);
    const section = embeddedDetailUi.ensureSection({
      sectionId,
      folder: blog.folder,
    });

    await embeddedDetailUi.renderUrlIntoSection(section, buildBlogContentUrl(blog));
    navigateToBlogSection(sectionId, blog, {
      push,
      preserveContentUrl: Boolean(contentItem),
    });
  };

  const openBlogByFolder = async (
    folder,
    { push = false, allowFallback = true, promptLogin = true, normalizeRouteOnBlock = false } = {}
  ) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) {
      return;
    }

    const knownBlog = state.blogs.find((item) => item.folder === normalizedFolder);
    if (knownBlog) {
      await openBlog(knownBlog, { push, promptLogin, normalizeRouteOnBlock });
      return;
    }

    await catalog.loadProtectedContent();
    catalog.refresh();

    const mergedBlog = state.blogs.find((item) => getBlogSlug(item) === normalizedFolder);
    if (mergedBlog) {
      await openBlog(mergedBlog, { push, promptLogin, normalizeRouteOnBlock });
      return;
    }

    if (!allowFallback) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This blog requires login and access approval.", {
          openModal: promptLogin,
          normalizeRoute: normalizeRouteOnBlock,
        });
      } else {
        if (normalizeRouteOnBlock) {
          normalizeToCatalogRoute();
        }
        setBlogStatus("Blog unavailable.");
      }
      return;
    }

    await openBlog(createFallbackBlog(normalizedFolder), { push });
  };

  const handleLocation = async () => {
    const serverSlug = getServerBlogFromLocation();
    if (serverSlug) {
      await openBlogByFolder(serverSlug, {
        push: false,
        allowFallback: false,
        promptLogin: true,
        normalizeRouteOnBlock: true,
      });
      return;
    }

    const folderFromLocation = getBlogFolderFromLocation();
    if (!folderFromLocation) {
      return;
    }

    await openBlogByFolder(folderFromLocation, {
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
    if (!requestAccessModalUi || !state.pendingAccessBlog) {
      requestAccessModalUi?.setStatus("No blog selected.");
      return false;
    }

    const note = requestAccessModalUi.getNote();
    const blog = state.pendingAccessBlog;
    const contentItem = state.pendingAccessContent;
    const contentId = Number(contentItem?.id);

    if (!note) {
      requestAccessModalUi.setStatus("Please enter a message.");
      return false;
    }

    if (!Number.isFinite(contentId)) {
      const message = "This blog is not connected to the API yet.";
      setBlogStatus(message);
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
        setBlogStatus(errorMessage);
        requestAccessModalUi.setStatus(errorMessage);
        return false;
      }

      const slug = getBlogSlug(blog);
      const savedNote = String(result.data?.request?.note || note).trim();
      const nextContent = syncPendingAccessState(blog, contentItem, savedNote || note);

      console.log(`[Blog] Access request submitted for ${slug || blog?.folder || "blog"}.`);

      setBlogStatus("Access request sent. Waiting for admin approval.");
      requestAccessModalUi.syncState({
        project: blog,
        entityLabel: "Blog",
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
      setBlogStatus("Failed to submit access request.");
      requestAccessModalUi.setStatus("Failed to submit access request.");
      return false;
    }
  };

  const initialize = async () => {
    await catalog.loadBaseBlogs();
    rerenderCatalog();
    await catalog.loadProtectedContent();
    rerenderCatalog();
    await handleLocation();
  };

  return {
    handleLocation,
    initialize,
    openBlog,
    refreshAuthSensitiveState,
    submitPendingAccessRequest,
  };
}
