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
  let selectedCategories = new Set();
  let serverProjectsBySlug = new Map();
  let requestNotesBySlug = new Map();
  let pendingRequestProject = null;
  let pendingRequestServerProject = null;

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

  const buildImageUrl = (project) => {
    if (!project.image) return "";
    return `${PROJECT_BASE_PATH}${project.image.replace(/^\/+/, "")}`;
  };

  const buildProjectUrl = (project) => {
    if (/^https?:\/\//i.test(project.url)) return project.url;
    if (project.url) return `${PROJECT_BASE_PATH}${project.url.replace(/^\/+/, "")}`;
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
    section.className = "page";
    section.dataset.projectFolder = project.folder;
    section.innerHTML = '<p class="blog-loading">Loading project...</p>';
    mainEl.appendChild(section);
    return section;
  };

  const renderHtmlIntoSection = (section, html, sourceUrl) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const contentRoot = document.createElement("div");
    contentRoot.className = "blog-loaded-content";

    contentRoot.innerHTML = doc.body ? doc.body.innerHTML : html;

    const styleNodes = [...doc.querySelectorAll('head style, head link[rel="stylesheet"]')];
    styleNodes.reverse().forEach((node) => {
      const clone = node.cloneNode(true);
      if (clone.tagName.toLowerCase() === "link") {
        const href = clone.getAttribute("href");
        if (href) clone.setAttribute("href", resolveRelativeUrl(sourceUrl, href));
      }
      contentRoot.prepend(clone);
    });

    contentRoot.querySelectorAll("[src]").forEach((el) => {
      el.setAttribute("src", resolveRelativeUrl(sourceUrl, el.getAttribute("src")));
    });
    contentRoot.querySelectorAll("[href]").forEach((el) => {
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      el.setAttribute("href", resolveRelativeUrl(sourceUrl, href));
    });

    const scriptNodes = [...contentRoot.querySelectorAll("script")];
    scriptNodes.forEach((oldScript) => {
      const nextScript = document.createElement("script");
      [...oldScript.attributes].forEach((attr) => {
        if (attr.name === "src") {
          nextScript.setAttribute("src", resolveRelativeUrl(sourceUrl, attr.value));
          return;
        }
        nextScript.setAttribute(attr.name, attr.value);
      });
      if (!oldScript.src) nextScript.textContent = oldScript.textContent;
      oldScript.replaceWith(nextScript);
    });

    section.innerHTML = "";
    section.appendChild(contentRoot);
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
      if (project.lockedDelivery === "sso") {
        const tokenRes = await apiFetch(endpoints.ssoToken(serverProject.id), {
          method: "POST",
        });
        const tokenBody = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenBody?.ssoToken) {
          setProjectStatus(tokenBody.error || "Failed to generate SSO token.");
          return;
        }

        const redirectBase = project.serverEndpoint || serverProject.external_url;
        if (!redirectBase) {
          setProjectStatus("No redirect URL configured for this locked project.");
          return;
        }

        const target = new URL(redirectBase, window.location.href);
        target.searchParams.set("ssoToken", tokenBody.ssoToken);
        window.location.href = target.toString();
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
      }
    } catch {
      setProjectStatus("Failed to load locked project content.");
    }
  };

  const openProject = async (project, { push = true } = {}) => {
    if (!project || !project.folder) return;
    setProjectStatus("");

    if (project.locked) {
      const hasSession = await ensureAuthorizedSession();
      if (!hasSession) {
        openLoginWithMessage("This project is locked. Please login and request access.");
        return;
      }

      const serverProject = serverProjectsBySlug.get(project.serverProjectSlug);
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

    const sectionId = sectionIdForProject(project);
    const section = ensureProjectSection(project);
    const projectUrl = buildProjectUrl(project);

    try {
      const response = await fetch(projectUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to load project: ${response.status}`);
      }
      const html = await response.text();
      renderHtmlIntoSection(section, html, projectUrl);
    } catch (error) {
      console.error("[Project] Failed to load project page:", error);
      section.innerHTML = "<p>Failed to load project content.</p>";
    }

    if (navigationController && typeof navigationController.navigateTo === "function") {
      navigationController.navigateTo(sectionId, { push });
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

    const imageUrl = buildImageUrl(project);
    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "blog-item-image";
      img.src = imageUrl;
      img.alt = project.title;
      img.loading = "lazy";
      item.appendChild(img);
    }

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
    const folderFromLocation = getFolderFromLocation();
    if (!folderFromLocation) return;
    openProjectByFolder(folderFromLocation, { push: false });
  };

  const refreshAuthSensitiveState = async () => {
    await loadServerProjects();
    renderProjects();
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
    projects = Array.isArray(source)
      ? source.map((project, index) => normalizeProject(project, index)).filter((project) => project.folder)
      : [];

    await loadServerProjects();
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
