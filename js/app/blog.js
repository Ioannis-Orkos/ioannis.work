import { BLOG_BASE_PATH } from "../shared/config.js";
import { collectCategoryCounts, filterCatalogItems } from "../shared/catalog.js";
import { createEmbeddedDetailController } from "../shared/embedded-detail.js";
import { getFolderFromLocation } from "../shared/location.js";
import { loadBlogCatalog, fetchEmbeddedHtml } from "../api/content-api.js";

function normalizeBlog(blog, index) {
  return {
    id: String(blog?.id || `blog-${index + 1}`),
    folder: String(blog?.folder || "").trim(),
    title: String(blog?.title || `Blog ${index + 1}`),
    date: String(blog?.date || ""),
    description: String(blog?.description || ""),
    image: String(blog?.image || ""),
    url: String(blog?.url || ""),
    categories: Array.isArray(blog?.categories)
      ? blog.categories.map((category) => String(category).trim()).filter(Boolean)
      : [],
  };
}

function buildImageUrl(blog) {
  const rawImage = String(blog?.image || "").trim();
  if (!rawImage) return "";
  if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
  return `${BLOG_BASE_PATH}${rawImage.replace(/^\/+/, "")}`;
}

function buildBlogUrl(blog) {
  const rawUrl = String(blog?.url || "").trim();
  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("/")) return rawUrl;
  if (rawUrl) return `${BLOG_BASE_PATH}${rawUrl.replace(/^\/+/, "")}`;
  return `${BLOG_BASE_PATH}${blog.folder}/index.html`;
}

function sectionIdForBlog(blog) {
  return `blog-${blog.folder}`;
}

function renderBlogCategories({ container, blogs, selectedCategories, onToggle }) {
  container.innerHTML = "";
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
    container.appendChild(button);
  });
}

function renderBlogList({ container, blogs, onOpen }) {
  container.innerHTML = "";

  if (!blogs.length) {
    container.innerHTML = "<p>No blogs found.</p>";
    return;
  }

  blogs.forEach((blog) => {
    const item = document.createElement("article");
    item.className = "blog-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Open blog ${blog.title}`);

    const imageUrl = buildImageUrl(blog);
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

    container.appendChild(item);
  });
}

export async function initBlog({ navigationController } = {}) {
  const blogPage = document.getElementById("blog");
  const mainEl = document.querySelector("main");
  const blogListEl = document.getElementById("blogs");
  const blogSearchEl = document.getElementById("blog-search");
  const blogCategoriesEl = document.getElementById("blog-categories");

  if (!blogPage || !mainEl || !blogListEl || !blogSearchEl || !blogCategoriesEl) return;

  const state = {
    blogs: [],
    selectedCategories: new Set(),
  };

  const embeddedDetailController = createEmbeddedDetailController({
    mainEl,
    sectionDataAttribute: "data-blog-folder",
    sectionDatasetKey: "blogFolder",
    frameIdPrefix: "blog-frame",
    messageType: "blog-frame-height",
    failureMessage: "Failed to load blog content.",
    failureLogLabel: "[Blog] Failed to load blog page:",
    loadHtml: fetchEmbeddedHtml,
    sectionClassName: "page blog-embedded-page",
    frameClassName: "blog-embedded-frame",
  });

  const getBlogFolderFromLocation = () =>
    getFolderFromLocation({
      primaryPathPrefix: "/blogs/",
      legacyPathPrefix: "/blog/",
      hashPrefix: "blog-",
    });

  const openBlog = async (blog, { push = true } = {}) => {
    if (!blog || !blog.folder) return;

    const sectionId = sectionIdForBlog(blog);
    const section = embeddedDetailController.ensureSection({
      sectionId,
      folder: blog.folder,
    });

    await embeddedDetailController.renderUrlIntoSection(section, buildBlogUrl(blog));

    if (navigationController?.navigateTo) {
      navigationController.navigateTo(sectionId, { push });
    } else {
      window.location.hash = sectionId;
    }
  };

  const openBlogByFolder = async (folder, { push = false } = {}) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) return;

    const knownBlog = state.blogs.find((item) => item.folder === normalizedFolder);
    const fallbackBlog = {
      folder: normalizedFolder,
      title: `Blog ${normalizedFolder}`,
      url: `${normalizedFolder}/index.html`,
    };

    await openBlog(knownBlog || fallbackBlog, { push });
  };

  const getFilteredBlogs = () =>
    filterCatalogItems({
      items: state.blogs,
      query: blogSearchEl.value,
      selectedCategories: state.selectedCategories,
      getCategories: (blog) => blog.categories,
      getSearchText: (blog) => [blog.title, blog.description, blog.date, ...blog.categories].join(" "),
    });

  const renderBlogs = () => {
    const filteredBlogs = getFilteredBlogs();
    renderBlogList({
      container: blogListEl,
      blogs: filteredBlogs,
      onOpen: (blog) => openBlog(blog, { push: true }),
    });
    return filteredBlogs;
  };

  const renderCategories = () => {
    renderBlogCategories({
      container: blogCategoriesEl,
      blogs: state.blogs,
      selectedCategories: state.selectedCategories,
      onToggle: (category) => {
        if (state.selectedCategories.has(category)) {
          state.selectedCategories.delete(category);
        } else {
          state.selectedCategories.add(category);
        }

        renderBlogs();
        renderCategories();
      },
    });
  };

  const tryOpenFromLocation = () => {
    const folderFromLocation = getBlogFolderFromLocation();
    if (!folderFromLocation) return;
    openBlogByFolder(folderFromLocation, { push: false });
  };

  blogSearchEl.addEventListener("input", renderBlogs);
  blogSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    const filteredBlogs = renderBlogs();
    if (filteredBlogs.length) {
      openBlog(filteredBlogs[0], { push: true });
    }
  });

  try {
    const initialFolder = getBlogFolderFromLocation();
    if (initialFolder) {
      openBlogByFolder(initialFolder, { push: false });
    }

    const data = await loadBlogCatalog();
    const source = Array.isArray(data) ? data : data?.blogs;
    state.blogs = Array.isArray(source)
      ? source.map((blog, index) => normalizeBlog(blog, index)).filter((blog) => blog.folder)
      : [];

    renderCategories();
    renderBlogs();
    tryOpenFromLocation();

    window.addEventListener("popstate", tryOpenFromLocation);
    window.addEventListener("hashchange", tryOpenFromLocation);
  } catch (error) {
    console.error("[Blog] Failed to initialize blog module:", error);
    blogListEl.innerHTML = "<p>Failed to load blogs.</p>";
  }
}
