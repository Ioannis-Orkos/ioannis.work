import { collectCategoryCounts, filterCatalogItems } from "../../shared/catalog.js";

export function getFilteredProjects({ projects, query, selectedCategories }) {
  return filterCatalogItems({
    items: projects,
    query,
    selectedCategories,
    getCategories: (project) => project.categories,
    getSearchText: (project) =>
      [project.title, project.description, project.date, ...project.categories].join(" "),
  });
}

function createProjectCard({ project, accessLabel, onOpen, getImageUrl }) {
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
  const imageUrl = getImageUrl(project);
  if (imageUrl) {
    const image = document.createElement("img");
    image.className = "blog-item-image";
    image.src = imageUrl;
    image.alt = project.title;
    image.loading = "lazy";
    media.appendChild(image);
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

  const openHandler = () => onOpen(project);
  item.addEventListener("click", openHandler);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openHandler();
    }
  });

  return item;
}

export function createProjectsUi() {
  const sectionEl = document.getElementById("project");
  const listEl = document.getElementById("projects");
  const searchEl = document.getElementById("project-search");
  const categoriesEl = document.getElementById("project-categories");
  const statusEl = document.getElementById("project-status");

  return {
    isReady: Boolean(sectionEl && listEl && searchEl && categoriesEl && statusEl),
    getSearchQuery() {
      return searchEl.value;
    },
    setStatus(message) {
      statusEl.textContent = message || "";
    },
    showLoadError() {
      listEl.innerHTML = "<p>Failed to load projects.</p>";
    },
    renderCategories({ projects, selectedCategories, onToggle }) {
      categoriesEl.innerHTML = "";
      const counts = collectCategoryCounts(projects, (project) => project.categories);

      counts.forEach((count, category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "blog-category-button";
        button.classList.toggle("blog-category-active", selectedCategories.has(category));

        const label = document.createElement("span");
        label.className = "blog-category-label";
        label.textContent = category;

        const countEl = document.createElement("span");
        countEl.className = "blog-category-count";
        countEl.textContent = String(count);

        button.append(label, countEl);
        button.addEventListener("click", () => onToggle(category));
        categoriesEl.appendChild(button);
      });
    },
    renderProjectList({ projects, onOpen, resolveAccessLabel, getImageUrl }) {
      listEl.innerHTML = "";

      if (!projects.length) {
        listEl.innerHTML = "<p>No projects found.</p>";
        return;
      }

      projects.forEach((project) => {
        listEl.appendChild(
          createProjectCard({
            project,
            accessLabel: resolveAccessLabel(project),
            onOpen,
            getImageUrl,
          })
        );
      });
    },
    bindSearchInput(handler) {
      searchEl.addEventListener("input", () => {
        handler();
      });
    },
    bindSearchSubmit(handler) {
      searchEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        handler();
      });
    },
  };
}
