import { BLOG_BASE_PATH } from "../../shared/config.js";
import { filterCatalogItems } from "../../shared/catalog.js";
import { getFolderFromLocation } from "../../shared/location.js";
import { fetchEmbeddedHtml, loadBlogCatalog } from "../../shared/api/content-api.js";
import { createBlogUi } from "./render/blog-ui.js";
import { createEmbeddedDetailUi } from "../../shared/render/embedded-detail-ui.js";

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

function buildBlogUrl(blog) {
  const rawUrl = String(blog?.url || "").trim();
  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("/")) return rawUrl;
  if (rawUrl) return `${BLOG_BASE_PATH}${rawUrl.replace(/^\/+/, "")}`;
  return `${BLOG_BASE_PATH}${blog.folder}/index.html`;
}

function sectionIdForBlog(blog) {
  return `blog-${blog.folder}`;
}

export async function initBlogController({ navigationController } = {}) {
  const blogPage = document.getElementById("blog");
  const mainEl = document.querySelector("main");
  const blogUi = createBlogUi({ blogBasePath: BLOG_BASE_PATH });

  if (!blogPage || !mainEl || !blogUi.isReady) return;

  const state = {
    blogs: [],
    selectedCategories: new Set(),
  };

  const embeddedDetailUi = createEmbeddedDetailUi({
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
    const section = embeddedDetailUi.ensureSection({
      sectionId,
      folder: blog.folder,
    });

    await embeddedDetailUi.renderUrlIntoSection(section, buildBlogUrl(blog));

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
      query: blogUi.getSearchQuery(),
      selectedCategories: state.selectedCategories,
      getCategories: (blog) => blog.categories,
      getSearchText: (blog) => [blog.title, blog.description, blog.date, ...blog.categories].join(" "),
    });

  const renderBlogs = () => {
    const filteredBlogs = getFilteredBlogs();
    blogUi.renderBlogList({
      blogs: filteredBlogs,
      onOpen: (blog) => openBlog(blog, { push: true }),
    });
    return filteredBlogs;
  };

  const renderCategories = () => {
    blogUi.renderCategories({
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

  blogUi.bindSearchInput(() => {
    renderBlogs();
  });

  blogUi.bindSearchSubmit(() => {
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
    blogUi.showLoadError();
  }
}

