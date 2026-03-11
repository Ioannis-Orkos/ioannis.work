import { LOCAL_EMBED_FILE_NAME, PROJECT_BASE_PATH } from "../../shared/config.js";
import { filterCatalogItems } from "../../shared/catalog.js";
import { normalizeStringArray } from "../../shared/normalize.js";

function normalizeDeliveryType(value) {
  return String(value || "content").trim().toLowerCase() === "link" ? "link" : "content";
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
    serverEndpoint: String(project?.serverEndpoint || "").trim(),
    serverProjectSlug: String(project?.serverProjectSlug || folder).trim(),
    lockedDelivery: normalizeDeliveryType(project?.lockedDelivery),
    categories: normalizeStringArray(project?.categories),
  };
}

export function getProjectSlug(project) {
  return String(project?.serverProjectSlug || project?.folder || "").trim();
}

export function filterProjects({ projects, query, selectedCategories }) {
  return filterCatalogItems({
    items: projects,
    query,
    selectedCategories,
    getCategories: (project) => project.categories,
    getSearchText: (project) =>
      [project.title, project.description, project.date, ...project.categories].join(" "),
  });
}

export function sectionIdForProject(project) {
  return `project-${project.folder}`;
}

export function getServerProjectStatus(serverProject) {
  return String(serverProject?.requestStatus || "not_requested").toLowerCase();
}

export function canAccessProject({ project, serverProject, isAdmin = false }) {
  if (!project?.locked) return true;
  if (isAdmin) return true;

  if (typeof serverProject?.canAccess === "boolean") {
    return serverProject.canAccess;
  }

  const requestStatus = getServerProjectStatus(serverProject);
  return requestStatus === "approved" || requestStatus === "admin";
}

export function buildProjectImageUrl(project) {
  const rawImage = String(project?.image || "").trim();
  if (!rawImage) return "";
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
  return `${PROJECT_BASE_PATH}${rawImage.replace(/^\/+/, "")}`;
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

export function buildProjectContentUrl(project) {
  const rawUrl = String(project?.url || "").trim();
  const rawEndpoint = String(project?.serverEndpoint || "").trim();

  const normalizedUrl = normalizeExternalCandidate(rawUrl);
  if (normalizedUrl) return normalizedUrl;

  if (rawUrl) return `${PROJECT_BASE_PATH}${normalizeLocalContentPath(rawUrl)}`;

  const normalizedEndpoint = normalizeExternalCandidate(rawEndpoint);
  if (normalizedEndpoint) return normalizedEndpoint;

  if (project?.serverEndpoint) {
    try {
      return new URL(project.serverEndpoint, window.location.href).toString();
    } catch {
      return project.serverEndpoint;
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
    serverProjectSlug: folder,
    lockedDelivery: "content",
  };
}

export function createProjectFromServer(serverProject, slug) {
  return normalizeProject(
    {
      id: `server-${slug}`,
      folder: slug,
      title: String(serverProject?.title || slug),
      date: String(serverProject?.date || "").trim(),
      description: String(serverProject?.description || ""),
      image: String(serverProject?.imagePath || ""),
      locked: Boolean(serverProject?.locked),
      serverProjectSlug: slug,
      lockedDelivery: normalizeDeliveryType(serverProject?.deliveryType),
      serverEndpoint: String(serverProject?.externalUrl || ""),
      categories: serverProject?.categories,
    },
    0
  );
}

export function mergeProjectCatalog({ baseProjects, serverProjectsBySlug, isAuthorized }) {
  const projects = baseProjects.map((project) => ({
    ...project,
    categories: [...project.categories],
  }));

  if (!isAuthorized || !serverProjectsBySlug.size) {
    return projects;
  }

  const bySlug = new Map(projects.map((project) => [getProjectSlug(project), project]));
  let addedCount = 0;

  serverProjectsBySlug.forEach((row, slug) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) return;

    const existing = bySlug.get(normalizedSlug);
    const serverDeliveryType = normalizeDeliveryType(row?.deliveryType);
    const serverExternalUrl = String(row?.externalUrl || "").trim();
    const serverImagePath = String(row?.imagePath || "").trim();
    const serverDate = String(row?.date || "").trim();
    const serverCategories = normalizeStringArray(row?.categories);

    if (existing) {
      existing.locked = Boolean(row?.locked ?? existing.locked);
      existing.lockedDelivery = serverDeliveryType;
      if (serverExternalUrl) {
        existing.serverEndpoint = serverExternalUrl;
      }
      if (serverImagePath) {
        existing.image = serverImagePath;
      }
      if (serverDate) {
        existing.date = serverDate;
      }
      if (serverCategories.length) {
        existing.categories = serverCategories;
      }
      if (!existing.title && row?.title) {
        existing.title = String(row.title);
      }
      if (!existing.description && row?.description) {
        existing.description = String(row.description);
      }
      return;
    }

    addedCount += 1;
    const generated = normalizeProject(
      {
        id: `server-${normalizedSlug}`,
        folder: normalizedSlug,
        title: String(row?.title || normalizedSlug),
        date: serverDate,
        description: String(row?.description || ""),
        image: serverImagePath,
      locked: Boolean(row?.locked),
      serverProjectSlug: normalizedSlug,
      lockedDelivery: serverDeliveryType,
      serverEndpoint: serverExternalUrl,
      url: serverExternalUrl || `${normalizedSlug}/${LOCAL_EMBED_FILE_NAME}`,
      categories: serverCategories.length ? serverCategories : ["Server"],
    },
    baseProjects.length + addedCount
    );

    projects.push(generated);
    bySlug.set(normalizedSlug, generated);
  });

  return projects;
}

export function resolveProjectAccessLabel({
  project,
  serverProjectsBySlug,
  isAuthorized,
  isAdmin,
}) {
  if (!project?.locked) return "open";
  if (!isAuthorized) return "locked";

  const row = serverProjectsBySlug.get(getProjectSlug(project));
  if (canAccessProject({ project, serverProject: row, isAdmin })) return "approved";

  return getServerProjectStatus(row) === "pending" ? "pending" : "locked";
}
