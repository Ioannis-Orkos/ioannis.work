import { loadBlogCatalog } from "../../shared/api/content-api.js";
import { contentAccessApi } from "../../shared/api/content-access-api.js";
import { ensureAuthorizedSession } from "../../shared/auth/auth-service.js";
import { isAuthorizedUser } from "../../shared/auth/session-state.js";
import { getBlogSlug, mergeBlogCatalog, normalizeBlog } from "./blog-model.js";

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

export function createBlogCatalog(state) {
  const refresh = () => {
    state.blogs = mergeBlogCatalog({
      baseBlogs: state.baseBlogs,
      protectedContentBySlug: state.protectedContentBySlug,
      isAuthorized: isAuthorizedUser(),
    });

    return state.blogs;
  };

  const loadBaseBlogs = async () => {
    const data = await loadBlogCatalog();
    const source = Array.isArray(data) ? data : data?.blogs;

    state.baseBlogs = Array.isArray(source)
      ? source
          .map((blog, index) => normalizeBlog(blog, index))
          .filter((blog) => blog.folder)
      : [];

    return state.baseBlogs;
  };

  const loadProtectedContent = async () => {
    resetProtectedContentState(state);

    const hasSession = isAuthorizedUser() || (await ensureAuthorizedSession());
    if (!hasSession) {
      return [];
    }

    try {
      const result = await contentAccessApi.list({ section: "blog" });
      if (!result.ok) {
        if (result.status !== 401) {
          console.error("[Blog] Failed to load protected content access list:", result.error || result.status);
        }
        return [];
      }

      const contentItems = Array.isArray(result.data?.content) ? result.data.content : [];
      applyProtectedContentItems(state, contentItems);
      return contentItems;
    } catch (error) {
      console.error("[Blog] Failed to load protected content access list:", error);
      return [];
    }
  };

  const getProtectedContentBySlug = (slug) => state.protectedContentBySlug.get(String(slug || "").trim()) || null;

  const getProtectedContentForBlog = (blog) => getProtectedContentBySlug(getBlogSlug(blog));

  return {
    getProtectedContentBySlug,
    getProtectedContentForBlog,
    loadBaseBlogs,
    loadProtectedContent,
    refresh,
  };
}
