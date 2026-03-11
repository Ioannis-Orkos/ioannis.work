import { fetchEmbeddedHtml } from "../../api/content-api.js";
import { APP_EVENT_NAMES } from "../../shared/events.js";
import { createProjectsUi } from "../../ui/projects/projects-ui.js";
import { createRequestAccessModalUi } from "../../ui/projects/request-access-ui.js";
import { createEmbeddedDetailUi } from "../../ui/shared/embedded-detail-ui.js";
import { isAdminUser, isAuthorizedUser } from "../auth/session-state.js";
import { buildProjectImageUrl, filterProjects, resolveProjectAccessLabel } from "./projects-model.js";
import { createProjectsService } from "./projects-service.js";
import { createProjectsState } from "./projects-state.js";

export async function initProjectsController({ navigationController } = {}) {
  const projectPage = document.getElementById("project");
  const mainEl = document.querySelector("main");
  const projectsUi = createProjectsUi();

  if (!projectPage || !mainEl || !projectsUi.isReady) {
    return;
  }

  const state = createProjectsState();
  const requestAccessModalUi = createRequestAccessModalUi();
  const embeddedDetailUi = createEmbeddedDetailUi({
    mainEl,
    sectionDataAttribute: "data-project-folder",
    sectionDatasetKey: "projectFolder",
    frameIdPrefix: "project-frame",
    messageType: "project-frame-height",
    failureMessage: "Failed to load project content.",
    failureLogLabel: "[Project] Failed to load project page:",
    loadHtml: fetchEmbeddedHtml,
  });

  const renderProjects = () => {
    const filteredProjects = filterProjects({
      projects: state.projects,
      query: projectsUi.getSearchQuery(),
      selectedCategories: state.selectedCategories,
    });

    projectsUi.renderProjectList({
      projects: filteredProjects,
      onOpen: (project) => service.openProject(project, { push: true }),
      getImageUrl: buildProjectImageUrl,
      resolveAccessLabel: (project) =>
        resolveProjectAccessLabel({
          project,
          serverProjectsBySlug: state.serverProjectsBySlug,
          isAuthorized: isAuthorizedUser(),
          isAdmin: isAdminUser(),
        }),
    });

    return filteredProjects;
  };

  const renderCategories = () => {
    projectsUi.renderCategories({
      projects: state.projects,
      selectedCategories: state.selectedCategories,
      onToggle: (category) => {
        if (state.selectedCategories.has(category)) {
          state.selectedCategories.delete(category);
        } else {
          state.selectedCategories.add(category);
        }

        renderProjects();
        renderCategories();
      },
    });
  };

  const renderCatalog = () => {
    renderCategories();
    renderProjects();
  };

  const service = createProjectsService({
    state,
    navigationController,
    embeddedDetailUi,
    requestAccessModalUi,
    setProjectStatus: (message) => projectsUi.setStatus(message),
    renderCatalog,
  });

  projectsUi.bindSearchInput(() => {
    renderProjects();
  });

  projectsUi.bindSearchSubmit(() => {
    const filteredProjects = renderProjects();
    if (filteredProjects.length) {
      service.openProject(filteredProjects[0], { push: true });
    }
  });

  window.addEventListener(APP_EVENT_NAMES.authChanged, service.refreshAuthSensitiveState);

  if (requestAccessModalUi) {
    requestAccessModalUi.formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      requestAccessModalUi.setSubmitting(true);
      const submitted = await service.submitPendingAccessRequest();
      requestAccessModalUi.setSubmitting(false);
      if (!submitted) return;
      console.log("[Project] Request access UI updated without leaving the page.");
    });
  }

  try {
    await service.initialize();
    window.addEventListener("popstate", service.handleLocation);
    window.addEventListener("hashchange", service.handleLocation);
  } catch (error) {
    console.error("[Project] Failed to initialize project module:", error);
    projectsUi.showLoadError();
  }
}
