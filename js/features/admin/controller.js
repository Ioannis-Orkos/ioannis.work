import { APP_EVENT_NAMES } from "../../shared/events.js";
import { createProjectEditorModal, createRequestReviewModal, createUserProjectsModal } from "./modals.js";
import {
  loadingMarkup,
  renderOverview,
  renderProjects,
  renderRequests,
  renderUserProjectsContent,
  renderUsers,
} from "./render.js";
import {
  approveAccessRequest,
  approveAdminUser,
  deleteAdminProject,
  deleteAdminUser,
  ensureAdminAccess,
  fetchAdminDashboardData,
  rejectAccessRequest,
  saveAdminProject,
  updateAdminUserProjectAccess,
  updateAdminUserRole,
} from "./service.js";
import { createAdminState } from "./state.js";

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

  if (!adminPage || !gateStatusEl || !controlsEl || !overviewEl || !usersEl || !requestsEl || !projectsEl) {
    return;
  }

  const state = createAdminState();

  const setGateStatus = (message) => {
    gateStatusEl.textContent = message || "";
  };

  const setControlsVisibility = (isVisible) => {
    controlsEl.hidden = !isVisible;
    if (!isVisible) {
      overviewEl.innerHTML = "";
      usersEl.innerHTML = "";
      requestsEl.innerHTML = "";
      projectsEl.innerHTML = "";
    }
  };

  const getRequestRecord = (userId, projectId) =>
    state.requests.find(
      (request) => Number(request.user_id) === Number(userId) && Number(request.project_id) === Number(projectId)
    ) || null;

  const renderUsersView = () => {
    renderUsers(usersEl, {
      users: state.users,
      userSearchQuery: state.userSearchQuery,
      userRoleFilter: state.userRoleFilter,
      currentUserId: Number(window.__AUTH_USER?.id || 0),
    });
  };

  const renderRequestsView = () => {
    renderRequests(requestsEl, {
      requests: state.requests,
      requestFilter: state.requestFilter,
      requestSearchQuery: state.requestSearchQuery,
    });
  };

  const renderProjectsView = () => {
    renderProjects(projectsEl, state.projects);
  };

  const setActiveTab = (tabId) => {
    const activeTab = String(tabId || state.activeTab || "users");
    state.activeTab = activeTab;

    new Map([
      ["users", tabUsersBtn],
      ["requests", tabRequestsBtn],
      ["projects", tabProjectsBtn],
    ]).forEach((button, key) => {
      if (!button) return;
      button.classList.toggle("active", key === activeTab);
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== activeTab;
    });
  };

  const userProjectsModal = createUserProjectsModal();
  const projectEditorModal = createProjectEditorModal({
    onSubmit: async ({ mode, projectId, payload }) => {
      if (mode !== "create" && !Number.isFinite(projectId)) {
        throw new Error("Project reference missing.");
      }

      await saveAdminProject(mode === "create" ? null : projectId, payload);
      state.activeTab = "projects";
      await refreshAdminData();
    },
  });
  const requestReviewModal = createRequestReviewModal({
    onSubmit: async ({ requestId, note }) => {
      if (!Number.isFinite(requestId)) {
        throw new Error("Request reference missing.");
      }

      await rejectAccessRequest(requestId, note);
      state.requestFilter = "all";
      state.activeTab = "requests";
      await refreshAdminData();
    },
  });

  const renderUserProjectsModal = (user) => {
    userProjectsModal.open(
      renderUserProjectsContent({
        user,
        projects: state.projects,
        getRequestRecord,
      }),
      Number(user.id)
    );
  };

  const loadAdminData = async ({ force = false } = {}) => {
    if (state.isLoading) return;
    if (!force && state.hasLoaded && navigationController?.getActivePageId?.() === "admin") {
      return;
    }

    state.isLoading = true;
    setGateStatus("");

    const authState = await ensureAdminAccess();
    setControlsVisibility(Boolean(authState.ok));

    if (!authState.ok) {
      state.hasLoaded = false;
      if (navigationController?.getActivePageId?.() === "admin") {
        navigationController.navigateTo("home", { push: false });
        history.replaceState({ type: "page", targetId: "home" }, "", "/");
      }
      state.isLoading = false;
      return;
    }

    try {
      overviewEl.innerHTML = loadingMarkup;
      usersEl.innerHTML = loadingMarkup;
      requestsEl.innerHTML = loadingMarkup;
      projectsEl.innerHTML = loadingMarkup;

      const result = await fetchAdminDashboardData();
      if (!result.ok) {
        setGateStatus(result.error.startsWith("Unable to load") ? "" : result.error);
        return;
      }

      state.users = result.users;
      state.requests = result.requests;
      state.projects = result.projects;

      renderOverview(overviewEl, result.overview);
      renderUsersView();
      renderRequestsView();
      renderProjectsView();
      setActiveTab(state.activeTab);
      state.hasLoaded = true;
      setGateStatus("");
    } catch {
      state.hasLoaded = false;
      setGateStatus("");
    } finally {
      state.isLoading = false;
    }
  };

  const refreshAdminData = async () => {
    state.hasLoaded = false;
    await loadAdminData({ force: true });
  };

  requestsEl.addEventListener("click", async (event) => {
    const filterBtn = event.target.closest(".admin-req-filter-toggle[data-filter-toggle]");
    if (filterBtn) {
      state.requestFilter = state.requestFilter === "all" ? "pending" : "all";
      renderRequestsView();
      return;
    }

    const row = event.target.closest("tr[data-request-id]");
    if (!row) return;
    const requestId = Number(row.dataset.requestId);
    if (!Number.isFinite(requestId)) return;

    const approveBtn = event.target.closest(".admin-request-approve[data-status]");
    if (approveBtn) {
      try {
        approveBtn.disabled = true;
        await approveAccessRequest(requestId);
        state.requestFilter = "all";
        state.activeTab = "requests";
        await refreshAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to update request.");
      } finally {
        approveBtn.disabled = false;
      }
      return;
    }

    if (event.target.closest(".admin-request-reject[data-status]")) {
      requestReviewModal.open(requestId);
    }
  });

  requestsEl.addEventListener("input", (event) => {
    const searchInput = event.target.closest(".admin-requests-search");
    if (!searchInput) return;
    state.requestSearchQuery = String(searchInput.value || "");
    renderRequestsView();
  });

  usersEl.addEventListener("input", (event) => {
    const searchInput = event.target.closest(".admin-users-search");
    if (!searchInput) return;
    state.userSearchQuery = String(searchInput.value || "");
    renderUsersView();
  });

  usersEl.addEventListener("change", (event) => {
    const roleFilter = event.target.closest(".admin-users-role-filter");
    if (!roleFilter) return;
    const nextFilter = String(roleFilter.value || "all").toLowerCase();
    state.userRoleFilter = ["all", "admin", "user"].includes(nextFilter) ? nextFilter : "all";
    renderUsersView();
  });

  usersEl.addEventListener("click", async (event) => {
    const row = event.target.closest("tr[data-user-id]");
    if (!row) return;
    const userId = Number(row.dataset.userId);
    if (!Number.isFinite(userId)) return;

    if (event.target.closest(".admin-manage-user-projects")) {
      const user = state.users.find((item) => Number(item.id) === userId);
      if (!user) {
        setGateStatus("User not found.");
        return;
      }

      renderUserProjectsModal(user);
      return;
    }

    if (event.target.closest(".admin-toggle-user-role")) {
      try {
        const toggleBtn = event.target.closest(".admin-toggle-user-role");
        const nextRole = String(toggleBtn?.dataset.nextRole || "").toLowerCase() === "user" ? "user" : "admin";
        await updateAdminUserRole(userId, nextRole);
        state.activeTab = "users";
        await refreshAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to update user role.");
      }
      return;
    }

    if (event.target.closest(".admin-approve-user")) {
      const approveBtn = event.target.closest(".admin-approve-user");
      const user = state.users.find((item) => Number(item.id) === userId);
      if (!user) {
        setGateStatus("User not found.");
        return;
      }

      try {
        approveBtn.disabled = true;
        await approveAdminUser(userId);
        state.activeTab = "users";
        await refreshAdminData();
        setGateStatus(
          user.email_verified
            ? "User approved."
            : "User approved. Email verification is still required before login."
        );
      } catch (error) {
        setGateStatus(error.message || "Failed to approve user.");
      } finally {
        approveBtn.disabled = false;
      }
      return;
    }

    if (event.target.closest(".admin-delete-user")) {
      try {
        await deleteAdminUser(userId);
        state.activeTab = "users";
        await refreshAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to delete user.");
      }
    }
  });

  userProjectsModal.root.addEventListener("click", async (event) => {
    const toggleBtn = event.target.closest(".admin-user-project-toggle[data-project-toggle]");
    if (!toggleBtn || !userProjectsModal.isOpen()) return;

    const userId = Number(userProjectsModal.getEditingUserId());
    if (!Number.isFinite(userId)) return;

    const action = String(toggleBtn.dataset.projectToggle || "");
    if (!["assign", "remove"].includes(action)) return;

    const projectRow = toggleBtn.closest("[data-project-id]");
    const projectId = Number(projectRow?.dataset.projectId);
    if (!Number.isFinite(projectId)) return;

    try {
      toggleBtn.disabled = true;
      userProjectsModal.setStatus("", { loading: true });
      await updateAdminUserProjectAccess(userId, projectId, action);
      state.activeTab = "users";
      await refreshAdminData();
      const user = state.users.find((item) => Number(item.id) === userId);
      if (user) {
        userProjectsModal.render(
          renderUserProjectsContent({
            user,
            projects: state.projects,
            getRequestRecord,
          })
        );
      }
      userProjectsModal.setStatus(
        action === "assign" ? "Project added to user." : "Project removed from user."
      );
    } catch (error) {
      userProjectsModal.setStatus(error.message || "Failed to update project access.");
    } finally {
      toggleBtn.disabled = false;
    }
  });

  projectsEl.addEventListener("click", async (event) => {
    if (event.target.closest(".admin-add-project")) {
      projectEditorModal.open(
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
        const parsed = JSON.parse(card.getAttribute("data-project") || "{}");
        projectEditorModal.open(parsed, { mode: "edit" });
      } catch {
        setGateStatus("Failed to open project editor.");
      }
      return;
    }

    if (event.target.closest(".admin-delete-project-icon")) {
      try {
        await deleteAdminProject(projectId);
        state.activeTab = "projects";
        await refreshAdminData();
      } catch (error) {
        setGateStatus(error.message || "Failed to delete project.");
      }
    }
  });

  tabUsersBtn?.addEventListener("click", () => setActiveTab("users"));
  tabRequestsBtn?.addEventListener("click", () => setActiveTab("requests"));
  tabProjectsBtn?.addEventListener("click", () => setActiveTab("projects"));

  window.addEventListener(APP_EVENT_NAMES.authChanged, () => {
    state.hasLoaded = false;
    if (navigationController?.getActivePageId?.() === "admin") {
      loadAdminData({ force: true });
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
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  };

  const stopPolling = () => {
    if (!state.pollTimer) return;
    clearInterval(state.pollTimer);
    state.pollTimer = null;
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
