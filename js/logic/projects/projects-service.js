import { loadProjectCatalog } from "../../api/content-api.js";
import { projectsApi } from "../../api/projects-api.js";
import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { getFolderFromLocation } from "../../shared/location.js";
import { isAdminUser, isAuthorizedUser } from "../auth/session-state.js";
import { ensureAuthorizedSession } from "../auth/auth-service.js";
import {
  buildProjectUrl,
  canAccessProject,
  createFallbackProject,
  createProjectFromServer,
  getProjectSlug,
  getServerProjectStatus,
  mergeProjectCatalog,
  normalizeProject,
  sectionIdForProject,
} from "./projects-model.js";

function redirectToTarget(url) {
  try {
    window.location.href = new URL(url, window.location.href).toString();
  } catch {
    window.location.href = url;
  }
}

export function createProjectsService({
  state,
  navigationController,
  embeddedDetailUi,
  requestAccessModalUi,
  setProjectStatus,
  renderCatalog,
}) {
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

  const refreshProjectCatalog = () => {
    state.projects = mergeProjectCatalog({
      baseProjects: state.baseProjects,
      serverProjectsBySlug: state.serverProjectsBySlug,
      isAuthorized: isAuthorizedUser(),
    });
  };

  const rerenderCatalog = () => {
    refreshProjectCatalog();
    renderCatalog();
  };

  const loadServerProjects = async () => {
    state.requestNotesBySlug = new Map();
    state.reviewNotesBySlug = new Map();

    if (!isAuthorizedUser()) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        state.serverProjectsBySlug = new Map();
        return;
      }
    }

    if (!isAuthorizedUser()) {
      state.serverProjectsBySlug = new Map();
      return;
    }

    try {
      const result = await projectsApi.list();
      if (!result.ok) {
        if (result.status === 401) {
          state.serverProjectsBySlug = new Map();
          return;
        }

        throw new Error(result.error || `Failed to fetch project access list: ${result.status}`);
      }

      const rows = Array.isArray(result.data?.projects) ? result.data.projects : [];
      rows.forEach((row) => {
        const slug = String(row?.slug || "").trim();
        const requestNote = String(row?.accessRequestNote || "").trim();
        const reviewNote = String(row?.accessReviewNote || "").trim();

        if (slug && requestNote) {
          state.requestNotesBySlug.set(slug, requestNote);
        }
        if (slug && reviewNote) {
          state.reviewNotesBySlug.set(slug, reviewNote);
        }
      });

      state.serverProjectsBySlug = new Map(
        rows
          .map((row) => [String(row?.slug || "").trim(), row])
          .filter(([slug]) => Boolean(slug))
      );
    } catch (error) {
      console.error("[Project] Failed to load server project access list:", error);
      state.serverProjectsBySlug = new Map();
    }
  };

  const openLoginWithMessage = (message) => {
    setProjectStatus(message || "Login required for this project.");
    emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "login" });
  };

  const openRequestAccessModal = (project, serverProject, requestStatus = "not_requested") => {
    if (!requestAccessModalUi) return;

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
      const serverDeliveryType = String(serverProject?.deliveryType || "").trim().toLowerCase();
      const projectDeliveryType = String(project?.lockedDelivery || "").trim().toLowerCase();
      const effectiveDeliveryType =
        serverDeliveryType === "link" || serverDeliveryType === "content"
          ? serverDeliveryType
          : projectDeliveryType === "link" || projectDeliveryType === "sso"
            ? "link"
            : "content";

      if (effectiveDeliveryType === "link") {
        const redirectBase =
          project?.serverEndpoint || serverProject?.externalUrl || serverProject?.external_url;
        if (!redirectBase) {
          setProjectStatus("No redirect URL configured for this locked project.");
          return;
        }

        redirectToTarget(redirectBase);
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

      if (navigationController?.navigateTo) {
        navigationController.navigateTo(sectionId, { push });
        const sharedSlug = getProjectSlug(project);
        if (sharedSlug) {
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#s-${sharedSlug}`);
        }
      }
    } catch {
      setProjectStatus("Failed to load locked project content.");
    }
  };

  const openProject = async (project, { push = true } = {}) => {
    if (!project || !project.folder) return;

    setProjectStatus("");

    const serverProject = state.serverProjectsBySlug.get(getProjectSlug(project));
    const serverDeliveryType = String(serverProject?.deliveryType || "").trim().toLowerCase();
    const projectDeliveryType = String(project?.lockedDelivery || "").trim().toLowerCase();
    const redirectTarget = String(
      project?.serverEndpoint ||
        serverProject?.externalUrl ||
        serverProject?.external_url ||
        buildProjectUrl(project)
    ).trim();

    if (project.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project is locked. Please login and request access.");
        return;
      }

      if (!serverProject) {
        await loadServerProjects();
        refreshProjectCatalog();
        openRequestAccessModal(
          project,
          state.serverProjectsBySlug.get(getProjectSlug(project)) || null,
          "not_requested"
        );
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

    if ((serverDeliveryType === "link" || projectDeliveryType === "link") && redirectTarget) {
      redirectToTarget(redirectTarget);
      return;
    }

    if (
      serverProject &&
      String(serverProject?.deliveryType || "").trim().toLowerCase() === "content" &&
      String(project?.id || "").startsWith("server-")
    ) {
      await loadServerLockedContent(project, serverProject, { push });
      return;
    }

    const sectionId = sectionIdForProject(project);
    const section = embeddedDetailUi.ensureSection({
      sectionId,
      folder: project.folder,
    });

    await embeddedDetailUi.renderUrlIntoSection(section, buildProjectUrl(project));

    if (navigationController?.navigateTo) {
      navigationController.navigateTo(sectionId, { push });
      if (serverProject) {
        const sharedSlug = getProjectSlug(project);
        if (sharedSlug) {
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#s-${sharedSlug}`);
        }
      }
    } else {
      window.location.hash = sectionId;
    }
  };

  const openProjectByFolder = async (folder, { push = false, allowFallback = true } = {}) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) return;

    const knownProject = state.projects.find((item) => item.folder === normalizedFolder);
    if (knownProject) {
      await openProject(knownProject, { push });
      return;
    }

    await ensureAuthorizedSession();
    await loadServerProjects();
    refreshProjectCatalog();

    const mergedServerProject = state.projects.find((item) => getProjectSlug(item) === normalizedFolder);
    if (mergedServerProject) {
      await openProject(mergedServerProject, { push });
      return;
    }

    if (!allowFallback) {
      if (!isAuthorizedUser()) {
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
    if (!normalizedSlug) return;

    const hasSession = await ensureAuthorizedSession();
    if (!hasSession) {
      openLoginWithMessage("This shared project requires login.");
      return;
    }

    await loadServerProjects();
    refreshProjectCatalog();

    const serverProject = state.serverProjectsBySlug.get(normalizedSlug);
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
    if (!folderFromLocation) return;
    await openProjectByFolder(folderFromLocation, { push: false, allowFallback: false });
  };

  const refreshAuthSensitiveState = async () => {
    await ensureAuthorizedSession();
    await loadServerProjects();
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

      await loadServerProjects();
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
    const data = await loadProjectCatalog();
    const source = Array.isArray(data) ? data : data?.projects;
    state.baseProjects = Array.isArray(source)
      ? source
          .map((project, index) => normalizeProject(project, index))
          .filter((project) => project.folder)
      : [];

    rerenderCatalog();
    await ensureAuthorizedSession();
    await loadServerProjects();
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
