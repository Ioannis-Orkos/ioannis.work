import { AUTH_API_BASE_URL } from "./config.js";

const AUTH_TOKEN_KEYS = ["auth-token", "access-token", "site-auth-token"];

const endpoints = {
  me: `${AUTH_API_BASE_URL}/api/auth/me`,
  overview: `${AUTH_API_BASE_URL}/api/admin/overview`,
  users: `${AUTH_API_BASE_URL}/api/admin/users`,
  projects: `${AUTH_API_BASE_URL}/api/admin/projects`,
  accessRequests: `${AUTH_API_BASE_URL}/api/admin/access-requests`,
  accessRequestById: (id) => `${AUTH_API_BASE_URL}/api/admin/access-requests/${id}`,
  projectById: (id) => `${AUTH_API_BASE_URL}/api/admin/projects/${id}`,
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
    usersEl.innerHTML = `
      <table class="admin-table">
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
          ${users
            .map((user) => {
              const canDelete = Number(user.id) !== currentUserId;
              const canUpgrade = String(user.role || "").toLowerCase() !== "admin" && canDelete;
              return `
                <tr data-user-id="${user.id}">
                  <td>${user.full_name || "No Name"}</td>
                  <td>${user.email}</td>
                  <td><span class="admin-badge">${user.role}</span></td>
                  <td><span class="admin-badge">${user.status}</span></td>
                  <td class="admin-actions-cell">
                    <button type="button" class="auth-switch-button admin-upgrade-user" ${canUpgrade ? "" : "disabled"}>Make Admin</button>
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

    requestsEl.innerHTML = `
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
          ${requests
            .map((request) => {
              const isPending = request.status === "pending";
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
                    <button type="button" class="modal-submit admin-approve" ${isPending ? "" : "disabled"}>Approve</button>
                    <button type="button" class="auth-switch-button admin-reject" ${isPending ? "" : "disabled"}>Reject</button>
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
      <table class="admin-table admin-table-projects">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Image</th>
            <th>Status</th>
            <th>Delivery</th>
            <th>External URL</th>
            <th>Content</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${projects
            .map((project) => {
              const locked = Boolean(project.locked);
              const content = String(project.html_content || "").trim();
              const deliveryType = String(project.delivery_type || "content").toLowerCase() === "link" ? "link" : "content";
              const externalUrl = String(project.external_url || "").trim();
              const imagePath = String(project.image_path || "").trim();
              return `
                <tr data-project-id="${project.id}" data-locked="${locked ? "1" : "0"}">
                  <td>${project.title}</td>
                  <td>${project.slug}</td>
                  <td><input class="admin-image-path-input" type="text" value="${imagePath}" placeholder="folder/asset/preview.webp" /></td>
                  <td><span class="admin-badge">${locked ? "locked" : "open"}</span></td>
                  <td>
                    <select class="admin-delivery-select">
                      <option value="content" ${deliveryType === "content" ? "selected" : ""}>content</option>
                      <option value="link" ${deliveryType === "link" ? "selected" : ""}>link</option>
                    </select>
                  </td>
                  <td><input class="admin-external-url-input" type="url" value="${externalUrl}" placeholder="https://..." /></td>
                  <td>
                    <textarea class="admin-content-input" rows="2" placeholder="Project HTML content...">${content}</textarea>
                  </td>
                  <td class="admin-actions-cell">
                    <button type="button" class="auth-switch-button admin-toggle-lock">${locked ? "Unlock" : "Lock"}</button>
                    <button type="button" class="modal-submit admin-save-content">Save Content</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
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
      const requests = Array.isArray(requestsBody?.requests) ? requestsBody.requests : [];
      const projects = Array.isArray(projectsBody?.projects) ? projectsBody.projects : [];
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
    const card = event.target.closest(".admin-item[data-request-id]");
    if (!card) return;
    const requestId = Number(card.dataset.requestId);
    if (!Number.isFinite(requestId)) return;

    if (event.target.closest(".admin-approve")) {
      try {
        await updateAccessRequest(requestId, "approved");
        await loadAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to approve request.");
      }
      return;
    }

    if (event.target.closest(".admin-reject")) {
      try {
        await updateAccessRequest(requestId, "rejected");
        await loadAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to reject request.");
      }
    }
  });

  usersEl.addEventListener("click", async (event) => {
    const row = event.target.closest("tr[data-user-id]");
    if (!row) return;
    const userId = Number(row.dataset.userId);
    if (!Number.isFinite(userId)) return;

    if (event.target.closest(".admin-upgrade-user")) {
      try {
        const response = await apiFetch(endpoints.userRoleById(userId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "admin" }),
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(body.error || "Failed to update user role.");
        }
        await loadAdminData();
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
        await loadAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to delete user.");
      }
    }
  });

  projectsEl.addEventListener("click", async (event) => {
    const row = event.target.closest("tr[data-project-id]");
    if (!row) return;
    const projectId = Number(row.dataset.projectId);
    if (!Number.isFinite(projectId)) return;

    const isLocked = String(row.dataset.locked || "") === "1";

    if (event.target.closest(".admin-save-content")) {
      const contentInput = row.querySelector(".admin-content-input");
      const externalUrlInput = row.querySelector(".admin-external-url-input");
      const deliverySelect = row.querySelector(".admin-delivery-select");
      const imagePathInput = row.querySelector(".admin-image-path-input");
      const htmlContent = String(contentInput?.value || "");
      const externalUrl = String(externalUrlInput?.value || "").trim();
      const deliveryType = String(deliverySelect?.value || "content").toLowerCase();
      const imagePath = String(imagePathInput?.value || "").trim();
      try {
        const response = await apiFetch(endpoints.projectById(projectId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            htmlContent,
            externalUrl,
            deliveryType,
            imagePath,
          }),
        });
        const body = await parseJsonSafe(response);
        if (!response.ok) {
          throw new Error(body.error || "Failed to save project content.");
        }
        await loadAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to save project content.");
      }
      return;
    }

    if (!event.target.closest(".admin-toggle-lock")) return;

    try {
      const response = await apiFetch(endpoints.projectById(projectId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locked: !isLocked,
        }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(body.error || "Failed to update project.");
      }
      await loadAdminData();
    } catch (error) {
      setGateStatus(error.message || "Failed to update project.");
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
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (navigationController?.getActivePageId?.() === "admin") {
        loadAdminData();
      }
    }, 10000);
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
