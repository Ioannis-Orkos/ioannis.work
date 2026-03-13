import { collectCategoryCounts } from "../../../shared/catalog.js";

function createAviationCard({ item, accessLabel, onOpen, getImageUrl }) {
  const card = document.createElement("article");
  card.className = "blog-item project-item";
  if (item.locked) card.classList.add("project-item-locked");
  if (accessLabel === "approved") card.classList.add("project-item-approved");
  if (accessLabel === "pending") card.classList.add("project-item-pending");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open aviation content ${item.title}`);

  const media = document.createElement("div");
  media.className = "blog-item-media";
  const imageUrl = getImageUrl(item);
  if (imageUrl) {
    const image = document.createElement("img");
    image.className = "blog-item-image";
    image.src = imageUrl;
    image.alt = item.title;
    image.loading = "lazy";
    media.appendChild(image);
  } else {
    media.classList.add("blog-item-media-empty");
  }
  card.appendChild(media);

  const details = document.createElement("div");
  details.className = "blog-item-details";

  const title = document.createElement("h3");
  title.textContent = item.title;
  details.appendChild(title);

  if (item.locked && accessLabel !== "approved") {
    const lockIcon = document.createElement("span");
    lockIcon.className = "project-lock-icon";

    if (accessLabel === "pending") {
      lockIcon.classList.add("project-lock-icon-awaiting");
      lockIcon.setAttribute("aria-label", "Awaiting access");
      lockIcon.setAttribute("title", "Awaiting access");
      lockIcon.textContent = "⏳";
    } else {
      lockIcon.setAttribute("aria-label", "Locked aviation content");
      lockIcon.setAttribute("title", "Locked aviation content");
      lockIcon.textContent = "🔒";
    }

    card.appendChild(lockIcon);
  }

  if (item.date) {
    const date = document.createElement("p");
    date.className = "blog-item-date";
    date.textContent = item.date;
    details.appendChild(date);
  }

  if (item.description) {
    const description = document.createElement("p");
    description.className = "blog-item-description";
    description.textContent = item.description;
    details.appendChild(description);
  }

  card.appendChild(details);

  const openHandler = () => onOpen(item);
  card.addEventListener("click", openHandler);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openHandler();
    }
  });

  return card;
}

export function createAviationUi() {
  const sectionEl = document.getElementById("aviation");
  const listEl = document.getElementById("aviation-items");
  const searchEl = document.getElementById("aviation-search");
  const categoriesEl = document.getElementById("aviation-categories");
  const statusEl = document.getElementById("aviation-status");

  return {
    isReady: Boolean(sectionEl && listEl && searchEl && categoriesEl && statusEl),
    getSearchQuery() {
      return searchEl.value;
    },
    setStatus(message) {
      statusEl.textContent = message || "";
    },
    renderCategories({ items, selectedCategories, onToggle }) {
      categoriesEl.innerHTML = "";
      const counts = collectCategoryCounts(items, (item) => item.categories);

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
    renderList({ items, onOpen, resolveAccessLabel, getImageUrl }) {
      listEl.innerHTML = "";

      if (!items.length) {
        listEl.innerHTML = "<p>No aviation content found.</p>";
        return;
      }

      items.forEach((item) => {
        listEl.appendChild(
          createAviationCard({
            item,
            accessLabel: resolveAccessLabel(item),
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
    showLoadError() {
      listEl.innerHTML = "<p>Failed to load aviation content.</p>";
    },
  };
}
