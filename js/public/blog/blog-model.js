import { BLOG_BASE_PATH, LOCAL_EMBED_FILE_NAME } from "../../shared/config.js";
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

export function normalizeBlog(blog, index) {
  const folder = String(blog?.folder || "").trim();

  return {
    id: String(blog?.id || `blog-${index + 1}`),
    folder,
    title: String(blog?.title || `Blog ${index + 1}`).trim(),
    date: String(blog?.date || "").trim(),
    description: String(blog?.description || "").trim(),
    image: String(blog?.image || "").trim(),
    url: String(blog?.url || "").trim(),
    locked: Boolean(blog?.locked),
    contentEndpoint: String(blog?.contentEndpoint || "").trim(),
    contentSlug: String(blog?.contentSlug || folder).trim(),
    lockedDelivery: normalizeDeliveryType(blog?.lockedDelivery),
    categories: normalizeStringArray(blog?.categories),
  };
}

export function getBlogSlug(blog) {
  return String(blog?.contentSlug || blog?.folder || "").trim();
}

export function filterBlogs({ blogs, query, selectedCategories }) {
  return filterCatalogItems({
    items: blogs,
    query,
    selectedCategories,
    getCategories: (blog) => blog.categories,
    getSearchText: (blog) => [blog.title, blog.description, blog.date, ...blog.categories].join(" "),
  });
}

export function sectionIdForBlog(blog) {
  return `blog-${blog.folder}`;
}

export function getContentAccessStatus(contentItem) {
  return String(contentItem?.requestStatus || "not_requested").toLowerCase();
}

export function canAccessBlog({ blog, contentItem, isAdmin = false }) {
  if (!blog?.locked) return true;
  if (isAdmin) return true;

  if (typeof contentItem?.canAccess === "boolean") {
    return contentItem.canAccess;
  }

  const requestStatus = getContentAccessStatus(contentItem);
  return requestStatus === "approved" || requestStatus === "admin";
}

export function buildBlogImageUrl(blog) {
  const rawImage = String(blog?.image || "").trim();
  if (!rawImage) return "";
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
  return `${BLOG_BASE_PATH}${rawImage.replace(/^\/+/, "")}`;
}

export function buildBlogContentUrl(blog) {
  const rawUrl = String(blog?.url || "").trim();
  const rawEndpoint = String(blog?.contentEndpoint || "").trim();

  const normalizedUrl = normalizeExternalCandidate(rawUrl);
  if (normalizedUrl) return normalizedUrl;

  if (rawUrl) {
    return `${BLOG_BASE_PATH}${normalizeLocalContentPath(rawUrl)}`;
  }

  const normalizedEndpoint = normalizeExternalCandidate(rawEndpoint);
  if (normalizedEndpoint) return normalizedEndpoint;

  if (blog?.contentEndpoint) {
    try {
      return new URL(blog.contentEndpoint, window.location.href).toString();
    } catch {
      return blog.contentEndpoint;
    }
  }

  return `${BLOG_BASE_PATH}${blog.folder}/${LOCAL_EMBED_FILE_NAME}`;
}

export function buildBlogPublicPath(blog) {
  const folder = String(blog?.folder || "").trim();
  return folder ? `${BLOG_BASE_PATH}${folder}/` : "/blog";
}

export function createFallbackBlog(folder) {
  return {
    folder,
    title: `Blog ${folder}`,
    url: `${folder}/${LOCAL_EMBED_FILE_NAME}`,
    locked: false,
    contentSlug: folder,
    lockedDelivery: "content",
  };
}

export function createBlogFromContentItem(contentItem, slug) {
  return normalizeBlog(
    {
      id: `content-${slug}`,
      folder: slug,
      title: String(contentItem?.title || slug),
      date: String(contentItem?.date || "").trim(),
      description: String(contentItem?.description || ""),
      image: String(contentItem?.imagePath || ""),
      locked: Boolean(contentItem?.locked),
      contentSlug: slug,
      lockedDelivery: normalizeDeliveryType(contentItem?.deliveryType),
      contentEndpoint: String(contentItem?.externalUrl || ""),
      categories: contentItem?.categories,
    },
    0
  );
}

export function mergeBlogCatalog({ baseBlogs, protectedContentBySlug, isAuthorized }) {
  const blogs = baseBlogs.map((blog) => ({
    ...blog,
    categories: [...blog.categories],
  }));

  if (!isAuthorized || !protectedContentBySlug.size) {
    return blogs;
  }

  const blogsBySlug = new Map(blogs.map((blog) => [getBlogSlug(blog), blog]));
  let addedCount = 0;

  protectedContentBySlug.forEach((contentItem, slug) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) return;

    const existingBlog = blogsBySlug.get(normalizedSlug);
    const contentDeliveryType = normalizeDeliveryType(contentItem?.deliveryType);
    const contentExternalUrl = String(contentItem?.externalUrl || "").trim();
    const contentImagePath = String(contentItem?.imagePath || "").trim();
    const contentDate = String(contentItem?.date || "").trim();
    const contentCategories = normalizeStringArray(contentItem?.categories);

    if (existingBlog) {
      existingBlog.locked = Boolean(contentItem?.locked ?? existingBlog.locked);
      existingBlog.lockedDelivery = contentDeliveryType;
      if (contentExternalUrl) {
        existingBlog.contentEndpoint = contentExternalUrl;
      }
      if (contentImagePath) {
        existingBlog.image = contentImagePath;
      }
      if (contentDate) {
        existingBlog.date = contentDate;
      }
      if (contentCategories.length) {
        existingBlog.categories = contentCategories;
      }
      if (!existingBlog.title && contentItem?.title) {
        existingBlog.title = String(contentItem.title);
      }
      if (!existingBlog.description && contentItem?.description) {
        existingBlog.description = String(contentItem.description);
      }
      return;
    }

    addedCount += 1;
    const generatedBlog = normalizeBlog(
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
      baseBlogs.length + addedCount
    );

    blogs.push(generatedBlog);
    blogsBySlug.set(normalizedSlug, generatedBlog);
  });

  return blogs;
}

export function resolveBlogAccessLabel({
  blog,
  protectedContentBySlug,
  isAuthorized,
  isAdmin,
}) {
  if (!blog?.locked) return "open";
  if (!isAuthorized) return "locked";

  const contentItem = protectedContentBySlug.get(getBlogSlug(blog));
  if (canAccessBlog({ blog, contentItem, isAdmin })) return "approved";

  return getContentAccessStatus(contentItem) === "pending" ? "pending" : "locked";
}
