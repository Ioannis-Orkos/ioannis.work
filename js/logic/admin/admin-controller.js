import { APP_EVENT_NAMES } from "../../shared/events.js";
import {
  createProjectEditorModalUi,
  createRequestReviewModalUi,
  createUserProjectsModalUi,
} from "../../ui/admin/admin-modals-ui.js";
import { createAdminUi, renderUserProjectsContent } from "../../ui/admin/admin-ui.js";
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
} from "./admin-service.js";
import { createAdminState } from "./admin-state.js";

export function initAdminController({ navigationController } = {}) {
  const adminUi = createAdminUi();
  if (!adminUi.isReady) {
    return;
  }

  const state = createAdminState();

  const getRequestRecord = (userId, projectId) =>
    state.requests.find(
      (request) => Number(request.user_id) === Number(userId) && Number(request.project_id) === Number(projectId)
    ) || null;

  const renderUsersView = () => {
    adminUi.renderUsers({
      users: state.users,
      userSearchQuery: state.userSearchQuery,
      userRoleFilter: state.userRoleFilter,
      currentUserId: Number(window.__AUTH_USER?.id || 0),
    });
  };

  const renderRequestsView = () => {
    adminUi.renderRequests({
      requests: state.requests,
      requestFilter: state.requestFilter,
      requestSearchQuery: state.requestSearchQuery,
    });
  };

  const renderProjectsView = () => {
    adminUi.renderProjects(state.projects);
  };

  const setActiveTab = (tabId) => {
    state.activeTab = String(tabId || "users");
    adminUi.setActiveTab(state.activeTab);
  };

  const userProjectsModalUi = createUserProjectsModalUi();
  const projectEditorModalUi = createProjectEditorModalUi({
    onSubmit: async ({ mode, projectId, payload }) => {
      if (mode !== "create" && !Number.isFinite(projectId)) {
        throw new Error("Project reference missing.");
      }

      await saveAdminProject(mode === "create" ? null : projectId, payload);
      state.activeTab = "projects";
      await refreshAdminData();
    },
  });
  const requestReviewModalUi = createRequestReviewModalUi({
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
    userProjectsModalUi?.open(
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
    adminUi.setGateStatus("");

    const authState = await ensureAdminAccess();
    adminUi.setControlsVisibility(Boolean(authState.ok));

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
      adminUi.showLoading();

      const result = await fetchAdminDashboardData();
      if (!result.ok) {
        adminUi.setGateStatus(result.error.startsWith("Unable to load") ? "" : result.error);
        return;
      }

      state.users = result.users;
      state.requests = result.requests;
      state.projects = result.projects;

      adminUi.renderOverview(result.overview);
      renderUsersView();
      renderRequestsView();
      renderProjectsView();
      setActiveTab(state.activeTab);
      state.hasLoaded = true;
      adminUi.setGateStatus("");
    } catch {
      state.hasLoaded = false;
      adminUi.setGateStatus("");
    } finally {
      state.isLoading = false;
    }
  };

  const refreshAdminData = async () => {
    state.hasLoaded = false;
    await loadAdminData({ force: true });
  };

  adminUi.bindHandlers({
    onTabChange(tabId) {
      setActiveTab(tabId);
    },
    onRequestFilterToggle() {
      state.requestFilter = state.requestFilter === "all" ? "pending" : "all";
      renderRequestsView();
    },
    onRequestSearch(query) {
      state.requestSearchQuery = query;
      renderRequestsView();
    },
    async onRequestApprove({ requestId, button }) {
      try {
        button.disabled = true;
        await approveAccessRequest(requestId);
        state.requestFilter = "all";
        state.activeTab = "requests";
        await refreshAdminData();
      } catch (error) {
        adminUi.setGateStatus(error.message || "Failed to update request.");
      } finally {
        button.disabled = false;
      }
    },
    onRequestReject({ requestId }) {
      requestReviewModalUi?.open(requestId);
    },
    onUserSearch(query) {
      state.userSearchQuery = query;
      renderUsersView();
    },
    onUserRoleFilterChange(nextFilter) {
      state.userRoleFilter = ["all", "admin", "user"].includes(nextFilter) ? nextFilter : "all";
      renderUsersView();
    },
    onUserManageProjects({ userId }) {
      const user = state.users.find((item) => Number(item.id) === userId);
      if (!user) {
        adminUi.setGateStatus("User not found.");
        return;
      }

      renderUserProjectsModal(user);
    },
    async onUserToggleRole({ userId, nextRole }) {
      try {
        await updateAdminUserRole(userId, nextRole);
        state.activeTab = "users";
        await refreshAdminData();
      } catch (error) {
        adminUi.setGateStatus(error.message || "Failed to update user role.");
      }
    },
    async onUserApprove({ userId, button }) {
      const user = state.users.find((item) => Number(item.id) === userId);
      if (!user) {
        adminUi.setGateStatus("User not found.");
        return;
      }

      try {
        button.disabled = true;
        await approveAdminUser(userId);
        state.activeTab = "users";
        await refreshAdminData();
        adminUi.setGateStatus(
          user.email_verified
            ? "User approved."
            : "User approved. Email verification is still required before login."
        );
      } catch (error) {
        adminUi.setGateStatus(error.message || "Failed to approve user.");
      } finally {
        button.disabled = false;
      }
    },
    async onUserDelete({ userId }) {
      try {
        await deleteAdminUser(userId);
        state.activeTab = "users";
        await refreshAdminData();
      } catch (error) {
        adminUi.setGateStatus(error.message || "Failed to delete user.");
      }
    },
    onProjectCreate() {
      projectEditorModalUi?.open(
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
    },
    onProjectEdit({ rawProject }) {
      try {
        const parsed = JSON.parse(rawProject || "{}");
        projectEditorModalUi?.open(parsed, { mode: "edit" });
      } catch {
        adminUi.setGateStatus("Failed to open project editor.");
      }
    },
    async onProjectDelete({ projectId }) {
      try {
        await deleteAdminProject(projectId);
        state.activeTab = "projects";
        await refreshAdminData();
      } catch (error) {
        adminUi.setGateStatus(error.message || "Failed to delete project.");
      }
    },
  });

  userProjectsModalUi?.bindToggle(async ({ userId, projectId, action, button }) => {
    if (!Number.isFinite(userId)) return;

    try {
      button.disabled = true;
      userProjectsModalUi.setStatus("", { loading: true });
      await updateAdminUserProjectAccess(userId, projectId, action);
      state.activeTab = "users";
      await refreshAdminData();
      const user = state.users.find((item) => Number(item.id) === userId);
      if (user) {
        userProjectsModalUi.render(
          renderUserProjectsContent({
            user,
            projects: state.projects,
            getRequestRecord,
          })
        );
      }
      userProjectsModalUi.setStatus(
        action === "assign" ? "Project added to user." : "Project removed from user."
      );
    } catch (error) {
      userProjectsModalUi.setStatus(error.message || "Failed to update project access.");
    } finally {
      button.disabled = false;
    }
  });

  window.addEventListener(APP_EVENT_NAMES.authChanged, () => {
    state.hasLoaded = false;
    if (navigationController?.getActivePageId?.() === "admin") {
      loadAdminData({ force: true });
    } else {
      adminUi.setControlsVisibility(false);
      adminUi.setGateStatus("Login as admin to manage access requests.");
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("a[data-target='admin']");
    if (!target) return;
    setTimeout(() => {
      loadAdminData();
    }, 0);
  });

  const syncAdminRouteState = () => {
    if (navigationController?.getActivePageId?.() === "admin") {
      loadAdminData();
    }
  };

  window.addEventListener("popstate", syncAdminRouteState);
  window.addEventListener("hashchange", syncAdminRouteState);

  syncAdminRouteState();
  setActiveTab("users");
}
