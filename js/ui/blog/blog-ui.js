import { collectCategoryCounts } from "../../shared/catalog.js";

function buildImageUrl(blog, basePath) {
  const rawImage = String(blog?.image || "").trim();
  if (!rawImage) return "";
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
  return `${basePath}${rawImage.replace(/^\/+/, "")}`;
}

export function createBlogUi({ blogBasePath }) {
  const sectionEl = document.getElementById("blog");
  const listEl = document.getElementById("blogs");
  const searchEl = document.getElementById("blog-search");
  const categoriesEl = document.getElementById("blog-categories");

  return {
    isReady: Boolean(sectionEl && listEl && searchEl && categoriesEl),
    getSearchQuery() {
      return searchEl.value;
    },
    renderCategories({ blogs, selectedCategories, onToggle }) {
      categoriesEl.innerHTML = "";
      const counts = collectCategoryCounts(blogs, (blog) => blog.categories);

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
    renderBlogList({ blogs, onOpen }) {
      listEl.innerHTML = "";

      if (!blogs.length) {
        listEl.innerHTML = "<p>No blogs found.</p>";
        return;
      }

      blogs.forEach((blog) => {
        const item = document.createElement("article");
        item.className = "blog-item";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", `Open blog ${blog.title}`);

        const imageUrl = buildImageUrl(blog, blogBasePath);
        if (imageUrl) {
          const image = document.createElement("img");
          image.className = "blog-item-image";
          image.src = imageUrl;
          image.alt = blog.title;
          image.loading = "lazy";
          item.appendChild(image);
        }

        const details = document.createElement("div");
        details.className = "blog-item-details";

        const title = document.createElement("h3");
        title.textContent = blog.title;
        details.appendChild(title);

        if (blog.date) {
          const date = document.createElement("p");
          date.className = "blog-item-date";
          date.textContent = blog.date;
          details.appendChild(date);
        }

        if (blog.description) {
          const description = document.createElement("p");
          description.className = "blog-item-description";
          description.textContent = blog.description;
          details.appendChild(description);
        }

        item.appendChild(details);

        const openHandler = () => onOpen(blog);
        item.addEventListener("click", openHandler);
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openHandler();
          }
        });

        listEl.appendChild(item);
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
      listEl.innerHTML = "<p>Failed to load blogs.</p>";
    },
  };
}
