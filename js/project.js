import { AUTH_API_BASE_URL } from "./config.js";

const PROJECT_DATA_URL = "/projects/projects-data.json";
const PROJECT_BASE_PATH = "/projects/";
const AUTH_TOKEN_KEYS = ["auth-token", "access-token", "site-auth-token"];

const endpoints = {
  me: `${AUTH_API_BASE_URL}/api/auth/me`,
  projects: `${AUTH_API_BASE_URL}/api/projects`,
  requestAccess: (projectRef) => `${AUTH_API_BASE_URL}/api/projects/${encodeURIComponent(String(projectRef))}/request-access`,
  content: (projectId) => `${AUTH_API_BASE_URL}/api/projects/${projectId}/content`,
  ssoToken: (projectId) => `${AUTH_API_BASE_URL}/api/projects/${projectId}/sso-token`,
};

const getStoredAuthToken = () => {
  for (const key of AUTH_TOKEN_KEYS) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return "";
};

const apiFetch = async (url, options = {}) => {
  const token = getStoredAuthToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
};

export async function initProject({ navigationController } = {}) {
  const projectPage = document.getElementById("project");
  const mainEl = document.querySelector("main");
  const projectListEl = document.getElementById("projects");
  const projectSearchEl = document.getElementById("project-search");
  const projectCategoriesEl = document.getElementById("project-categories");
  const projectStatusEl = document.getElementById("project-status");
  const requestAccessFormEl = document.getElementById("request-access-form");
  const requestAccessNoteEl = document.getElementById("request-access-note");
  const requestAccessMessageEl = document.getElementById("request-access-message");
  const requestAccessStatusEl = document.getElementById("request-access-status");
  const requestAccessConfirmBtn = document.getElementById("request-access-confirm");
  const requestAccessModalCardEl = document.querySelector("#request-access-modal .modal-card");

  if (!projectPage || !mainEl || !projectListEl || !projectSearchEl || !projectCategoriesEl) return;

  let projects = [];
  let baseProjects = [];
  let selectedCategories = new Set();
  let serverProjectsBySlug = new Map();
  let requestNotesBySlug = new Map();
  let pendingRequestProject = null;
  let pendingRequestServerProject = null;
  const embeddedFrameById = new Map();

  const setProjectStatus = (message) => {
    if (!projectStatusEl) return;
    projectStatusEl.textContent = message || "";
  };

  const setRequestAccessStatus = (message) => {
    if (!requestAccessStatusEl) return;
    requestAccessStatusEl.textContent = message || "";
  };

  const normalizeProject = (project, index) => ({
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
      ? project.categories.map((cat) => String(cat).trim()).filter(Boolean)
      : [],
  });

  const sectionIdForProject = (project) => `project-${project.folder}`;

  const getSharedFolderFromLocation = () => {
    const hash = String(window.location.hash || "").replace(/^#/, "").trim();
    if (!hash.startsWith("s-")) return "";
    return hash.slice(2).trim();
  };

  const getFolderFromLocation = () => {
    const pathname = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
    if (pathname.startsWith("/projects/")) {
      const folder = pathname.slice("/projects/".length).split("/")[0];
      if (folder) return folder;
    }

    if (pathname.startsWith("/project/")) {
      const folder = pathname.slice("/project/".length).split("/")[0];
      if (folder) return folder;
    }

    const hash = window.location.hash.replace("#", "");
    return hash.startsWith("project-") ? hash.replace("project-", "") : "";
  };

  const isAuthorizedUser = () => {
    if (window.__IS_AUTHORIZED_USER === true) return true;
    return AUTH_TOKEN_KEYS.some((key) => {
      try {
        return Boolean(localStorage.getItem(key) || sessionStorage.getItem(key));
      } catch {
        return false;
      }
    });
  };

  const getAuthRole = () => String(window.__AUTH_USER?.role || "").toLowerCase();
  const isAdminUser = () => getAuthRole() === "admin";

  const getServerProjectStatus = (serverProject) => {
    if (!serverProject) return "not_requested";

    const requestStatus = String(serverProject.requestStatus || "").toLowerCase();
    if (requestStatus) return requestStatus;

    const accessStatus = String(serverProject.access_status || "").toLowerCase();
    if (!accessStatus) return "not_requested";
    if (accessStatus === "approved") return "approved";
    return accessStatus;
  };

  const canAccessServerProject = (serverProject, project) => {
    if (!project?.locked) return true;
    if (isAdminUser()) return true;

    if (typeof serverProject?.canAccess === "boolean") {
      return serverProject.canAccess;
    }

    const requestStatus = getServerProjectStatus(serverProject);
    return requestStatus === "approved" || requestStatus === "admin";
  };

  const ensureAuthorizedSession = async () => {
    if (isAuthorizedUser() && window.__AUTH_USER) return true;
    if (!getStoredAuthToken() && !window.__AUTH_USER) return false;

    try {
      const response = await apiFetch(endpoints.me, { method: "GET" });
      if (!response.ok) {
        window.__IS_AUTHORIZED_USER = false;
        return false;
      }
      const body = await response.json().catch(() => ({}));
      window.__IS_AUTHORIZED_USER = true;
      window.__AUTH_USER = body?.user || null;
      return true;
    } catch {
      window.__IS_AUTHORIZED_USER = false;
      return false;
    }
  };

  const loadServerProjects = async () => {
    requestNotesBySlug = new Map();

    if (!isAuthorizedUser()) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        serverProjectsBySlug = new Map();
        return;
      }
    }

    if (!isAuthorizedUser()) {
      serverProjectsBySlug = new Map();
      return;
    }

    try {
      const response = await apiFetch(endpoints.projects);
      if (!response.ok) {
        if (response.status === 401) {
          serverProjectsBySlug = new Map();
          return;
        }
        throw new Error(`Failed to fetch project access list: ${response.status}`);
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.projects) ? payload.projects : [];
      rows.forEach((row) => {
        const slug = String(row?.slug || "").trim();
        const note = String(row?.accessRequestNote || "").trim();
        if (slug && note) {
          requestNotesBySlug.set(slug, note);
        }
      });
      serverProjectsBySlug = new Map(
        rows
          .map((row) => [String(row.slug || "").trim(), row])
          .filter(([slug]) => Boolean(slug))
      );
    } catch (error) {
      console.error("[Project] Failed to load server project access list:", error);
      serverProjectsBySlug = new Map();
    }
  };

  const applyServerProjectCatalog = () => {
    projects = baseProjects.map((project) => ({ ...project }));

    if (!isAuthorizedUser() || !serverProjectsBySlug.size) return;

    const bySlug = new Map(
      projects.map((project) => [String(project.serverProjectSlug || project.folder || "").trim(), project])
    );

    let addedCount = 0;
    serverProjectsBySlug.forEach((row, slug) => {
      const normalizedSlug = String(slug || "").trim();
      if (!normalizedSlug) return;

      const existing = bySlug.get(normalizedSlug);
      const serverDeliveryType = String(row?.deliveryType || "").trim().toLowerCase();
      const serverExternalUrl = String(row?.externalUrl || row?.external_url || "").trim();
      const serverImagePath = String(row?.imagePath || row?.image_path || "").trim();
      const serverDate = String(row?.date || row?.updatedAt || row?.updated_at || "").trim();

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
          categories: ["Server"],
        },
        baseProjects.length + addedCount
      );

      projects.push(generated);
      bySlug.set(normalizedSlug, generated);
    });
  };

  const buildImageUrl = (project) => {
    if (!project.image) return "";
    if (/^https?:\/\//i.test(project.image)) return project.image;
    if (project.image.startsWith("/")) return project.image;
    return `${PROJECT_BASE_PATH}${project.image.replace(/^\/+/, "")}`;
  };

  const buildProjectUrl = (project) => {
    const rawUrl = String(project?.url || "").trim();
    const rawEndpoint = String(project?.serverEndpoint || "").trim();

    const normalizeExternalCandidate = (value) => {
      const candidate = String(value || "").trim();
      if (!candidate) return "";
      if (/^https?:\/\//i.test(candidate)) return candidate;
      if (/^\/\//.test(candidate)) return `https:${candidate}`;
      if (/^([a-z0-9-]+\.)+[a-z]{2,}(?:\/|$)/i.test(candidate)) return `https://${candidate}`;
      return "";
    };

    const normalizedUrl = normalizeExternalCandidate(rawUrl);
    if (normalizedUrl) return normalizedUrl;

    if (rawUrl) return `${PROJECT_BASE_PATH}${rawUrl.replace(/^\/+/, "")}`;

    const normalizedEndpoint = normalizeExternalCandidate(rawEndpoint);
    if (normalizedEndpoint) return normalizedEndpoint;

    if (project.serverEndpoint) {
      try {
        return new URL(project.serverEndpoint, window.location.href).toString();
      } catch {
        return project.serverEndpoint;
      }
    }
    return `${PROJECT_BASE_PATH}${project.folder}/index.html`;
  };

  const resolveRelativeUrl = (baseUrl, maybeRelativeUrl) => {
    try {
      return new URL(maybeRelativeUrl, new URL(baseUrl, window.location.href)).toString();
    } catch {
      return maybeRelativeUrl;
    }
  };

  const removeDynamicProjectSections = () => {
    document.querySelectorAll("section.page[data-project-folder]").forEach((node) => node.remove());
  };

  const ensureProjectSection = (project) => {
    removeDynamicProjectSections();

    const section = document.createElement("section");
    section.id = sectionIdForProject(project);
    section.className = "page project-embedded-page";
    section.dataset.projectFolder = project.folder;
    section.innerHTML = "";
    mainEl.appendChild(section);
    return section;
  };

  const createSandboxedProjectFrame = () => {
    const iframe = document.createElement("iframe");
    iframe.className = "project-embedded-frame";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute(
      "sandbox",
      "allow-forms allow-pointer-lock allow-presentation allow-same-origin allow-scripts"
    );
    const frameId = `project-frame-${Math.random().toString(36).slice(2)}`;
    iframe.dataset.frameId = frameId;
    embeddedFrameById.set(frameId, iframe);
    return iframe;
  };

  const isCrossOriginUrl = (value) => {
    try {
      const target = new URL(String(value || ""), window.location.href);
      return target.origin !== window.location.origin;
    } catch {
      return false;
    }
  };

  const renderHtmlIntoSection = (section, html, sourceUrl) => {
    const iframe = createSandboxedProjectFrame();
    const frameId = String(iframe.dataset.frameId || "");

    // Keep project CSS/JS isolated inside iframe so it cannot leak into main site.
    const srcDoc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${sourceUrl}" />
  <style>html,body{margin:0;padding:0;background:transparent;}</style>
</head>
<body>${String(html || "")}
<script>
(() => {
  const frameId = ${JSON.stringify(frameId)};
  const sendHeight = () => {
    const bodyHeight = document.body ? document.body.scrollHeight : 0;
    const htmlHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
    const height = Math.max(bodyHeight, htmlHeight, 600);
    parent.postMessage({ type: "project-frame-height", frameId, height }, "*");
  };
  window.addEventListener("load", sendHeight);
  window.addEventListener("resize", sendHeight);
  new MutationObserver(sendHeight).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  setInterval(sendHeight, 800);
  sendHeight();
})();
</script>
</body>
</html>`;

    iframe.srcdoc = srcDoc;
    section.innerHTML = "";
    section.appendChild(iframe);
  };

  const renderUrlIntoSection = async (section, sourceUrl) => {
    try {
      if (isCrossOriginUrl(sourceUrl)) {
        const iframe = createSandboxedProjectFrame();
        iframe.src = sourceUrl;
        section.innerHTML = "";
        section.appendChild(iframe);
        return;
      }

      const response = await fetch(sourceUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.status}`);
      }
      const html = await response.text();
      renderHtmlIntoSection(section, html, sourceUrl);
    } catch (error) {
      console.error("[Project] Failed to load project page:", error);
      section.innerHTML = "<p>Failed to load project content.</p>";
    }
  };

  const openLoginWithMessage = (message) => {
    setProjectStatus(message || "Login required for this project.");
    window.dispatchEvent(new CustomEvent("app:open-modal", { detail: { modalId: "login" } }));
  };

  const openRequestAccessModal = (project, serverProject, requestStatus = "not_requested") => {
    pendingRequestProject = project;
    pendingRequestServerProject = serverProject;
    const canSubmit = Boolean(serverProject?.id || project?.serverProjectSlug || project?.folder);

    if (requestAccessMessageEl) {
      if (requestStatus === "pending") {
        requestAccessMessageEl.textContent =
          `Your request for "${project.title}" is waiting approval from admin.`;
      } else if (requestStatus === "rejected") {
        requestAccessMessageEl.textContent =
          `Your request for "${project.title}" was rejected. Send a new message for review.`;
      } else {
        requestAccessMessageEl.textContent =
          `You do not have access to "${project.title}" yet. Send a request message to admin?`;
      }
    }
    if (requestAccessFormEl) requestAccessFormEl.reset();

    const slugKey = String(project?.serverProjectSlug || project?.folder || "").trim();
    const previousNote = String(
      serverProject?.accessRequestNote ||
      requestNotesBySlug.get(slugKey) ||
      ""
    ).trim();
    const isPending = requestStatus === "pending";
    if (requestAccessModalCardEl) {
      requestAccessModalCardEl.classList.toggle("request-access-waiting", isPending);
    }

    if (requestAccessNoteEl) {
      requestAccessNoteEl.value = isPending ? previousNote : "";
      requestAccessNoteEl.disabled = !canSubmit || isPending;
      requestAccessNoteEl.readOnly = isPending;
    }

    if (requestAccessConfirmBtn) {
      requestAccessConfirmBtn.disabled = !canSubmit || isPending;
      requestAccessConfirmBtn.textContent = isPending ? "Waiting Approval" : "Send Request";
    }

    setRequestAccessStatus("");

    window.dispatchEvent(new CustomEvent("app:open-modal", { detail: { modalId: "request-access" } }));
  };

  const requestAccess = async (project, serverProject) => {
    try {
      const note = String(requestAccessNoteEl?.value || "").trim();
      const projectRef = serverProject?.id || project?.serverProjectSlug || project?.folder;
      if (!note) {
        setRequestAccessStatus("Please enter a message.");
        return false;
      }
      if (!projectRef) {
        setRequestAccessStatus("Project reference missing. Please try again.");
        return false;
      }

      const response = await apiFetch(endpoints.requestAccess(projectRef), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note,
          projectTitle: project?.title || "",
          projectDescription: project?.description || "",
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fallbackMessage = response.status === 409
          ? "Access request already submitted."
          : "Failed to submit access request.";
        const errorMessage = body.error || fallbackMessage;
        setProjectStatus(errorMessage);
        setRequestAccessStatus(errorMessage);
        return false;
      }

      setProjectStatus("Access request sent. Waiting for admin approval.");
      setRequestAccessStatus("Access request sent.");
      const slugKey = String(project?.serverProjectSlug || project?.folder || "").trim();
      const savedNote = String(body?.request?.note || note).trim();
      if (slugKey && savedNote) {
        requestNotesBySlug.set(slugKey, savedNote);
      }
      await loadServerProjects();
      applyServerProjectCatalog();
      renderCategories();
      renderProjects();
      return true;
    } catch {
      setProjectStatus("Failed to submit access request.");
      setRequestAccessStatus("Failed to submit access request.");
      return false;
    }
  };

  const loadServerLockedContent = async (project, serverProject, { push = true } = {}) => {
    try {
      const serverDeliveryType = String(serverProject?.deliveryType || "").trim().toLowerCase();
      const clientDeliveryType = String(project?.lockedDelivery || "").trim().toLowerCase();
      const effectiveDeliveryType =
        serverDeliveryType === "link" || serverDeliveryType === "content"
          ? serverDeliveryType
          : (clientDeliveryType === "sso" || clientDeliveryType === "link" ? "link" : "content");

      if (effectiveDeliveryType === "link") {
        const redirectBase = project.serverEndpoint || serverProject.externalUrl || serverProject.external_url;
        if (!redirectBase) {
          setProjectStatus("No redirect URL configured for this locked project.");
          return;
        }
        window.location.href = new URL(redirectBase, window.location.href).toString();
        return;
      }

      const contentRes = await apiFetch(endpoints.content(serverProject.id));
      const body = await contentRes.json().catch(() => ({}));
      if (!contentRes.ok) {
        setProjectStatus(body.error || "Failed to load locked project content.");
        return;
      }

      const section = ensureProjectSection(project);
      renderHtmlIntoSection(section, String(body.htmlContent || ""), endpoints.content(serverProject.id));
      if (navigationController && typeof navigationController.navigateTo === "function") {
        navigationController.navigateTo(sectionIdForProject(project), { push });
        const sharedSlug = String(project?.serverProjectSlug || project?.folder || "").trim();
        if (sharedSlug) {
          history.replaceState({ type: "page", targetId: sectionIdForProject(project) }, "", `/#s-${sharedSlug}`);
        }
      }
    } catch {
      setProjectStatus("Failed to load locked project content.");
    }
  };

  const openProject = async (project, { push = true } = {}) => {
    if (!project || !project.folder) return;
    setProjectStatus("");
    const serverProject = serverProjectsBySlug.get(project.serverProjectSlug);
    const serverDeliveryType = String(serverProject?.deliveryType || "").trim().toLowerCase();
    const projectDeliveryType = String(project?.lockedDelivery || "").trim().toLowerCase();
    const redirectTarget = String(
      project?.serverEndpoint || serverProject?.externalUrl || serverProject?.external_url || buildProjectUrl(project)
    ).trim();

    if ((serverDeliveryType === "link" || projectDeliveryType === "link") && redirectTarget) {
      try {
        window.open(new URL(redirectTarget, window.location.href).toString(), "_blank", "noopener,noreferrer");
      } catch {
        window.open(redirectTarget, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (project.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project is locked. Please login and request access.");
        return;
      }

      if (!serverProject) {
        await loadServerProjects();
        const refreshedProject = serverProjectsBySlug.get(project.serverProjectSlug);
        openRequestAccessModal(project, refreshedProject || null, "not_requested");
        return;
      }

      if (!canAccessServerProject(serverProject, project)) {
        const requestStatus = getServerProjectStatus(serverProject);
        openRequestAccessModal(project, serverProject, requestStatus);
        return;
      }

      await loadServerLockedContent(project, serverProject, { push });
      return;
    }

    if (
      serverProject &&
      String(serverProject.deliveryType || "").trim().toLowerCase() === "content" &&
      String(project.id || "").startsWith("server-")
    ) {
      await loadServerLockedContent(project, serverProject, { push });
      return;
    }

    const sectionId = sectionIdForProject(project);
    const section = ensureProjectSection(project);
    const projectUrl = buildProjectUrl(project);

    await renderUrlIntoSection(section, projectUrl);

    if (navigationController && typeof navigationController.navigateTo === "function") {
      navigationController.navigateTo(sectionId, { push });
      if (serverProject) {
        const sharedSlug = String(project?.serverProjectSlug || project?.folder || "").trim();
        if (sharedSlug) {
          history.replaceState({ type: "page", targetId: sectionId }, "", `/#s-${sharedSlug}`);
        }
      }
    } else {
      window.location.hash = sectionId;
    }
  };

  const openProjectByFolder = async (folder, { push = false } = {}) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) return;

    const knownProject = projects.find((item) => item.folder === normalizedFolder);
    const fallbackProject = {
      folder: normalizedFolder,
      title: `Project ${normalizedFolder}`,
      url: `${normalizedFolder}/index.html`,
      locked: false,
      serverProjectSlug: normalizedFolder,
      lockedDelivery: "content",
    };

    await openProject(knownProject || fallbackProject, { push });
  };

  const openSharedProjectBySlug = async (slug, { push = false } = {}) => {
    const normalizedSlug = String(slug || "").trim();
    if (!normalizedSlug) return;

    const hasSession = await ensureAuthorizedSession();
    if (!hasSession) {
      openLoginWithMessage("This shared project requires login.");
      return;
    }

    await loadServerProjects();
    applyServerProjectCatalog();

    const serverProject = serverProjectsBySlug.get(normalizedSlug);
    if (!serverProject) {
      setProjectStatus("Shared project is unavailable.");
      return;
    }

    const knownProject = projects.find((item) => item.serverProjectSlug === normalizedSlug || item.folder === normalizedSlug);
    const fallbackProject = normalizeProject(
      {
        id: `server-${normalizedSlug}`,
        folder: normalizedSlug,
        title: String(serverProject.title || normalizedSlug),
        date: String(serverProject.date || serverProject.updatedAt || serverProject.updated_at || "").slice(0, 10),
        description: String(serverProject.description || ""),
        image: String(serverProject.imagePath || serverProject.image_path || ""),
        locked: Boolean(serverProject.locked),
        serverProjectSlug: normalizedSlug,
        lockedDelivery: String(serverProject.deliveryType || "content"),
        serverEndpoint: String(serverProject.externalUrl || serverProject.external_url || ""),
      },
      0
    );

    const targetProject = knownProject || fallbackProject;

    if (!canAccessServerProject(serverProject, targetProject)) {
      const requestStatus = getServerProjectStatus(serverProject);
      openRequestAccessModal(targetProject, serverProject, requestStatus);
      return;
    }

    await loadServerLockedContent(targetProject, serverProject, { push });
  };

  const projectAccessLabel = (project) => {
    if (!project.locked) return "open";
    if (!isAuthorizedUser()) return "locked";

    const row = serverProjectsBySlug.get(project.serverProjectSlug);
    if (canAccessServerProject(row, project)) return "approved";
    const requestStatus = getServerProjectStatus(row);
    return requestStatus === "pending" ? "pending" : "locked";
  };

  const createProjectItem = (project) => {
    const accessLabel = projectAccessLabel(project);

    const item = document.createElement("article");
    item.className = "blog-item project-item";
    if (project.locked) item.classList.add("project-item-locked");
    if (accessLabel === "approved") item.classList.add("project-item-approved");
    if (accessLabel === "pending") item.classList.add("project-item-pending");
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Open project ${project.title}`);

    const media = document.createElement("div");
    media.className = "blog-item-media";
    const imageUrl = buildImageUrl(project);
    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "blog-item-image";
      img.src = imageUrl;
      img.alt = project.title;
      img.loading = "lazy";
      media.appendChild(img);
    } else {
      media.classList.add("blog-item-media-empty");
    }
    item.appendChild(media);

    const details = document.createElement("div");
    details.className = "blog-item-details";

    const title = document.createElement("h3");
    title.textContent = project.title;
    details.appendChild(title);

    if (project.locked && accessLabel !== "approved") {
      const lockIcon = document.createElement("span");
      lockIcon.className = "project-lock-icon";
      if (accessLabel === "pending") {
        lockIcon.classList.add("project-lock-icon-awaiting");
        lockIcon.setAttribute("aria-label", "Awaiting access");
        lockIcon.setAttribute("title", "Awaiting access");
        lockIcon.textContent = "⏳";
      } else {
        lockIcon.setAttribute("aria-label", "Locked project");
        lockIcon.setAttribute("title", "Locked project");
        lockIcon.textContent = "🔒";
      }
      item.appendChild(lockIcon);
    }

    if (project.date) {
      const date = document.createElement("p");
      date.className = "blog-item-date";
      date.textContent = project.date;
      details.appendChild(date);
    }

    if (project.description) {
      const description = document.createElement("p");
      description.className = "blog-item-description";
      description.textContent = project.description;
      details.appendChild(description);
    }

    item.appendChild(details);

    const openHandler = () => openProject(project, { push: true });
    item.addEventListener("click", openHandler);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openHandler();
      }
    });

    return item;
  };

  const renderCategories = () => {
    projectCategoriesEl.innerHTML = "";
    const counts = new Map();

    projects.forEach((project) => {
      project.categories.forEach((cat) => {
        counts.set(cat, (counts.get(cat) || 0) + 1);
      });
    });

    counts.forEach((count, category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "blog-category-button";

      const label = document.createElement("span");
      label.className = "blog-category-label";
      label.textContent = category;

      const countEl = document.createElement("span");
      countEl.className = "blog-category-count";
      countEl.textContent = String(count);

      button.appendChild(label);
      button.appendChild(countEl);

      button.addEventListener("click", () => {
        if (selectedCategories.has(category)) {
          selectedCategories.delete(category);
          button.classList.remove("blog-category-active");
        } else {
          selectedCategories.add(category);
          button.classList.add("blog-category-active");
        }
        renderProjects();
      });

      projectCategoriesEl.appendChild(button);
    });
  };

  const getFilteredProjects = () => {
    const query = projectSearchEl.value.trim().toLowerCase();
    const byCategory = selectedCategories.size
      ? projects.filter(
          (project) =>
            project.categories.length > 0 &&
            project.categories.some((cat) => selectedCategories.has(cat))
        )
      : projects;

    if (!query) return byCategory;

    return byCategory.filter((project) => {
      const haystack = [project.title, project.description, project.date, ...project.categories]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  };

  const renderProjects = () => {
    const filtered = getFilteredProjects();
    projectListEl.innerHTML = "";

    if (!filtered.length) {
      projectListEl.innerHTML = "<p>No projects found.</p>";
      return filtered;
    }

    filtered.forEach((project) => {
      projectListEl.appendChild(createProjectItem(project));
    });

    return filtered;
  };

  const tryOpenFromLocation = () => {
    const sharedFolder = getSharedFolderFromLocation();
    if (sharedFolder) {
      openSharedProjectBySlug(sharedFolder, { push: false });
      return;
    }
    const folderFromLocation = getFolderFromLocation();
    if (!folderFromLocation) return;
    openProjectByFolder(folderFromLocation, { push: false });
  };

  const refreshAuthSensitiveState = async () => {
    await ensureAuthorizedSession();
    await loadServerProjects();
    applyServerProjectCatalog();
    renderCategories();
    renderProjects();
    tryOpenFromLocation();
  };

  projectSearchEl.addEventListener("input", renderProjects);
  projectSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const filtered = renderProjects();
    if (filtered.length) {
      openProject(filtered[0], { push: true });
    }
  });

  window.addEventListener("auth:changed", refreshAuthSensitiveState);
  window.addEventListener("message", (event) => {
    const data = event?.data;
    if (!data || data.type !== "project-frame-height") return;
    const frame = embeddedFrameById.get(String(data.frameId || ""));
    if (!frame) return;
    const nextHeight = Number(data.height);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    frame.style.height = `${Math.max(600, Math.round(nextHeight))}px`;
  });

  if (requestAccessFormEl && requestAccessConfirmBtn) {
    requestAccessFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!pendingRequestProject) {
        setRequestAccessStatus("No project selected.");
        return;
      }
      requestAccessConfirmBtn.disabled = true;
      const submitted = await requestAccess(pendingRequestProject, pendingRequestServerProject);
      requestAccessConfirmBtn.disabled = false;
      requestAccessConfirmBtn.textContent = "Send Request";
      if (!submitted) return;
      window.dispatchEvent(new CustomEvent("app:close-modal"));
      pendingRequestProject = null;
      pendingRequestServerProject = null;
      if (requestAccessFormEl) requestAccessFormEl.reset();
      if (requestAccessNoteEl) requestAccessNoteEl.disabled = false;
      setRequestAccessStatus("");
    });
  }

  try {
    const response = await fetch(PROJECT_DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load projects: ${response.status}`);
    }

    const data = await response.json();
    const source = Array.isArray(data) ? data : data?.projects;
    baseProjects = Array.isArray(source)
      ? source.map((project, index) => normalizeProject(project, index)).filter((project) => project.folder)
      : [];
    projects = baseProjects.map((project) => ({ ...project }));

    await ensureAuthorizedSession();
    await loadServerProjects();
    applyServerProjectCatalog();
    renderCategories();
    renderProjects();
    tryOpenFromLocation();

    window.addEventListener("popstate", tryOpenFromLocation);
    window.addEventListener("hashchange", tryOpenFromLocation);
  } catch (error) {
    console.error("[Project] Failed to initialize project module:", error);
    projectListEl.innerHTML = "<p>Failed to load projects.</p>";
  }
}
