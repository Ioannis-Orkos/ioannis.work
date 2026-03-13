import { AVIATION_BASE_PATH, LOCAL_EMBED_FILE_NAME } from "../../shared/config.js";
import { filterCatalogItems } from "../../shared/catalog.js";
import { normalizeStringArray } from "../../shared/normalize.js";

function normalizeDeliveryType(value) {
  return String(value || "content").trim().toLowerCase() === "link" ? "link" : "content";
}

function normalizeExternalCandidate(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (/^\/\//.test(candidate)) return `https:${candidate}`;
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(?:\/|$)/i.test(candidate)) return `https://${candidate}`;
  return "";
}

function normalizeLocalContentPath(value) {
  const candidate = String(value || "").trim().replace(/^\/+/, "");
  if (!candidate) return "";
  return candidate.replace(/\/index\.html$/i, `/${LOCAL_EMBED_FILE_NAME}`);
}

export function normalizeAviationItem(item, index) {
  const folder = String(item?.folder || "").trim();

  return {
    id: String(item?.id || `aviation-${index + 1}`),
    folder,
    title: String(item?.title || `Aviation ${index + 1}`).trim(),
    date: String(item?.date || "").trim(),
    description: String(item?.description || "").trim(),
    image: String(item?.image || "").trim(),
    url: String(item?.url || "").trim(),
    locked: Boolean(item?.locked),
    contentEndpoint: String(item?.contentEndpoint || "").trim(),
    contentSlug: String(item?.contentSlug || folder).trim(),
    lockedDelivery: normalizeDeliveryType(item?.lockedDelivery),
    categories: normalizeStringArray(item?.categories),
  };
}

export function getAviationSlug(item) {
  return String(item?.contentSlug || item?.folder || "").trim();
}

export function filterAviationItems({ items, query, selectedCategories }) {
  return filterCatalogItems({
    items,
    query,
    selectedCategories,
    getCategories: (item) => item.categories,
    getSearchText: (item) => [item.title, item.description, item.date, ...item.categories].join(" "),
  });
}

export function sectionIdForAviationItem(item) {
  return `aviation-${item.folder}`;
}

export function getContentAccessStatus(contentItem) {
  return String(contentItem?.requestStatus || "not_requested").toLowerCase();
}

export function canAccessAviationItem({ item, contentItem, isAdmin = false }) {
  if (!item?.locked) return true;
  if (isAdmin) return true;

  if (typeof contentItem?.canAccess === "boolean") {
    return contentItem.canAccess;
  }

  const requestStatus = getContentAccessStatus(contentItem);
  return requestStatus === "approved" || requestStatus === "admin";
}

export function buildAviationImageUrl(item) {
  const rawImage = String(item?.image || "").trim();
  if (!rawImage) return "";
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
  return `${AVIATION_BASE_PATH}${rawImage.replace(/^\/+/, "")}`;
}

export function buildAviationContentUrl(item) {
  const rawUrl = String(item?.url || "").trim();
  const rawEndpoint = String(item?.contentEndpoint || "").trim();

  const normalizedUrl = normalizeExternalCandidate(rawUrl);
  if (normalizedUrl) return normalizedUrl;

  if (rawUrl) {
    return `${AVIATION_BASE_PATH}${normalizeLocalContentPath(rawUrl)}`;
  }

  const normalizedEndpoint = normalizeExternalCandidate(rawEndpoint);
  if (normalizedEndpoint) return normalizedEndpoint;

  if (item?.contentEndpoint) {
    try {
      return new URL(item.contentEndpoint, window.location.href).toString();
    } catch {
      return item.contentEndpoint;
    }
  }

  return `${AVIATION_BASE_PATH}${item.folder}/${LOCAL_EMBED_FILE_NAME}`;
}

export function buildAviationPublicPath(item) {
  const folder = String(item?.folder || "").trim();
  return folder ? `${AVIATION_BASE_PATH}${folder}/` : "/aviation";
}

export function createFallbackAviationItem(folder) {
  return {
    folder,
    title: `Aviation ${folder}`,
    url: `${folder}/${LOCAL_EMBED_FILE_NAME}`,
    locked: false,
    contentSlug: folder,
    lockedDelivery: "content",
    categories: [],
  };
}

export function mergeAviationCatalog({ baseItems, protectedContentBySlug, isAuthorized }) {
  const items = baseItems.map((item) => ({
    ...item,
    categories: [...item.categories],
  }));

  if (!isAuthorized || !protectedContentBySlug.size) {
    return items;
  }

  const itemsBySlug = new Map(items.map((item) => [getAviationSlug(item), item]));
  let addedCount = 0;

  protectedContentBySlug.forEach((contentItem, slug) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) return;

    const existingItem = itemsBySlug.get(normalizedSlug);
    const contentDeliveryType = normalizeDeliveryType(contentItem?.deliveryType);
    const contentExternalUrl = String(contentItem?.externalUrl || "").trim();
    const contentImagePath = String(contentItem?.imagePath || "").trim();
    const contentDate = String(contentItem?.date || "").trim();
    const contentCategories = normalizeStringArray(contentItem?.categories);

    if (existingItem) {
      existingItem.locked = Boolean(contentItem?.locked ?? existingItem.locked);
      existingItem.lockedDelivery = contentDeliveryType;
      if (contentExternalUrl) {
        existingItem.contentEndpoint = contentExternalUrl;
      }
      if (contentImagePath) {
        existingItem.image = contentImagePath;
      }
      if (contentDate) {
        existingItem.date = contentDate;
      }
      if (contentCategories.length) {
        existingItem.categories = contentCategories;
      }
      if (!existingItem.title && contentItem?.title) {
        existingItem.title = String(contentItem.title);
      }
      if (!existingItem.description && contentItem?.description) {
        existingItem.description = String(contentItem.description);
      }
      return;
    }

    addedCount += 1;
    const generatedItem = normalizeAviationItem(
      {
        id: `content-${normalizedSlug}`,
        folder: normalizedSlug,
        title: String(contentItem?.title || normalizedSlug),
        date: contentDate,
        description: String(contentItem?.description || ""),
        image: contentImagePath,
        locked: Boolean(contentItem?.locked),
        contentSlug: normalizedSlug,
        lockedDelivery: contentDeliveryType,
        contentEndpoint: contentExternalUrl,
        url: contentExternalUrl || `${normalizedSlug}/${LOCAL_EMBED_FILE_NAME}`,
        categories: contentCategories.length ? contentCategories : ["Server"],
      },
      baseItems.length + addedCount
    );

    items.push(generatedItem);
    itemsBySlug.set(normalizedSlug, generatedItem);
  });

  return items;
}

export function resolveAviationAccessLabel({
  item,
  protectedContentBySlug,
  isAuthorized,
  isAdmin,
}) {
  if (!item?.locked) return "open";
  if (!isAuthorized) return "locked";

  const contentItem = protectedContentBySlug.get(getAviationSlug(item));
  if (canAccessAviationItem({ item, contentItem, isAdmin })) return "approved";

  return getContentAccessStatus(contentItem) === "pending" ? "pending" : "locked";
}
