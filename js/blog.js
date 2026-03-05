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
  const embeddedFrameById = new Map();

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

  const getFolderFromLocation = () => {
    const pathname = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
    if (pathname.startsWith("/blogs/")) {
      const folder = pathname.slice("/blogs/".length).split("/")[0];
      if (folder) return folder;
    }

    if (pathname.startsWith("/blog/")) {
      const folder = pathname.slice("/blog/".length).split("/")[0];
      if (folder) return folder;
    }

    const hash = window.location.hash.replace("#", "");
    return hash.startsWith("blog-") ? hash.replace("blog-", "") : "";
  };

  const buildImageUrl = (blog) => {
    if (!blog.image) return "";
    return `${BLOG_BASE_PATH}${blog.image.replace(/^\/+/, "")}`;
  };

  const buildBlogUrl = (blog) => {
    if (/^https?:\/\//i.test(blog.url)) return blog.url;
    if (blog.url) return `${BLOG_BASE_PATH}${blog.url.replace(/^\/+/, "")}`;
    return `${BLOG_BASE_PATH}${blog.folder}/index.html`;
  };

  const removeDynamicBlogSections = () => {
    document.querySelectorAll("section.page[data-blog-folder]").forEach((node) => node.remove());
  };

  const ensureBlogSection = (blog) => {
    removeDynamicBlogSections();

    const section = document.createElement("section");
    section.id = sectionIdForBlog(blog);
    section.className = "page project-embedded-page";
    section.dataset.blogFolder = blog.folder;
    section.innerHTML = "";
    mainEl.appendChild(section);
    return section;
  };

  const createSandboxedBlogFrame = () => {
    const iframe = document.createElement("iframe");
    iframe.className = "project-embedded-frame";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute(
      "sandbox",
      "allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
    );
    const frameId = `blog-frame-${Math.random().toString(36).slice(2)}`;
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
    const iframe = createSandboxedBlogFrame();
    const frameId = String(iframe.dataset.frameId || "");

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
  let heightScheduled = false;
  const sendHeight = () => {
    const bodyHeight = document.body ? document.body.scrollHeight : 0;
    const htmlHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
    const height = Math.max(bodyHeight, htmlHeight, 1);
    parent.postMessage({ type: "blog-frame-height", frameId, height }, "*");
  };
  const scheduleHeight = () => {
    if (heightScheduled) return;
    heightScheduled = true;
    requestAnimationFrame(() => {
      heightScheduled = false;
      sendHeight();
    });
  };
  window.addEventListener("load", sendHeight);
  window.addEventListener("resize", scheduleHeight);
  new MutationObserver(scheduleHeight).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
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
        const iframe = createSandboxedBlogFrame();
        iframe.src = sourceUrl;
        section.innerHTML = "";
        section.appendChild(iframe);
        return;
      }

      const response = await fetch(sourceUrl, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to load blog: ${response.status}`);
      }
      const html = await response.text();
      renderHtmlIntoSection(section, html, sourceUrl);
    } catch (error) {
      console.error("[Blog] Failed to load blog page:", error);
      section.innerHTML = "<p>Failed to load blog content.</p>";
    }
  };

  const openBlog = async (blog, { push = true } = {}) => {
    if (!blog || !blog.folder) return;
    const sectionId = sectionIdForBlog(blog);
    const section = ensureBlogSection(blog);
    const blogUrl = buildBlogUrl(blog);

    await renderUrlIntoSection(section, blogUrl);

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

  const tryOpenFromHash = () => {
    const folderFromLocation = getFolderFromLocation();
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

  window.addEventListener("message", (event) => {
    const data = event?.data;
    if (!data || data.type !== "blog-frame-height") return;
    const frame = embeddedFrameById.get(String(data.frameId || ""));
    if (!frame) return;
    const nextHeight = Number(data.height);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    frame.style.height = `${Math.max(1, Math.round(nextHeight))}px`;
  });

  try {
    const initialFolder = getFolderFromLocation();
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
    tryOpenFromHash();
    window.addEventListener("popstate", tryOpenFromHash);
    window.addEventListener("hashchange", tryOpenFromHash);
  } catch (error) {
    console.error("[Blog] Failed to initialize blog module:", error);
    blogListEl.innerHTML = "<p>Failed to load blogs.</p>";
  }
}
