const BLOG_DATA_URL = "./blogs/blog-data.json";
const BLOG_BASE_PATH = "./blogs/";

export async function initBlog() {
  const blogPage = document.getElementById("blog");
  const blogListEl = document.getElementById("blogs");
  const blogSearchEl = document.getElementById("blog-search");
  const blogCategoriesEl = document.getElementById("blog-categories");

  if (!blogPage || !blogListEl || !blogSearchEl || !blogCategoriesEl) return;

  let blogs = [];
  let selectedCategories = new Set();

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

  const buildImageUrl = (blog) => {
    if (!blog.image) return "";
    return `${BLOG_BASE_PATH}${blog.image.replace(/^\/+/, "")}`;
  };

  const buildBlogUrl = (blog) => {
    if (/^https?:\/\//i.test(blog.url)) return blog.url;
    if (blog.url) {
      return `${BLOG_BASE_PATH}${blog.url.replace(/^\/+/, "")}`;
    }
    return `${BLOG_BASE_PATH}${blog.folder}/index.html`;
  };

  const loadBlog = (blog) => {
    window.location.href = buildBlogUrl(blog);
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

    const openHandler = () => loadBlog(blog);
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
      button.textContent = `${category} (${count})`;

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
      const haystack = [
        blog.title,
        blog.description,
        blog.date,
        ...blog.categories,
      ]
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

  blogSearchEl.addEventListener("input", renderBlogs);
  blogSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const filtered = renderBlogs();
    if (filtered.length) {
      loadBlog(filtered[0]);
    }
  });

  try {
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
  } catch (error) {
    console.error("[Blog] Failed to initialize blog module:", error);
    blogListEl.innerHTML = "<p>Failed to load blogs.</p>";
  }
}
