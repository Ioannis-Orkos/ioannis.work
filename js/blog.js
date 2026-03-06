import {
  createEmbeddedDetailController,
  getFolderFromLocation,
} from "./embedded-detail.js";

const BLOG_DATA_URL = "/blogs/blog-data.json";
const BLOG_BASE_PATH = "/blogs/";

export async function initBlog({ navigationController } = {}) {
  const blogPage = document.getElementById("blog");
  const mainEl = document.querySelector("main");
  const blogListEl = document.getElementById("blogs");
  const blogSearchEl = document.getElementById("blog-search");
  const blogCategoriesEl = document.getElementById("blog-categories");

  if (!blogPage || !mainEl || !blogListEl || !blogSearchEl || !blogCategoriesEl) return;

  let blogs = [];
  let selectedCategories = new Set();

  const embeddedDetailController = createEmbeddedDetailController({
    mainEl,
    sectionDataAttribute: "data-blog-folder",
    sectionDatasetKey: "blogFolder",
    frameIdPrefix: "blog-frame",
    messageType: "blog-frame-height",
    failureMessage: "Failed to load blog content.",
    failureLogLabel: "[Blog] Failed to load blog page:",
    sectionClassName: "page blog-embedded-page",
    frameClassName: "blog-embedded-frame",
  });

  const normalizeBlog = (blog, index) => ({
    id: String(blog?.id || `blog-${index + 1}`),
    folder: String(blog?.folder || "").trim(),
    title: String(blog?.title || `Blog ${index + 1}`),
    date: String(blog?.date || ""),
    description: String(blog?.description || ""),
    image: String(blog?.image || ""),
    url: String(blog?.url || ""),
    categories: Array.isArray(blog?.categories)
      ? blog.categories.map((cat) => String(cat).trim()).filter(Boolean)
      : [],
  });

  const sectionIdForBlog = (blog) => `blog-${blog.folder}`;

  const getBlogFolderFromLocation = () =>
    getFolderFromLocation({
      primaryPathPrefix: "/blogs/",
      legacyPathPrefix: "/blog/",
      hashPrefix: "blog-",
    });

  const buildImageUrl = (blog) => {
    const rawImage = String(blog?.image || "").trim();
    if (!rawImage) return "";
    if (/^https?:\/\//i.test(rawImage) || rawImage.startsWith("/")) return rawImage;
    return `${BLOG_BASE_PATH}${rawImage.replace(/^\/+/, "")}`;
  };

  const buildBlogUrl = (blog) => {
    const rawUrl = String(blog?.url || "").trim();
    if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("/")) return rawUrl;
    if (rawUrl) return `${BLOG_BASE_PATH}${rawUrl.replace(/^\/+/, "")}`;
    return `${BLOG_BASE_PATH}${blog.folder}/index.html`;
  };

  const openBlog = async (blog, { push = true } = {}) => {
    if (!blog || !blog.folder) return;

    const sectionId = sectionIdForBlog(blog);
    const section = embeddedDetailController.ensureSection({
      sectionId,
      folder: blog.folder,
    });
    const blogUrl = buildBlogUrl(blog);

    await embeddedDetailController.renderUrlIntoSection(section, blogUrl);

    if (navigationController && typeof navigationController.navigateTo === "function") {
      navigationController.navigateTo(sectionId, { push });
    } else {
      window.location.hash = sectionId;
    }
  };

  const openBlogByFolder = async (folder, { push = false } = {}) => {
    const normalizedFolder = String(folder || "").trim();
    if (!normalizedFolder) return;

    const knownBlog = blogs.find((item) => item.folder === normalizedFolder);
    const fallbackBlog = {
      folder: normalizedFolder,
      title: `Blog ${normalizedFolder}`,
      url: `${normalizedFolder}/index.html`,
    };

    await openBlog(knownBlog || fallbackBlog, { push });
  };

  const createBlogItem = (blog) => {
    const item = document.createElement("article");
    item.className = "blog-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Open blog ${blog.title}`);

    const imageUrl = buildImageUrl(blog);
    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "blog-item-image";
      img.src = imageUrl;
      img.alt = blog.title;
      img.loading = "lazy";
      item.appendChild(img);
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

    const openHandler = () => openBlog(blog, { push: true });
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
    blogCategoriesEl.innerHTML = "";
    const counts = new Map();

    blogs.forEach((blog) => {
      blog.categories.forEach((cat) => {
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
        renderBlogs();
      });

      blogCategoriesEl.appendChild(button);
    });
  };

  const getFilteredBlogs = () => {
    const query = blogSearchEl.value.trim().toLowerCase();
    const byCategory = selectedCategories.size
      ? blogs.filter(
          (blog) =>
            blog.categories.length > 0 &&
            blog.categories.some((cat) => selectedCategories.has(cat))
        )
      : blogs;

    if (!query) return byCategory;

    return byCategory.filter((blog) => {
      const haystack = [blog.title, blog.description, blog.date, ...blog.categories]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  };

  const renderBlogs = () => {
    const filtered = getFilteredBlogs();
    blogListEl.innerHTML = "";

    if (!filtered.length) {
      blogListEl.innerHTML = "<p>No blogs found.</p>";
      return filtered;
    }

    filtered.forEach((blog) => {
      blogListEl.appendChild(createBlogItem(blog));
    });
    return filtered;
  };

  const tryOpenFromLocation = () => {
    const folderFromLocation = getBlogFolderFromLocation();
    if (!folderFromLocation) return;
    openBlogByFolder(folderFromLocation, { push: false });
  };

  blogSearchEl.addEventListener("input", renderBlogs);
  blogSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const filtered = renderBlogs();
    if (filtered.length) {
      openBlog(filtered[0], { push: true });
    }
  });

  try {
    const initialFolder = getBlogFolderFromLocation();
    if (initialFolder) {
      openBlogByFolder(initialFolder, { push: false });
    }

    const response = await fetch(BLOG_DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load blogs: ${response.status}`);
    }

    const data = await response.json();
    const source = Array.isArray(data) ? data : data?.blogs;
    blogs = Array.isArray(source)
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
