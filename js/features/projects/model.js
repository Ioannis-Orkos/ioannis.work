import { PROJECT_BASE_PATH } from "../../shared/config.js";

export function normalizeProject(project, index) {
  return {
    id: String(project?.id || `project-${index + 1}`),
    folder: String(project?.folder || "").trim(),
    title: String(project?.title || `Project ${index + 1}`),
    date: String(project?.date || ""),
    description: String(project?.description || ""),
    image: String(project?.image || ""),
    url: String(project?.url || ""),
    locked: Boolean(project?.locked),
    serverEndpoint: String(project?.serverEndpoint || "").trim(),
    serverProjectSlug: String(project?.serverProjectSlug || project?.folder || "").trim(),
    lockedDelivery: String(project?.lockedDelivery || "content").trim(),
    categories: Array.isArray(project?.categories)
      ? project.categories.map((category) => String(category).trim()).filter(Boolean)
      : [],
  };
}

export function getProjectSlug(project) {
  return String(project?.serverProjectSlug || project?.folder || "").trim();
}

export function sectionIdForProject(project) {
  return `project-${project.folder}`;
}

export function getServerProjectStatus(serverProject) {
  if (!serverProject) return "not_requested";

  const requestStatus = String(serverProject.requestStatus || "").toLowerCase();
  if (requestStatus) return requestStatus;

  const accessStatus = String(serverProject.access_status || "").toLowerCase();
  if (!accessStatus) return "not_requested";
  if (accessStatus === "approved") return "approved";
  return accessStatus;
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

export function buildProjectUrl(project) {
  const rawUrl = String(project?.url || "").trim();
  const rawEndpoint = String(project?.serverEndpoint || "").trim();

  const normalizedUrl = normalizeExternalCandidate(rawUrl);
  if (normalizedUrl) return normalizedUrl;

  if (rawUrl) return `${PROJECT_BASE_PATH}${rawUrl.replace(/^\/+/, "")}`;

  const normalizedEndpoint = normalizeExternalCandidate(rawEndpoint);
  if (normalizedEndpoint) return normalizedEndpoint;

  if (project?.serverEndpoint) {
    try {
      return new URL(project.serverEndpoint, window.location.href).toString();
    } catch {
      return project.serverEndpoint;
    }
  }

  return `${PROJECT_BASE_PATH}${project.folder}/index.html`;
}

export function createFallbackProject(folder) {
  return {
    folder,
    title: `Project ${folder}`,
    url: `${folder}/index.html`,
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
      date: String(serverProject?.date || serverProject?.updatedAt || serverProject?.updated_at || "").trim(),
      description: String(serverProject?.description || ""),
      image: String(serverProject?.imagePath || serverProject?.image_path || ""),
      locked: Boolean(serverProject?.locked),
      serverProjectSlug: slug,
      lockedDelivery: String(serverProject?.deliveryType || "content"),
      serverEndpoint: String(serverProject?.externalUrl || serverProject?.external_url || ""),
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
    const serverDeliveryType = String(row?.deliveryType || "").trim().toLowerCase();
    const serverExternalUrl = String(row?.externalUrl || row?.external_url || "").trim();
    const serverImagePath = String(row?.imagePath || row?.image_path || "").trim();
    const serverDate = String(row?.date || row?.updatedAt || row?.updated_at || "").trim();
    const serverCategories = Array.isArray(row?.categories)
      ? row.categories.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (existing) {
      existing.locked = Boolean(row?.locked ?? existing.locked);
      if (serverDeliveryType === "link" || serverDeliveryType === "content") {
        existing.lockedDelivery = serverDeliveryType;
      }
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
        lockedDelivery: serverDeliveryType === "link" ? "link" : "content",
        serverEndpoint: serverExternalUrl,
        url: serverExternalUrl || `${normalizedSlug}/index.html`,
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
