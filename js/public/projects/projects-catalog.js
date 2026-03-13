import { loadProjectCatalog } from "../../shared/api/content-api.js";
import { contentAccessApi } from "../../shared/api/content-access-api.js";
import { ensureAuthorizedSession } from "../../shared/auth/auth-service.js";
import { isAuthorizedUser } from "../../shared/auth/session-state.js";
import { getProjectSlug, mergeProjectCatalog, normalizeProject } from "./projects-model.js";

function resetProtectedContentState(state) {
  state.protectedContentBySlug = new Map();
  state.accessRequestNotesBySlug = new Map();
  state.accessReviewNotesBySlug = new Map();
}

function applyProtectedContentItems(state, contentItems) {
  const protectedContentBySlug = new Map();
  const accessRequestNotesBySlug = new Map();
  const accessReviewNotesBySlug = new Map();

  contentItems.forEach((contentItem) => {
    const slug = String(contentItem?.slug || "").trim();
    if (!slug) {
      return;
    }

    protectedContentBySlug.set(slug, contentItem);

    if (contentItem.accessRequestNote) {
      accessRequestNotesBySlug.set(slug, contentItem.accessRequestNote);
    }

    if (contentItem.accessReviewNote) {
      accessReviewNotesBySlug.set(slug, contentItem.accessReviewNote);
    }
  });

  state.protectedContentBySlug = protectedContentBySlug;
  state.accessRequestNotesBySlug = accessRequestNotesBySlug;
  state.accessReviewNotesBySlug = accessReviewNotesBySlug;
}

export function createProjectsCatalog(state) {
  const refresh = () => {
    state.projects = mergeProjectCatalog({
      baseProjects: state.baseProjects,
      protectedContentBySlug: state.protectedContentBySlug,
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

  const loadProtectedContent = async () => {
    resetProtectedContentState(state);

    const hasSession = isAuthorizedUser() || (await ensureAuthorizedSession());
    if (!hasSession) {
      return [];
    }

    try {
      const result = await contentAccessApi.list({ section: "project" });
      if (!result.ok) {
        if (result.status !== 401) {
          console.error("[Project] Failed to load protected content access list:", result.error || result.status);
        }
        return [];
      }

      const contentItems = Array.isArray(result.data?.content) ? result.data.content : [];
      applyProtectedContentItems(state, contentItems);
      return contentItems;
    } catch (error) {
      console.error("[Project] Failed to load protected content access list:", error);
      return [];
    }
  };

  const getProtectedContentBySlug = (slug) => state.protectedContentBySlug.get(String(slug || "").trim()) || null;

  const getProtectedContentForProject = (project) => getProtectedContentBySlug(getProjectSlug(project));

  return {
    getProtectedContentBySlug,
    getProtectedContentForProject,
    loadBaseProjects,
    loadProtectedContent,
    refresh,
  };
}

