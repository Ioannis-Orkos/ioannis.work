import { loadProjectCatalog } from "../../api/content-api.js";
import { projectsApi } from "../../api/projects-api.js";
import { ensureAuthorizedSession } from "../auth/auth-service.js";
import { isAuthorizedUser } from "../auth/session-state.js";
import { getProjectSlug, mergeProjectCatalog, normalizeProject } from "./projects-model.js";

function resetServerProjectState(state) {
  state.serverProjectsBySlug = new Map();
  state.requestNotesBySlug = new Map();
  state.reviewNotesBySlug = new Map();
}

function applyServerProjects(state, projects) {
  const serverProjectsBySlug = new Map();
  const requestNotesBySlug = new Map();
  const reviewNotesBySlug = new Map();

  projects.forEach((project) => {
    const slug = String(project?.slug || "").trim();
    if (!slug) {
      return;
    }

    serverProjectsBySlug.set(slug, project);

    if (project.accessRequestNote) {
      requestNotesBySlug.set(slug, project.accessRequestNote);
    }

    if (project.accessReviewNote) {
      reviewNotesBySlug.set(slug, project.accessReviewNote);
    }
  });

  state.serverProjectsBySlug = serverProjectsBySlug;
  state.requestNotesBySlug = requestNotesBySlug;
  state.reviewNotesBySlug = reviewNotesBySlug;
}

export function createProjectsCatalog(state) {
  const refresh = () => {
    state.projects = mergeProjectCatalog({
      baseProjects: state.baseProjects,
      serverProjectsBySlug: state.serverProjectsBySlug,
      isAuthorized: isAuthorizedUser(),
    });

    return state.projects;
  };

  const loadBaseProjects = async () => {
    const data = await loadProjectCatalog();
    const source = Array.isArray(data) ? data : data?.projects;

    state.baseProjects = Array.isArray(source)
      ? source
          .map((project, index) => normalizeProject(project, index))
          .filter((project) => project.folder)
      : [];

    return state.baseProjects;
  };

  const loadServerProjects = async () => {
    resetServerProjectState(state);

    const hasSession = isAuthorizedUser() || (await ensureAuthorizedSession());
    if (!hasSession) {
      return [];
    }

    try {
      const result = await projectsApi.list();
      if (!result.ok) {
        if (result.status !== 401) {
          console.error("[Project] Failed to load server project access list:", result.error || result.status);
        }
        return [];
      }

      const projects = Array.isArray(result.data?.projects) ? result.data.projects : [];
      applyServerProjects(state, projects);
      return projects;
    } catch (error) {
      console.error("[Project] Failed to load server project access list:", error);
      return [];
    }
  };

  const getServerProjectBySlug = (slug) => state.serverProjectsBySlug.get(String(slug || "").trim()) || null;

  const getServerProject = (project) => getServerProjectBySlug(getProjectSlug(project));

  return {
    getServerProject,
    getServerProjectBySlug,
    loadBaseProjects,
    loadServerProjects,
    refresh,
  };
}
