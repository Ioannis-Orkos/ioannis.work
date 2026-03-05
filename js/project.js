const PROJECT_DATA_URL = "/projects/projects-data.json";
const PROJECT_BASE_PATH = "/projects/";
const AUTH_TOKEN_KEYS = ["auth-token", "access-token", "site-auth-token"];

export async function initProject({ navigationController } = {}) {
  const projectPage = document.getElementById("project");
  const mainEl = document.querySelector("main");
  const projectListEl = document.getElementById("projects");
  const projectSearchEl = document.getElementById("project-search");
  const projectCategoriesEl = document.getElementById("project-categories");

  if (!projectPage || !mainEl || !projectListEl || !projectSearchEl || !projectCategoriesEl) return;

  let projects = [];
  let selectedCategories = new Set();

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

    // Backward compatibility if older route was used.
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

  const buildImageUrl = (project) => {
    if (!project.image) return "";
    return `${PROJECT_BASE_PATH}${project.image.replace(/^\/+/, "")}`;
  };

  const buildProjectUrl = (project) => {
    if (project.serverEndpoint) return project.serverEndpoint;
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

    // Preserve project-local styles so embedded pages match standalone rendering.
    const styleNodes = [
      ...doc.querySelectorAll('head style, head link[rel="stylesheet"]'),
    ];
    styleNodes.reverse().forEach((node) => {
      const clone = node.cloneNode(true);
      if (clone.tagName.toLowerCase() === "link") {
        const href = clone.getAttribute("href");
        if (href) {
          clone.setAttribute("href", resolveRelativeUrl(sourceUrl, href));
        }
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
      if (!oldScript.src) {
        nextScript.textContent = oldScript.textContent;
      }
      oldScript.replaceWith(nextScript);
    });

    section.innerHTML = "";
    section.appendChild(contentRoot);
  };

  const renderLockedSection = (section, project) => {
    section.innerHTML = `
      <div class="blog-loaded-content">
        <h2>${project.title}</h2>
        <p>This project is locked. Please login with an authorized account to view it.</p>
      </div>
    `;
  };

  const openProject = async (project, { push = true } = {}) => {
    if (!project || !project.folder) return;

    const sectionId = sectionIdForProject(project);
    const section = ensureProjectSection(project);

    if (project.locked && !isAuthorizedUser()) {
      renderLockedSection(section, project);
      if (navigationController && typeof navigationController.navigateTo === "function") {
        navigationController.navigateTo(sectionId, { push });
      }
      return;
    }

    const projectUrl = buildProjectUrl(project);

    try {
      const response = await fetch(projectUrl, {
        credentials: "include",
      });

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
    };

    await openProject(knownProject || fallbackProject, { push });
  };

  const createProjectItem = (project) => {
    const item = document.createElement("article");
    item.className = "blog-item";
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
    title.textContent = project.locked ? `${project.title} (Locked)` : project.title;
    details.appendChild(title);

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

  projectSearchEl.addEventListener("input", renderProjects);
  projectSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const filtered = renderProjects();
    if (filtered.length) {
      openProject(filtered[0], { push: true });
    }
  });

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
