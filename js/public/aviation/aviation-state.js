export function createAviationState() {
  return {
    baseItems: [],
    items: [],
    selectedCategories: new Set(),
    protectedContentBySlug: new Map(),
    accessRequestNotesBySlug: new Map(),
    accessReviewNotesBySlug: new Map(),
    pendingAccessItem: null,
    pendingAccessContent: null,
  };
}
