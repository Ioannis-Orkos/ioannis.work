import { projectsApi } from "../../api/projects-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { getFolderFromLocation } from "../../shared/location.js";
import { ensureAuthorizedSession } from "../auth/auth-service.js";
import { isAdminUser } from "../auth/session-state.js";
import { createProjectsCatalog } from "./projects-catalog.js";
import {
  buildProjectUrl,
  canAccessProject,
  createFallbackProject,
  createProjectFromServer,
  getProjectSlug,
  getServerProjectStatus,
  sectionIdForProject,
} from "./projects-model.js";

function redirectToTarget(url) {
  try {
    window.location.href = new URL(url, window.location.href).toString();
  } catch {
    window.location.href = url;
  }
}

function resolveLockedDeliveryType(project, serverProject) {
  if (serverProject?.deliveryType === "link") {
    return "link";
  }

  return String(project?.lockedDelivery || "").trim().toLowerCase() === "link" ? "link" : "content";
}

function resolveProjectRedirectTarget(project, serverProject) {
  return String(project?.serverEndpoint || serverProject?.externalUrl || buildProjectUrl(project)).trim();
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
      hashPrefix: "s-",
    });

  const getProjectFolderFromLocation = () =>
    getFolderFromLocation({
      primaryPathPrefix: "/projects/",
      legacyPathPrefix: "/project/",
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
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#s-${sharedSlug}`);
        }
      }
      return;
    }

    window.location.hash = sectionId;
  };

  const openLoginWithMessage = (message) => {
    setProjectStatus(message || "Login required for this project.");
    emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "login" });
  };

  const openRequestAccessModal = (project, serverProject, requestStatus = "not_requested") => {
    if (!requestAccessModalUi) {
      return;
    }

    state.pendingRequestProject = project;
    state.pendingRequestServerProject = serverProject;

    const slug = getProjectSlug(project);
    requestAccessModalUi.open({
      project,
      requestStatus,
      canSubmit: Boolean(serverProject?.id || slug),
      requestNote: String(serverProject?.accessRequestNote || state.requestNotesBySlug.get(slug) || "").trim(),
      reviewNote: String(serverProject?.accessReviewNote || state.reviewNotesBySlug.get(slug) || "").trim(),
    });
  };

  const loadServerLockedContent = async (project, serverProject, { push = true } = {}) => {
    try {
      if (resolveLockedDeliveryType(project, serverProject) === "link") {
        const redirectTarget = resolveProjectRedirectTarget(project, serverProject);
        if (!redirectTarget) {
          setProjectStatus("No redirect URL configured for this locked project.");
          return;
        }

        redirectToTarget(redirectTarget);
        return;
      }

      if (!Number.isFinite(serverProject?.id)) {
        setProjectStatus("Project reference missing.");
        return;
      }

      const result = await projectsApi.getContent(serverProject.id);
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
        projectsApi.endpoints.content(serverProject.id)
      );

      navigateToProjectSection(sectionId, project, {
        push,
        preserveSharedUrl: true,
      });
    } catch {
      setProjectStatus("Failed to load locked project content.");
    }
  };

  const openProject = async (project, { push = true } = {}) => {
    if (!project?.folder) {
      return;
    }

    setProjectStatus("");

    const serverProject = catalog.getServerProject(project);
    const redirectTarget = resolveProjectRedirectTarget(project, serverProject);

    if (project.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project is locked. Please login and request access.");
        return;
      }

      if (!serverProject) {
        await catalog.loadServerProjects();
        catalog.refresh();
        const refreshedServerProject = catalog.getServerProject(project);
        if (!refreshedServerProject) {
          openRequestAccessModal(project, null, "not_requested");
          return;
        }

        if (
          canAccessProject({
            project,
            serverProject: refreshedServerProject,
            isAdmin: isAdminUser(),
          })
        ) {
          await loadServerLockedContent(project, refreshedServerProject, { push });
          return;
        }

        openRequestAccessModal(project, refreshedServerProject, getServerProjectStatus(refreshedServerProject));
        return;
      }

      if (
        !canAccessProject({
          project,
          serverProject,
          isAdmin: isAdminUser(),
        })
      ) {
        openRequestAccessModal(project, serverProject, getServerProjectStatus(serverProject));
        return;
      }

      await loadServerLockedContent(project, serverProject, { push });
      return;
    }

    if ((serverProject?.deliveryType === "link" || project.lockedDelivery === "link") && redirectTarget) {
      redirectToTarget(redirectTarget);
      return;
    }

    if (serverProject && serverProject.deliveryType === "content" && String(project.id || "").startsWith("server-")) {
      await loadServerLockedContent(project, serverProject, { push });
      return;
    }

    const sectionId = sectionIdForProject(project);
    const section = embeddedDetailUi.ensureSection({
      sectionId,
      folder: project.folder,
    });

    await embeddedDetailUi.renderUrlIntoSection(section, buildProjectUrl(project));
    navigateToProjectSection(sectionId, project, {
      push,
      preserveSharedUrl: Boolean(serverProject),
    });
  };

  const openProjectByFolder = async (folder, { push = false, allowFallback = true } = {}) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) {
      return;
    }

    const knownProject = state.projects.find((item) => item.folder === normalizedFolder);
    if (knownProject) {
      await openProject(knownProject, { push });
      return;
    }

    await catalog.loadServerProjects();
    catalog.refresh();

    const mergedServerProject = state.projects.find((item) => getProjectSlug(item) === normalizedFolder);
    if (mergedServerProject) {
      await openProject(mergedServerProject, { push });
      return;
    }

    if (!allowFallback) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project requires login and access approval.");
      } else {
        setProjectStatus("Project unavailable.");
      }
      return;
    }

    await openProject(createFallbackProject(normalizedFolder), { push });
  };

  const openSharedProjectBySlug = async (slug, { push = false } = {}) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) {
      return;
    }

    const hasSession = await ensureAuthorizedSession();
    if (!hasSession) {
      openLoginWithMessage("This shared project requires login.");
      return;
    }

    await catalog.loadServerProjects();
    catalog.refresh();

    const serverProject = catalog.getServerProjectBySlug(normalizedSlug);
    if (!serverProject) {
      setProjectStatus("Shared project is unavailable.");
      return;
    }

    const knownProject = state.projects.find(
      (item) => getProjectSlug(item) === normalizedSlug || item.folder === normalizedSlug
    );
    const targetProject = knownProject || createProjectFromServer(serverProject, normalizedSlug);

    if (
      !canAccessProject({
        project: targetProject,
        serverProject,
        isAdmin: isAdminUser(),
      })
    ) {
      openRequestAccessModal(targetProject, serverProject, getServerProjectStatus(serverProject));
      return;
    }

    await loadServerLockedContent(targetProject, serverProject, { push });
  };

  const handleLocation = async () => {
    const sharedSlug = getSharedProjectFromLocation();
    if (sharedSlug) {
      await openSharedProjectBySlug(sharedSlug, { push: false });
      return;
    }

    const folderFromLocation = getProjectFolderFromLocation();
    if (!folderFromLocation) {
      return;
    }

    await openProjectByFolder(folderFromLocation, {
      push: false,
      allowFallback: false,
    });
  };

  const refreshAuthSensitiveState = async () => {
    await catalog.loadServerProjects();
    rerenderCatalog();
    await handleLocation();
  };

  const submitPendingAccessRequest = async () => {
    if (!requestAccessModalUi || !state.pendingRequestProject) {
      requestAccessModalUi?.setStatus("No project selected.");
      return false;
    }

    const note = requestAccessModalUi.getNote();
    const project = state.pendingRequestProject;
    const serverProject = state.pendingRequestServerProject;
    const projectRef = serverProject?.id || getProjectSlug(project);

    if (!note) {
      requestAccessModalUi.setStatus("Please enter a message.");
      return false;
    }

    if (!projectRef) {
      requestAccessModalUi.setStatus("Project reference missing. Please try again.");
      return false;
    }

    try {
      const result = await projectsApi.requestAccess(projectRef, {
        note,
        projectTitle: project?.title || "",
        projectDescription: project?.description || "",
      });

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
      if (slug && savedNote) {
        state.requestNotesBySlug.set(slug, savedNote);
      }

      setProjectStatus("Access request sent. Waiting for admin approval.");
      requestAccessModalUi.setStatus("Access request sent.");

      await catalog.loadServerProjects();
      rerenderCatalog();
      return true;
    } catch {
      setProjectStatus("Failed to submit access request.");
      requestAccessModalUi.setStatus("Failed to submit access request.");
      return false;
    }
  };

  const clearPendingAccessRequest = () => {
    state.pendingRequestProject = null;
    state.pendingRequestServerProject = null;
  };

  const initialize = async () => {
    await catalog.loadBaseProjects();
    rerenderCatalog();
    await catalog.loadServerProjects();
    rerenderCatalog();
    await handleLocation();
  };

  return {
    clearPendingAccessRequest,
    handleLocation,
    initialize,
    openProject,
    refreshAuthSensitiveState,
    submitPendingAccessRequest,
  };
}
