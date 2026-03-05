import { AUTH_API_BASE_URL } from "./config.js";

const AUTH_TOKEN_KEYS = ["auth-token", "access-token", "site-auth-token"];

const endpoints = {
  me: `${AUTH_API_BASE_URL}/api/auth/me`,
  overview: `${AUTH_API_BASE_URL}/api/admin/overview`,
  users: `${AUTH_API_BASE_URL}/api/admin/users`,
  projects: `${AUTH_API_BASE_URL}/api/admin/projects`,
  createProject: `${AUTH_API_BASE_URL}/api/admin/projects`,
  accessRequests: `${AUTH_API_BASE_URL}/api/admin/access-requests`,
  accessRequestById: (id) => `${AUTH_API_BASE_URL}/api/admin/access-requests/${id}`,
  projectById: (id) => `${AUTH_API_BASE_URL}/api/admin/projects/${id}`,
  projectDeleteById: (id) => `${AUTH_API_BASE_URL}/api/admin/projects/${id}`,
  userRoleById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}/role`,
  userById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}`,
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
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
};

export function initAdmin({ navigationController } = {}) {
  const adminPage = document.getElementById("admin");
  const gateStatusEl = document.getElementById("admin-gate-status");
  const controlsEl = document.getElementById("admin-controls");
  const overviewEl = document.getElementById("admin-overview");
  const usersEl = document.getElementById("admin-users");
  const requestsEl = document.getElementById("admin-access-requests");
  const projectsEl = document.getElementById("admin-projects");
  const tabUsersBtn = document.getElementById("admin-tab-users");
  const tabRequestsBtn = document.getElementById("admin-tab-requests");
  const tabProjectsBtn = document.getElementById("admin-tab-projects");
  const panels = [...document.querySelectorAll(".admin-panel[data-admin-panel]")];
  if (!adminPage || !gateStatusEl || !controlsEl || !overviewEl || !usersEl || !requestsEl || !projectsEl) return;

  let isLoading = false;
  let pollTimer = null;
  let usersCache = [];
  let userSearchQuery = "";
  let userRoleFilter = "all";
  let requestFilter = "pending";
  let requestSearchQuery = "";
  let requestsCache = [];
  let projectsCache = [];
  let projectEditorModal = null;
  let projectEditorForm = null;
  let projectEditorStatus = null;
  let editingProjectId = null;
  let projectEditorMode = "edit";
  const loadingMarkup = '<div class="admin-loading"><span class="admin-spinner" aria-hidden="true"></span><span>Loading...</span></div>';

  const setGateStatus = (message) => {
    gateStatusEl.textContent = message || "";
  };

  const parseJsonSafe = async (response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const ensureProjectEditorModal = () => {
    if (projectEditorModal) return;

    const overlay = document.createElement("div");
    overlay.id = "admin-project-editor-modal";
    overlay.className = "modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-project-editor-title">
        <button type="button" class="modal-close admin-project-editor-close" aria-label="Close project editor">×</button>
        <h2 id="admin-project-editor-title">Edit Project</h2>
        <form id="admin-project-editor-form" class="modal-form admin-project-editor-form">
          <div class="admin-project-editor-grid">
            <div class="admin-project-editor-field">
              <label for="admin-project-slug">Slug</label>
              <input id="admin-project-slug" name="slug" type="text" required />
            </div>
            <div class="admin-project-editor-field">
              <label for="admin-project-title">Title</label>
              <input id="admin-project-title" name="title" type="text" required />
            </div>
            <div class="admin-project-editor-field">
              <label for="admin-project-image">Image</label>
              <input id="admin-project-image" name="imagePath" type="text" placeholder="folder/asset/preview.webp" />
            </div>
            <div class="admin-project-editor-field">
              <label for="admin-project-delivery">Delivery</label>
              <select id="admin-project-delivery" name="deliveryType">
                <option value="content">content</option>
                <option value="link">link</option>
              </select>
            </div>
            <div class="admin-project-editor-field">
              <label for="admin-project-locked">Locked</label>
              <select id="admin-project-locked" name="locked">
                <option value="false">open</option>
                <option value="true">locked</option>
              </select>
            </div>
            <div class="admin-project-editor-field admin-project-editor-field-full">
              <label for="admin-project-description">Description</label>
              <textarea id="admin-project-description" name="description" rows="3"></textarea>
            </div>
            <div class="admin-project-editor-field admin-project-editor-field-full">
              <label for="admin-project-categories">Categories (comma separated)</label>
              <input id="admin-project-categories" name="categoriesText" type="text" placeholder="Aviation, Workflow, Frontend" />
            </div>
            <div class="admin-project-editor-field admin-project-editor-field-full">
              <label for="admin-project-external-url">External URL</label>
              <input id="admin-project-external-url" name="externalUrl" type="url" placeholder="https://..." />
            </div>
            <div class="admin-project-editor-field admin-project-editor-field-full">
              <label for="admin-project-content">Content</label>
              <textarea id="admin-project-content" name="htmlContent" rows="10" placeholder="Project HTML content..."></textarea>
            </div>
          </div>
          <button type="submit" class="modal-submit">Save Project</button>
        </form>
        <p id="admin-project-editor-status" class="modal-status" aria-live="polite"></p>
      </div>
    `;
    document.body.appendChild(overlay);

    projectEditorModal = overlay;
    projectEditorForm = overlay.querySelector("#admin-project-editor-form");
    projectEditorStatus = overlay.querySelector("#admin-project-editor-status");
    const titleField = overlay.querySelector("#admin-project-title");
    const slugField = overlay.querySelector("#admin-project-slug");

    const toSlug = (value) =>
      String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-_]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest(".admin-project-editor-close")) {
        overlay.hidden = true;
        editingProjectId = null;
        if (projectEditorStatus) projectEditorStatus.textContent = "";
      }
    });

    projectEditorForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const isCreate = projectEditorMode === "create";
      if (!isCreate && !Number.isFinite(editingProjectId)) return;

      const formData = new FormData(projectEditorForm);
      const payload = {
        slug: String(formData.get("slug") || "").trim().toLowerCase(),
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        categories: String(formData.get("categoriesText") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        imagePath: String(formData.get("imagePath") || "").trim(),
        deliveryType: String(formData.get("deliveryType") || "content").trim().toLowerCase(),
        locked: String(formData.get("locked") || "false").toLowerCase() === "true",
        externalUrl: String(formData.get("externalUrl") || "").trim(),
        htmlContent: String(formData.get("htmlContent") || ""),
      };

      try {
        const submitBtn = projectEditorForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        if (projectEditorStatus) projectEditorStatus.innerHTML = loadingMarkup;
        const response = await apiFetch(isCreate ? endpoints.createProject : endpoints.projectById(editingProjectId), {
          method: isCreate ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(body.error || "Failed to save project.");
        }
        const savedProject = body?.project || null;
        if (savedProject && typeof savedProject === "object") {
          if (isCreate) {
            projectsCache = [savedProject, ...projectsCache];
          } else {
            projectsCache = projectsCache.map((project) =>
              Number(project.id) === Number(savedProject.id) ? savedProject : project
            );
          }
          renderProjects(projectsCache);
        }
        projectEditorModal.hidden = true;
        editingProjectId = null;
        projectEditorMode = "edit";
        if (projectEditorStatus) projectEditorStatus.textContent = "";
      } catch (error) {
        if (projectEditorStatus) {
          projectEditorStatus.textContent = error.message || "Failed to save project.";
        }
      } finally {
        const submitBtn = projectEditorForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    titleField.addEventListener("input", () => {
      if (projectEditorMode !== "create") return;
      const slugInput = slugField;
      if (!slugInput || slugInput.dataset.manual === "1") return;
      slugInput.value = toSlug(titleField.value || "");
    });

    slugField.addEventListener("input", () => {
      const slugInput = slugField;
      if (!slugInput) return;
      slugInput.dataset.manual = slugInput.value.trim() ? "1" : "0";
    });
  };

  const openProjectEditor = (project, { mode = "edit" } = {}) => {
    ensureProjectEditorModal();
    projectEditorMode = mode === "create" ? "create" : "edit";
    editingProjectId = projectEditorMode === "edit" ? Number(project?.id) : null;
    if (projectEditorMode === "edit" && !Number.isFinite(editingProjectId)) return;
    if (!projectEditorForm) return;

    const slugInput = projectEditorForm.querySelector("#admin-project-slug");
    const titleInput = projectEditorForm.querySelector("#admin-project-title");
    const descriptionInput = projectEditorForm.querySelector("#admin-project-description");
    const imageInput = projectEditorForm.querySelector("#admin-project-image");
    const categoriesInput = projectEditorForm.querySelector("#admin-project-categories");
    const deliveryInput = projectEditorForm.querySelector("#admin-project-delivery");
    const lockedInput = projectEditorForm.querySelector("#admin-project-locked");
    const externalUrlInput = projectEditorForm.querySelector("#admin-project-external-url");
    const htmlContentInput = projectEditorForm.querySelector("#admin-project-content");
    slugInput.value = String(project?.slug || "");
    slugInput.disabled = false;
    slugInput.dataset.manual = projectEditorMode === "create" && slugInput.value.trim() ? "1" : "0";
    titleInput.value = String(project?.title || "");
    descriptionInput.value = String(project?.description || "");
    const categoriesValue = Array.isArray(project?.categories)
      ? project.categories
      : String(project?.categories_json || "");
    categoriesInput.value = Array.isArray(categoriesValue)
      ? categoriesValue.join(", ")
      : String(categoriesValue);
    imageInput.value = String(project?.image_path || "");
    deliveryInput.value =
      String(project?.delivery_type || "content").toLowerCase() === "link" ? "link" : "content";
    lockedInput.value = Boolean(project?.locked) ? "true" : "false";
    externalUrlInput.value = String(project?.external_url || "");
    htmlContentInput.value = String(project?.html_content || "");
    if (projectEditorStatus) projectEditorStatus.textContent = "";
    projectEditorModal.hidden = false;
  };

  const ensureAdmin = async () => {
    try {
      const response = await apiFetch(endpoints.me, { method: "GET" });
      if (!response.ok) {
        const body = await parseJsonSafe(response);
        return {
          ok: false,
          reason: body?.error || (response.status === 401 ? "Login required." : "Unable to verify session."),
        };
      }
      const body = await parseJsonSafe(response);
      window.__AUTH_USER = body?.user || window.__AUTH_USER || null;
      const isAdmin = String(body?.user?.role || "").toLowerCase() === "admin";
      if (!isAdmin) {
        return { ok: false, reason: "Admin access required." };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: "Unable to verify session." };
    }
  };

  const renderOverview = (overview) => {
    overviewEl.innerHTML = `
      <article class="admin-stat"><h4>Users</h4><p>${Number(overview?.usersTotal || 0)}</p></article>
      <article class="admin-stat"><h4>Pending</h4><p>${Number(overview?.pendingRequests || 0)}</p></article>
      <article class="admin-stat"><h4>Approved</h4><p>${Number(overview?.approvedRequests || 0)}</p></article>
      <article class="admin-stat"><h4>Rejected</h4><p>${Number(overview?.rejectedRequests || 0)}</p></article>
    `;
  };

  const renderUsers = (users) => {
    if (!Array.isArray(users) || !users.length) {
      usersEl.innerHTML = "<p>No users found.</p>";
      return;
    }

    const currentUserId = Number(window.__AUTH_USER?.id || 0);
    const normalizedQuery = userSearchQuery.trim().toLowerCase();
    const filtered = users.filter((user) => {
      const role = String(user.role || "").toLowerCase();
      const roleMatch = userRoleFilter === "all" ? true : role === userRoleFilter;
      if (!roleMatch) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        user.full_name,
        user.email,
        user.role,
        user.status,
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    if (!filtered.length) {
      usersEl.innerHTML = `
        <div class="admin-toolbar" style="justify-content:flex-start;margin-bottom:0.8rem;">
          <input type="search" class="admin-users-search" placeholder="Search users..." value="${escapeHtml(userSearchQuery)}" />
          <select class="admin-users-role-filter">
            <option value="all" ${userRoleFilter === "all" ? "selected" : ""}>All Roles</option>
            <option value="admin" ${userRoleFilter === "admin" ? "selected" : ""}>Admins</option>
            <option value="user" ${userRoleFilter === "user" ? "selected" : ""}>Users</option>
          </select>
        </div>
        <p>No users match current filters.</p>
      `;
      return;
    }

    usersEl.innerHTML = `
      <div class="admin-toolbar" style="justify-content:flex-start;margin-bottom:0.8rem;">
        <input type="search" class="admin-users-search" placeholder="Search users..." value="${escapeHtml(userSearchQuery)}" />
        <select class="admin-users-role-filter">
          <option value="all" ${userRoleFilter === "all" ? "selected" : ""}>All Roles</option>
          <option value="admin" ${userRoleFilter === "admin" ? "selected" : ""}>Admins</option>
          <option value="user" ${userRoleFilter === "user" ? "selected" : ""}>Users</option>
        </select>
      </div>
      <table class="admin-table admin-users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((user) => {
              const canDelete = Number(user.id) !== currentUserId;
              const isAdminRole = String(user.role || "").toLowerCase() === "admin";
              const canToggleRole = canDelete;
              return `
                <tr data-user-id="${user.id}">
                  <td>${escapeHtml(user.full_name || "No Name")}</td>
                  <td>${escapeHtml(user.email)}</td>
                  <td><span class="admin-badge">${escapeHtml(user.role)}</span></td>
                  <td><span class="admin-badge">${escapeHtml(user.status)}</span></td>
                  <td class="admin-actions-cell">
                    <button type="button" class="auth-switch-button admin-toggle-user-role" data-next-role="${isAdminRole ? "user" : "admin"}" ${canToggleRole ? "" : "disabled"}>${isAdminRole ? "Make User" : "Make Admin"}</button>
                    <button type="button" class="auth-switch-button admin-delete-user" ${canDelete ? "" : "disabled"}>Delete</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  };

  const renderRequests = (requests) => {
    if (!Array.isArray(requests) || !requests.length) {
      requestsEl.innerHTML = "<p>No access requests.</p>";
      return;
    }

    const sorted = [...requests].sort((a, b) => {
      const aPending = String(a.status || "") === "pending" ? 0 : 1;
      const bPending = String(b.status || "") === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return String(b.requested_at || "").localeCompare(String(a.requested_at || ""));
    });
    const filtered = requestFilter === "all"
      ? sorted
      : sorted.filter((request) => String(request.status || "") === "pending");
    const query = requestSearchQuery.trim().toLowerCase();
    const searched = query
      ? filtered.filter((request) => {
          const haystack = [
            request.title,
            request.full_name,
            request.email,
            request.status,
            request.user_message,
            request.user_note,
            request.note,
          ].join(" ").toLowerCase();
          return haystack.includes(query);
        })
      : filtered;
    const counts = {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      all: requests.length,
    };

    requestsEl.innerHTML = `
      <div class="admin-toolbar" style="justify-content:flex-start;margin-bottom:0.8rem;">
        <button type="button" class="auth-switch-button admin-req-filter-toggle ${requestFilter === "all" ? "active" : ""}" data-filter-toggle="1">
          ${requestFilter === "all" ? `Show Pending` : `Show All`}
        </button>
        <input type="search" class="admin-requests-search" placeholder="Search requests..." value="${escapeHtml(requestSearchQuery)}" />
      </div>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>User</th>
            <th>Status</th>
            <th>Message</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${searched
            .map((request) => {
              const status = String(request.status || "").toLowerCase();
              const isApproved = status === "approved";
              const isRejected = status === "rejected";
              const userMessage = String(
                request.user_message ||
                request.userMessage ||
                request.user_note ||
                request.userNote ||
                request.accessRequestNote ||
                request.note ||
                ""
              ).trim();
              return `
                <tr data-request-id="${request.id}">
                  <td>${request.title}</td>
                  <td>${request.full_name || request.email}</td>
                  <td><span class="admin-badge">${request.status}</span></td>
                  <td>${userMessage || "No message"}</td>
                  <td class="admin-actions-cell">
                    <button
                      type="button"
                      class="modal-submit admin-request-toggle ${isApproved ? "active" : ""}"
                      data-status="${isApproved ? "rejected" : "approved"}"
                      aria-pressed="${isApproved ? "true" : "false"}"
                    >
                      ${isApproved ? "Reject" : "Approve"}
                    </button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  };

  const renderProjects = (projects) => {
    if (!Array.isArray(projects) || !projects.length) {
      projectsEl.innerHTML = "<p>No projects found.</p>";
      return;
    }

    projectsEl.innerHTML = `
      <div class="admin-toolbar" style="justify-content:flex-start;margin-bottom:0.8rem;">
        <button type="button" class="auth-switch-button admin-add-project">Add Project</button>
      </div>
      <div class="project-list">
        ${projects
          .map((project) => {
            const locked = Boolean(project.locked);
            const deliveryType = String(project.delivery_type || "content").toLowerCase() === "link" ? "link" : "content";
            const imagePath = String(project.image_path || "").trim();
            const imageUrl = imagePath
              ? (/^https?:\/\//i.test(imagePath) || imagePath.startsWith("/") ? imagePath : `/projects/${imagePath}`)
              : "";
            const dateText = String(project.updated_at || "").slice(0, 10);
            const categories = Array.isArray(project.categories)
              ? project.categories.map((item) => String(item).trim()).filter(Boolean)
              : [];
            const categoriesText = categories.length ? categories.join(", ") : "No categories";
            return `
              <article class="blog-item project-item ${locked ? "project-item-locked" : ""}"
                       data-project-id="${project.id}"
                       data-locked="${locked ? "1" : "0"}"
                       data-project='${escapeHtml(JSON.stringify(project))}'>
                <button type="button" class="admin-edit-project-icon" aria-label="Edit project" title="Edit project">✎</button>
                <button type="button" class="admin-delete-project-icon" aria-label="Delete project" title="Delete project">🗑</button>
                <div class="blog-item-media ${imageUrl ? "" : "blog-item-media-empty"}">
                  ${imageUrl ? `<img class="blog-item-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(project.title)}" />` : ""}
                </div>
                <div class="blog-item-details">
                  <h3>${escapeHtml(project.title)}</h3>
                  <p class="blog-item-date">${escapeHtml(dateText)}</p>
                  <p class="blog-item-description">${escapeHtml(project.description || "")}</p>
                  <p class="blog-item-date">categories: ${escapeHtml(categoriesText)}</p>
                  <p class="blog-item-date">slug: ${escapeHtml(project.slug)} | ${locked ? "locked" : "open"} | ${deliveryType}</p>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const setActiveTab = (tabId) => {
    const activeTab = String(tabId || "users");
    const tabMap = new Map([
      ["users", tabUsersBtn],
      ["requests", tabRequestsBtn],
      ["projects", tabProjectsBtn],
    ]);

    for (const [key, button] of tabMap.entries()) {
      if (!button) continue;
      button.classList.toggle("active", key === activeTab);
    }

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== activeTab;
    });
  };

  const setControlsVisibility = (isAdmin) => {
    controlsEl.hidden = !isAdmin;
    if (!isAdmin) {
      overviewEl.innerHTML = "";
      usersEl.innerHTML = "";
      requestsEl.innerHTML = "";
      projectsEl.innerHTML = "";
    }
  };

  const loadAdminData = async () => {
    if (isLoading) return;
    isLoading = true;
    setGateStatus("");

    const authState = await ensureAdmin();
    setControlsVisibility(Boolean(authState?.ok));
    if (!authState?.ok) {
      setGateStatus("");
      if (navigationController?.getActivePageId?.() === "admin") {
        navigationController.navigateTo("home", { push: false });
        history.replaceState({ type: "page", targetId: "home" }, "", "/");
      }
      isLoading = false;
      return;
    }

    try {
      overviewEl.innerHTML = loadingMarkup;
      usersEl.innerHTML = loadingMarkup;
      requestsEl.innerHTML = loadingMarkup;
      projectsEl.innerHTML = loadingMarkup;
      const [overviewRes, usersRes, requestsRes, projectsRes] = await Promise.all([
        apiFetch(endpoints.overview).catch(() => null),
        apiFetch(endpoints.users),
        apiFetch(endpoints.accessRequests),
        apiFetch(endpoints.projects),
      ]);

      const [overviewBody, usersBody, requestsBody, projectsBody] = await Promise.all([
        overviewRes ? parseJsonSafe(overviewRes) : Promise.resolve({}),
        parseJsonSafe(usersRes),
        parseJsonSafe(requestsRes),
        parseJsonSafe(projectsRes),
      ]);

      if (!usersRes.ok || !requestsRes.ok || !projectsRes.ok) {
        const message =
          usersBody?.error ||
          requestsBody?.error ||
          projectsBody?.error ||
          "Unable to load admin data.";
        setGateStatus(message.startsWith("Unable to load") ? "" : message);
        return;
      }

      const users = Array.isArray(usersBody?.users) ? usersBody.users : [];
      usersCache = users;
      const requests = Array.isArray(requestsBody?.requests) ? requestsBody.requests : [];
      requestsCache = requests;
      const projects = Array.isArray(projectsBody?.projects) ? projectsBody.projects : [];
      projectsCache = projects;
      const fallbackOverview = {
        usersTotal: users.length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        approvedRequests: requests.filter((r) => r.status === "approved").length,
        rejectedRequests: requests.filter((r) => r.status === "rejected").length,
      };

      renderOverview((overviewRes && overviewRes.ok && overviewBody?.overview) ? overviewBody.overview : fallbackOverview);
      renderUsers(users);
      renderRequests(requests);
      renderProjects(projects);
      setGateStatus("");
    } catch {
      setGateStatus("");
    } finally {
      isLoading = false;
    }
  };

  const updateAccessRequest = async (requestId, status) => {
    const response = await apiFetch(endpoints.accessRequestById(requestId), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    });
    const body = await parseJsonSafe(response);
    if (!response.ok) throw new Error(body.error || "Failed to update access request.");
  };

  requestsEl.addEventListener("click", async (event) => {
    const filterBtn = event.target.closest(".admin-req-filter-toggle[data-filter-toggle]");
    if (filterBtn) {
      requestFilter = requestFilter === "all" ? "pending" : "all";
      renderRequests(requestsCache);
      return;
    }

    const row = event.target.closest("tr[data-request-id]");
    if (!row) return;
    const requestId = Number(row.dataset.requestId);
    if (!Number.isFinite(requestId)) return;

    const toggleBtn = event.target.closest(".admin-request-toggle[data-status]");
    if (toggleBtn) {
      try {
        const nextStatus = String(toggleBtn.dataset.status || "").toLowerCase();
        if (!["approved", "rejected"].includes(nextStatus)) return;
        toggleBtn.disabled = true;
        await updateAccessRequest(requestId, nextStatus);
        requestsCache = requestsCache.map((request) =>
          Number(request.id) === requestId ? { ...request, status: nextStatus } : request
        );
        requestFilter = "all";
        renderRequests(requestsCache);
      } catch (error) {
        setGateStatus(error.message || "Failed to update request.");
      }
      return;
    }
  });

  requestsEl.addEventListener("input", (event) => {
    const searchInput = event.target.closest(".admin-requests-search");
    if (!searchInput) return;
    requestSearchQuery = String(searchInput.value || "");
    renderRequests(requestsCache);
  });

  usersEl.addEventListener("input", (event) => {
    const searchInput = event.target.closest(".admin-users-search");
    if (!searchInput) return;
    userSearchQuery = String(searchInput.value || "");
    renderUsers(usersCache);
  });

  usersEl.addEventListener("change", (event) => {
    const roleFilter = event.target.closest(".admin-users-role-filter");
    if (!roleFilter) return;
    const nextFilter = String(roleFilter.value || "all").toLowerCase();
    userRoleFilter = ["all", "admin", "user"].includes(nextFilter) ? nextFilter : "all";
    renderUsers(usersCache);
  });

  usersEl.addEventListener("click", async (event) => {
    const row = event.target.closest("tr[data-user-id]");
    if (!row) return;
    const userId = Number(row.dataset.userId);
    if (!Number.isFinite(userId)) return;

    if (event.target.closest(".admin-toggle-user-role")) {
      try {
        const toggleBtn = event.target.closest(".admin-toggle-user-role");
        const nextRole = String(toggleBtn?.dataset.nextRole || "").toLowerCase() === "user" ? "user" : "admin";
        const response = await apiFetch(endpoints.userRoleById(userId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: nextRole }),
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(body.error || "Failed to update user role.");
        }
        usersCache = usersCache.map((user) =>
          Number(user.id) === userId ? { ...user, role: nextRole } : user
        );
        renderUsers(usersCache);
      } catch (error) {
        setGateStatus(error.message || "Failed to update user role.");
      }
      return;
    }

    if (event.target.closest(".admin-delete-user")) {
      try {
        const response = await apiFetch(endpoints.userById(userId), {
          method: "DELETE",
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(body.error || "Failed to delete user.");
        }
        usersCache = usersCache.filter((user) => Number(user.id) !== userId);
        renderUsers(usersCache);
      } catch (error) {
        setGateStatus(error.message || "Failed to delete user.");
      }
    }
  });

  projectsEl.addEventListener("click", async (event) => {
    if (event.target.closest(".admin-add-project")) {
      openProjectEditor(
        {
          slug: "",
          title: "",
          description: "",
          image_path: "",
          delivery_type: "content",
          locked: false,
          external_url: "",
          html_content: "",
        },
        { mode: "create" }
      );
      return;
    }

    const card = event.target.closest("[data-project-id]");
    if (!card) return;
    const projectId = Number(card.dataset.projectId);
    if (!Number.isFinite(projectId)) return;

    if (event.target.closest(".admin-edit-project-icon")) {
      try {
        const raw = card.getAttribute("data-project") || "{}";
        const parsed = JSON.parse(raw);
        openProjectEditor(parsed, { mode: "edit" });
      } catch {
        setGateStatus("Failed to open project editor.");
      }
      return;
    }

    if (event.target.closest(".admin-delete-project-icon")) {
      try {
        const response = await apiFetch(endpoints.projectDeleteById(projectId), {
          method: "DELETE",
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(body.error || "Failed to delete project.");
        }
        projectsCache = projectsCache.filter((project) => Number(project.id) !== projectId);
        renderProjects(projectsCache);
      } catch (error) {
        setGateStatus(error.message || "Failed to delete project.");
      }
      return;
    }
  });

  if (tabUsersBtn) tabUsersBtn.addEventListener("click", () => setActiveTab("users"));
  if (tabRequestsBtn) tabRequestsBtn.addEventListener("click", () => setActiveTab("requests"));
  if (tabProjectsBtn) tabProjectsBtn.addEventListener("click", () => setActiveTab("projects"));

  window.addEventListener("auth:changed", () => {
    if (navigationController?.getActivePageId?.() === "admin") {
      loadAdminData();
    } else {
      setControlsVisibility(false);
      setGateStatus("Login as admin to manage access requests.");
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("a[data-target='admin']");
    if (!target) return;
    setTimeout(() => {
      loadAdminData();
    }, 0);
  });

  const startPolling = () => {
    // Polling disabled to avoid disruptive auto-refresh while admin is working.
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const stopPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  const syncAdminRouteState = () => {
    if (navigationController?.getActivePageId?.() === "admin") {
      startPolling();
      loadAdminData();
    } else {
      stopPolling();
    }
  };

  window.addEventListener("popstate", syncAdminRouteState);
  window.addEventListener("hashchange", syncAdminRouteState);

  syncAdminRouteState();
  setActiveTab("users");
}
