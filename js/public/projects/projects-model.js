import { LOCAL_EMBED_FILE_NAME, PROJECT_BASE_PATH } from "../../shared/config.js";
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
  return candidate
    .replace(/\/embed\.html$/i, `/${LOCAL_EMBED_FILE_NAME}`)
    .replace(/\/index\.html$/i, `/${LOCAL_EMBED_FILE_NAME}`);
}

export function normalizeProject(project, index) {
  const folder = String(project?.folder || "").trim();

  return {
    id: String(project?.id || `project-${index + 1}`),
    folder,
    title: String(project?.title || `Project ${index + 1}`).trim(),
    date: String(project?.date || "").trim(),
    description: String(project?.description || "").trim(),
    image: String(project?.image || "").trim(),
    url: String(project?.url || "").trim(),
    locked: Boolean(project?.locked),
    contentEndpoint: String(project?.contentEndpoint || project?.serverEndpoint || "").trim(),
    contentSlug: String(project?.contentSlug || project?.serverProjectSlug || folder).trim(),
    lockedDelivery: normalizeDeliveryType(project?.lockedDelivery),
    categories: normalizeStringArray(project?.categories),
  };
}

export function getProjectSlug(project) {
  return String(project?.contentSlug || project?.folder || "").trim();
}

export function filterProjects({ projects, query, selectedCategories }) {
  return filterCatalogItems({
    items: projects,
    query,
    selectedCategories,
    getCategories: (project) => project.categories,
    getSearchText: (project) => [project.title, project.description, project.date, ...project.categories].join(" "),
  });
}

export function sectionIdForProject(project) {
  return `project-${project.folder}`;
}

export function getContentAccessStatus(contentItem) {
  return String(contentItem?.requestStatus || "not_requested").toLowerCase();
}

export function canAccessProject({ project, contentItem, isAdmin = false }) {
  if (!project?.locked) return true;
  if (isAdmin) return true;

  if (typeof contentItem?.canAccess === "boolean") {
    return contentItem.canAccess;
  }

  const requestStatus = getContentAccessStatus(contentItem);
  return requestStatus === "approved" || requestStatus === "admin";
}

export function buildProjectImageUrl(project) {
  const rawImage = String(project?.image || "").trim();
  if (!rawImage) return "";
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
  return `${PROJECT_BASE_PATH}${rawImage.replace(/^\/+/, "")}`;
}

export function buildProjectContentUrl(project) {
  const rawUrl = String(project?.url || "").trim();
  const rawEndpoint = String(project?.contentEndpoint || "").trim();

  const normalizedUrl = normalizeExternalCandidate(rawUrl);
  if (normalizedUrl) return normalizedUrl;

  if (rawUrl) return `${PROJECT_BASE_PATH}${normalizeLocalContentPath(rawUrl)}`;

  const normalizedEndpoint = normalizeExternalCandidate(rawEndpoint);
  if (normalizedEndpoint) return normalizedEndpoint;

  if (project?.contentEndpoint) {
    try {
      return new URL(project.contentEndpoint, window.location.href).toString();
    } catch {
      return project.contentEndpoint;
    }
  }

  return `${PROJECT_BASE_PATH}${project.folder}/${LOCAL_EMBED_FILE_NAME}`;
}

export function buildProjectPublicPath(project) {
  const folder = String(project?.folder || "").trim();
  return folder ? `${PROJECT_BASE_PATH}${folder}/` : "/project";
}

export function createFallbackProject(folder) {
  return {
    folder,
    title: `Project ${folder}`,
    url: `${folder}/${LOCAL_EMBED_FILE_NAME}`,
    locked: false,
    contentSlug: folder,
    lockedDelivery: "content",
  };
}

export function createProjectFromContentItem(contentItem, slug) {
  return normalizeProject(
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

export function mergeProjectCatalog({ baseProjects, protectedContentBySlug, isAuthorized }) {
  const projects = baseProjects.map((project) => ({
    ...project,
    categories: [...project.categories],
  }));

  if (!isAuthorized || !protectedContentBySlug.size) {
    return projects;
  }

  const projectsBySlug = new Map(projects.map((project) => [getProjectSlug(project), project]));
  let addedCount = 0;

  protectedContentBySlug.forEach((contentItem, slug) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) return;

    const existingProject = projectsBySlug.get(normalizedSlug);
    const contentDeliveryType = normalizeDeliveryType(contentItem?.deliveryType);
    const contentExternalUrl = String(contentItem?.externalUrl || "").trim();
    const contentImagePath = String(contentItem?.imagePath || "").trim();
    const contentDate = String(contentItem?.date || "").trim();
    const contentCategories = normalizeStringArray(contentItem?.categories);

    if (existingProject) {
      existingProject.locked = Boolean(contentItem?.locked ?? existingProject.locked);
      existingProject.lockedDelivery = contentDeliveryType;
      if (contentExternalUrl) {
        existingProject.contentEndpoint = contentExternalUrl;
      }
      if (contentImagePath) {
        existingProject.image = contentImagePath;
      }
      if (contentDate) {
        existingProject.date = contentDate;
      }
      if (contentCategories.length) {
        existingProject.categories = contentCategories;
      }
      if (!existingProject.title && contentItem?.title) {
        existingProject.title = String(contentItem.title);
      }
      if (!existingProject.description && contentItem?.description) {
        existingProject.description = String(contentItem.description);
      }
      return;
    }

    addedCount += 1;
    const generatedProject = normalizeProject(
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
      baseProjects.length + addedCount
    );

    projects.push(generatedProject);
    projectsBySlug.set(normalizedSlug, generatedProject);
  });

  return projects;
}

export function resolveProjectAccessLabel({
  project,
  protectedContentBySlug,
  isAuthorized,
  isAdmin,
}) {
  if (!project?.locked) return "open";
  if (!isAuthorized) return "locked";

  const contentItem = protectedContentBySlug.get(getProjectSlug(project));
  if (canAccessProject({ project, contentItem, isAdmin })) return "approved";

  return getContentAccessStatus(contentItem) === "pending" ? "pending" : "locked";
}
