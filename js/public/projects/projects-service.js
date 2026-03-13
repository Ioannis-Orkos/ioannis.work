import { contentAccessApi } from "../../shared/api/content-access-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { getFolderFromLocation } from "../../shared/location.js";
import { ensureAuthorizedSession } from "../../shared/auth/auth-service.js";
import { isAdminUser } from "../../shared/auth/session-state.js";
import { PAGE_PATHS } from "../../shared/config.js";
import { createProjectsCatalog } from "./projects-catalog.js";
import {
  buildProjectContentUrl,
  buildProjectPublicPath,
  canAccessProject,
  createFallbackProject,
  createProjectFromContentItem,
  getContentAccessStatus,
  getProjectSlug,
  sectionIdForProject,
} from "./projects-model.js";

function redirectToTarget(url) {
  try {
    window.location.href = new URL(url, window.location.href).toString();
  } catch {
    window.location.href = url;
  }
}

function resolveLockedDeliveryType(project, contentItem) {
  if (contentItem?.deliveryType === "link") {
    return "link";
  }

  return String(project?.lockedDelivery || "").trim().toLowerCase() === "link" ? "link" : "content";
}

function resolveProjectRedirectTarget(project, contentItem) {
  return String(project?.contentEndpoint || contentItem?.externalUrl || buildProjectPublicPath(project)).trim();
}

export function createProjectsService({
  state,
  navigationController,
  embeddedDetailUi,
  requestAccessModalUi,
  setProjectStatus,
  renderCatalog,
}) {
  const catalog = createProjectsCatalog(state);

  const getSharedProjectFromLocation = () =>
    getFolderFromLocation({
      hashPrefix: "project-",
    }) ||
    getFolderFromLocation({
      hashPrefix: "p-",
    }) ||
    getFolderFromLocation({
      hashPrefix: "s-",
    });

  const getProjectFolderFromLocation = () =>
    getFolderFromLocation({
      primaryPathPrefix: "/project/",
      legacyPathPrefix: "/projects/",
      hashPrefix: "project-",
    });

  const rerenderCatalog = () => {
    catalog.refresh();
    renderCatalog();
  };

  const navigateToProjectSection = (sectionId, project, { push = true, preserveSharedUrl = false } = {}) => {
    if (navigationController?.navigateTo) {
      navigationController.navigateTo(sectionId, { push });

      if (preserveSharedUrl) {
        const sharedSlug = getProjectSlug(project);
        if (sharedSlug) {
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#project-${sharedSlug}`);
        }
      }
      return;
    }

    window.location.hash = sectionId;
  };

  const normalizeToCatalogRoute = () => {
    if (navigationController?.navigateTo) {
      navigationController.navigateTo("project", { push: false });
      history.replaceState({ type: "page", targetId: "project" }, "", PAGE_PATHS.project || "/project");
      return;
    }

    window.location.hash = "project";
  };

  const openLoginWithMessage = (message, { openModal = true, normalizeRoute = false } = {}) => {
    if (normalizeRoute) {
      normalizeToCatalogRoute();
    }

    setProjectStatus(message || "Login required for this project.");
    if (openModal) {
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "login" });
    }
  };

  const openRequestAccessModal = (
    project,
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

    state.pendingAccessProject = project;
    state.pendingAccessContent = contentItem;

    const slug = getProjectSlug(project);
    requestAccessModalUi.open({
      project,
      requestStatus,
      canSubmit: Number.isFinite(Number(contentItem?.id)),
      requestNote: String(contentItem?.accessRequestNote || state.accessRequestNotesBySlug.get(slug) || "").trim(),
      reviewNote: String(contentItem?.accessReviewNote || state.accessReviewNotesBySlug.get(slug) || "").trim(),
    });
  };

  const syncPendingAccessState = (project, contentItem, requestNote) => {
    const slug = getProjectSlug(project);
    if (!slug) {
      return null;
    }

    const existingContent = contentItem || catalog.getProtectedContentForProject(project) || {};
    const nextContent = {
      ...existingContent,
      slug,
      title: String(existingContent.title || project?.title || slug),
      description: String(existingContent.description || project?.description || ""),
      locked: true,
      deliveryType: String(existingContent.deliveryType || resolveLockedDeliveryType(project, contentItem)).toLowerCase(),
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

  const loadApprovedContent = async (project, contentItem, { push = true } = {}) => {
    try {
      if (resolveLockedDeliveryType(project, contentItem) === "link") {
        const redirectTarget = resolveProjectRedirectTarget(project, contentItem);
        if (!redirectTarget) {
          setProjectStatus("No redirect URL configured for this locked project.");
          return;
        }

        redirectToTarget(redirectTarget);
        return;
      }

      if (!Number.isFinite(Number(contentItem?.id))) {
        setProjectStatus("Content reference missing.");
        return;
      }

      const result = await contentAccessApi.getContent(contentItem.id);
      if (!result.ok) {
        setProjectStatus(result.error || "Failed to load locked project content.");
        return;
      }

      const sectionId = sectionIdForProject(project);
      const section = embeddedDetailUi.ensureSection({
        sectionId,
        folder: project.folder,
      });

      embeddedDetailUi.renderHtmlIntoSection(
        section,
        String(result.data?.htmlContent || ""),
        contentAccessApi.endpoints.detail(contentItem.id)
      );

      navigateToProjectSection(sectionId, project, {
        push,
        preserveSharedUrl: true,
      });
    } catch {
      setProjectStatus("Failed to load locked project content.");
    }
  };

  const openProject = async (
    project,
    { push = true, promptLogin = true, normalizeRouteOnBlock = false } = {}
  ) => {
    if (!project?.folder) {
      return;
    }

    setProjectStatus("");

    const contentItem = catalog.getProtectedContentForProject(project);
    const redirectTarget = resolveProjectRedirectTarget(project, contentItem);

    if (project.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project is locked. Please login and request access.", {
          openModal: promptLogin,
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      if (!contentItem) {
        await catalog.loadProtectedContent();
        catalog.refresh();
        const refreshedContent = catalog.getProtectedContentForProject(project);
        if (!refreshedContent) {
          openRequestAccessModal(project, null, "not_requested", {
            normalizeRoute: normalizeRouteOnBlock,
          });
          return;
        }

        if (
          canAccessProject({
            project,
            contentItem: refreshedContent,
            isAdmin: isAdminUser(),
          })
        ) {
          await loadApprovedContent(project, refreshedContent, { push });
          return;
        }

        openRequestAccessModal(project, refreshedContent, getContentAccessStatus(refreshedContent), {
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      if (
        !canAccessProject({
          project,
          contentItem,
          isAdmin: isAdminUser(),
        })
      ) {
        openRequestAccessModal(project, contentItem, getContentAccessStatus(contentItem), {
          normalizeRoute: normalizeRouteOnBlock,
        });
        return;
      }

      await loadApprovedContent(project, contentItem, { push });
      return;
    }

    if ((contentItem?.deliveryType === "link" || project.lockedDelivery === "link") && redirectTarget) {
      redirectToTarget(redirectTarget);
      return;
    }

    if (contentItem && contentItem.deliveryType === "content") {
      await loadApprovedContent(project, contentItem, { push });
      return;
    }

    const sectionId = sectionIdForProject(project);
    const section = embeddedDetailUi.ensureSection({
      sectionId,
      folder: project.folder,
    });

    await embeddedDetailUi.renderUrlIntoSection(section, buildProjectContentUrl(project));
    navigateToProjectSection(sectionId, project, {
      push,
      preserveSharedUrl: Boolean(contentItem),
    });
  };

  const openProjectByFolder = async (
    folder,
    { push = false, allowFallback = true, promptLogin = true, normalizeRouteOnBlock = false } = {}
  ) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) {
      return;
    }

    const knownProject = state.projects.find((item) => item.folder === normalizedFolder);
    if (knownProject) {
      await openProject(knownProject, { push, promptLogin, normalizeRouteOnBlock });
      return;
    }

    await catalog.loadProtectedContent();
    catalog.refresh();

    const projectFromProtectedContent = state.projects.find((item) => getProjectSlug(item) === normalizedFolder);
    if (projectFromProtectedContent) {
      await openProject(projectFromProtectedContent, { push, promptLogin, normalizeRouteOnBlock });
      return;
    }

    if (!allowFallback) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project requires login and access approval.", {
          openModal: promptLogin,
          normalizeRoute: normalizeRouteOnBlock,
        });
      } else {
        if (normalizeRouteOnBlock) {
          normalizeToCatalogRoute();
        }
        setProjectStatus("Project unavailable.");
      }
      return;
    }

    await openProject(createFallbackProject(normalizedFolder), { push });
  };

  const openSharedProjectBySlug = async (slug, { push = false, promptLogin = true } = {}) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) {
      return;
    }

    const hasSession = await ensureAuthorizedSession();
    if (!hasSession) {
      openLoginWithMessage("This shared project requires login.", {
        openModal: promptLogin,
        normalizeRoute: true,
      });
      return;
    }

    await catalog.loadProtectedContent();
    catalog.refresh();

    const contentItem = catalog.getProtectedContentBySlug(normalizedSlug);
    if (!contentItem) {
      normalizeToCatalogRoute();
      setProjectStatus("Shared project is unavailable.");
      return;
    }

    const knownProject = state.projects.find(
      (item) => getProjectSlug(item) === normalizedSlug || item.folder === normalizedSlug
    );
    const targetProject = knownProject || createProjectFromContentItem(contentItem, normalizedSlug);

    if (
      !canAccessProject({
        project: targetProject,
        contentItem,
        isAdmin: isAdminUser(),
      })
    ) {
      openRequestAccessModal(targetProject, contentItem, getContentAccessStatus(contentItem), {
        normalizeRoute: true,
      });
      return;
    }

    await loadApprovedContent(targetProject, contentItem, { push });
  };

  const handleLocation = async () => {
    const sharedSlug = getSharedProjectFromLocation();
    if (sharedSlug) {
      await openSharedProjectBySlug(sharedSlug, { push: false, promptLogin: false });
      return;
    }

    const folderFromLocation = getProjectFolderFromLocation();
    if (!folderFromLocation) {
      return;
    }

    await openProjectByFolder(folderFromLocation, {
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
    if (!requestAccessModalUi || !state.pendingAccessProject) {
      requestAccessModalUi?.setStatus("No project selected.");
      return false;
    }

    const note = requestAccessModalUi.getNote();
    const project = state.pendingAccessProject;
    const contentItem = state.pendingAccessContent;
    const contentId = Number(contentItem?.id);

    if (!note) {
      requestAccessModalUi.setStatus("Please enter a message.");
      return false;
    }

    if (!Number.isFinite(contentId)) {
      const message = "This project is not connected to the API yet.";
      setProjectStatus(message);
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
        setProjectStatus(errorMessage);
        requestAccessModalUi.setStatus(errorMessage);
        return false;
      }

      const slug = getProjectSlug(project);
      const savedNote = String(result.data?.request?.note || note).trim();
      const nextContent = syncPendingAccessState(project, contentItem, savedNote || note);

      console.log(`[Project] Access request submitted for ${slug || project?.folder || "project"}.`);

      setProjectStatus("Access request sent. Waiting for admin approval.");
      requestAccessModalUi.syncState({
        project,
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
      setProjectStatus("Failed to submit access request.");
      requestAccessModalUi.setStatus("Failed to submit access request.");
      return false;
    }
  };

  const initialize = async () => {
    await catalog.loadBaseProjects();
    rerenderCatalog();
    await catalog.loadProtectedContent();
    rerenderCatalog();
    await handleLocation();
  };

  return {
    handleLocation,
    initialize,
    openProject,
    refreshAuthSensitiveState,
    submitPendingAccessRequest,
  };
}
