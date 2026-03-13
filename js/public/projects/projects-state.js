export function createProjectsState() {
  return {
    baseProjects: [],
    projects: [],
    selectedCategories: new Set(),
    protectedContentBySlug: new Map(),
    accessRequestNotesBySlug: new Map(),
    accessReviewNotesBySlug: new Map(),
    pendingAccessProject: null,
    pendingAccessContent: null,
  };
}
