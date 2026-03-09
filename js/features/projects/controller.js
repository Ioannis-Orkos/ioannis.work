import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { createEmbeddedDetailController } from "../../shared/embedded-detail.js";
import { fetchEmbeddedHtml } from "../../api/content-api.js";
import { isAdminUser, isAuthorizedUser } from "../auth/session-store.js";
import { buildProjectImageUrl, resolveProjectAccessLabel } from "./model.js";
import { createRequestAccessModal } from "./request-access-modal.js";
import { createProjectsService } from "./service.js";
import { createProjectsState } from "./state.js";
import { getFilteredProjects, renderProjectCategories, renderProjectList } from "./ui.js";

export async function initProject({ navigationController } = {}) {
  const projectPage = document.getElementById("project");
  const mainEl = document.querySelector("main");
  const projectListEl = document.getElementById("projects");
  const projectSearchEl = document.getElementById("project-search");
  const projectCategoriesEl = document.getElementById("project-categories");
  const projectStatusEl = document.getElementById("project-status");

  if (!projectPage || !mainEl || !projectListEl || !projectSearchEl || !projectCategoriesEl) {
    return;
  }

  const state = createProjectsState();
  const requestAccessModal = createRequestAccessModal();
  const embeddedDetailController = createEmbeddedDetailController({
    mainEl,
    sectionDataAttribute: "data-project-folder",
    sectionDatasetKey: "projectFolder",
    frameIdPrefix: "project-frame",
    messageType: "project-frame-height",
    failureMessage: "Failed to load project content.",
    failureLogLabel: "[Project] Failed to load project page:",
    loadHtml: fetchEmbeddedHtml,
  });

  const setProjectStatus = (message) => {
    if (!projectStatusEl) return;
    projectStatusEl.textContent = message || "";
  };

  const renderProjects = () => {
    const filteredProjects = getFilteredProjects({
      projects: state.projects,
      query: projectSearchEl.value,
      selectedCategories: state.selectedCategories,
    });

    renderProjectList({
      container: projectListEl,
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
    renderProjectCategories({
      container: projectCategoriesEl,
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
    embeddedDetailController,
    requestAccessModal,
    setProjectStatus,
    renderCatalog,
  });

  projectSearchEl.addEventListener("input", renderProjects);
  projectSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    const filteredProjects = renderProjects();
    if (filteredProjects.length) {
      service.openProject(filteredProjects[0], { push: true });
    }
  });

  window.addEventListener(APP_EVENT_NAMES.authChanged, service.refreshAuthSensitiveState);

  if (requestAccessModal) {
    requestAccessModal.formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      requestAccessModal.setSubmitting(true);
      const submitted = await service.submitPendingAccessRequest();
      requestAccessModal.setSubmitting(false);
      if (!submitted) return;

      emitAppEvent(APP_EVENT_NAMES.closeModal);
      service.clearPendingAccessRequest();
      requestAccessModal.reset();
    });
  }

  try {
    await service.initialize();
    window.addEventListener("popstate", service.handleLocation);
    window.addEventListener("hashchange", service.handleLocation);
  } catch (error) {
    console.error("[Project] Failed to initialize project module:", error);
    projectListEl.innerHTML = "<p>Failed to load projects.</p>";
  }
}
