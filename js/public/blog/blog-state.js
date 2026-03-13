export function createBlogState() {
  return {
    baseBlogs: [],
    blogs: [],
    selectedCategories: new Set(),
    protectedContentBySlug: new Map(),
    accessRequestNotesBySlug: new Map(),
    accessReviewNotesBySlug: new Map(),
    pendingAccessBlog: null,
    pendingAccessContent: null,
  };
}
