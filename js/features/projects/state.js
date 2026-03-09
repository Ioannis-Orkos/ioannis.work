export function createProjectsState() {
  return {
    baseProjects: [],
    projects: [],
    selectedCategories: new Set(),
    serverProjectsBySlug: new Map(),
    requestNotesBySlug: new Map(),
    reviewNotesBySlug: new Map(),
    pendingRequestProject: null,
    pendingRequestServerProject: null,
  };
}
