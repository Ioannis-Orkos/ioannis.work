import { loadAviationCatalog } from "../../shared/api/content-api.js";
import { contentAccessApi } from "../../shared/api/content-access-api.js";
import { ensureAuthorizedSession } from "../../shared/auth/auth-service.js";
import { isAuthorizedUser } from "../../shared/auth/session-state.js";
import { getAviationSlug, mergeAviationCatalog, normalizeAviationItem } from "./aviation-model.js";

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

export function createAviationCatalog(state) {
  const refresh = () => {
    state.items = mergeAviationCatalog({
      baseItems: state.baseItems,
      protectedContentBySlug: state.protectedContentBySlug,
      isAuthorized: isAuthorizedUser(),
    });

    return state.items;
  };

  const loadBaseItems = async () => {
    const data = await loadAviationCatalog();
    const source = Array.isArray(data) ? data : data?.aviation;

    state.baseItems = Array.isArray(source)
      ? source
          .map((item, index) => normalizeAviationItem(item, index))
          .filter((item) => item.folder)
      : [];

    return state.baseItems;
  };

  const loadProtectedContent = async () => {
    resetProtectedContentState(state);

    const hasSession = isAuthorizedUser() || (await ensureAuthorizedSession());
    if (!hasSession) {
      return [];
    }

    try {
      const result = await contentAccessApi.list({ section: "aviation" });
      if (!result.ok) {
        if (result.status !== 401) {
          console.error("[Aviation] Failed to load protected content access list:", result.error || result.status);
        }
        return [];
      }

      const contentItems = Array.isArray(result.data?.content) ? result.data.content : [];
      applyProtectedContentItems(state, contentItems);
      return contentItems;
    } catch (error) {
      console.error("[Aviation] Failed to load protected content access list:", error);
      return [];
    }
  };

  const getProtectedContentBySlug = (slug) => state.protectedContentBySlug.get(String(slug || "").trim()) || null;
  const getProtectedContentForItem = (item) => getProtectedContentBySlug(getAviationSlug(item));

  return {
    getProtectedContentBySlug,
    getProtectedContentForItem,
    loadBaseItems,
    loadProtectedContent,
    refresh,
  };
}
