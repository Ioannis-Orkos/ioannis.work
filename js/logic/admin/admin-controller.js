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
import {
  createEmptyAdminProject,
  findAdminRequest,
  getVisibleAdminRequests,
  getVisibleAdminUsers,
  normalizeAdminRoleFilter,
  normalizeAdminTabId,
  toggleAdminRequestFilter,
} from "./admin-model.js";
import { createAdminState } from "./admin-state.js";

export function initAdminController({ onUnauthorized } = {}) {
  const adminUi = createAdminUi();
  if (!adminUi.isReady) {
    return;
  }

  const state = createAdminState();
  const findUser = (userId) => state.users.find((user) => Number(user.id) === Number(userId)) || null;

  const renderUsersView = () => {
    adminUi.renderUsers({
      users: getVisibleAdminUsers({
        users: state.users,
        query: state.userSearchQuery,
        roleFilter: state.userRoleFilter,
      }),
      hasUsers: state.users.length > 0,
      userSearchQuery: state.userSearchQuery,
      userRoleFilter: state.userRoleFilter,
      currentUserId: Number(window.__AUTH_USER?.id || 0),
    });
  };

  const renderRequestsView = () => {
    adminUi.renderRequests({
      requests: getVisibleAdminRequests({
        requests: state.requests,
        filter: state.requestFilter,
        query: state.requestSearchQuery,
      }),
      hasRequests: state.requests.length > 0,
      requestFilter: state.requestFilter,
      requestSearchQuery: state.requestSearchQuery,
    });
  };

  const renderProjectsView = () => {
    adminUi.renderProjects(state.projects);
  };

  const setActiveTab = (tabId) => {
    state.activeTab = normalizeAdminTabId(tabId);
    adminUi.setActiveTab(state.activeTab);
  };

  const refreshAdminData = async () => {
    state.hasLoaded = false;
    await loadAdminData({ force: true });
  };

  const runAction = async (task, { activeTab, errorMessage, successMessage } = {}) => {
    try {
      await task();
      if (activeTab) {
        state.activeTab = activeTab;
      }
      await refreshAdminData();
      if (successMessage) {
        adminUi.setGateStatus(typeof successMessage === "function" ? successMessage() : successMessage);
      }
    } catch (error) {
      adminUi.setGateStatus(error.message || errorMessage || "Action failed.");
    }
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
        getRequestRecord: (requestUserId, projectId) =>
          findAdminRequest(state.requests, requestUserId, projectId),
      }),
      Number(user.id)
    );
  };

  const loadAdminData = async ({ force = false } = {}) => {
    if (state.isLoading) {
      return;
    }

    if (!force && state.hasLoaded) {
      return;
    }

    state.isLoading = true;
    adminUi.setGateStatus("");

    const authState = await ensureAdminAccess();
    adminUi.setControlsVisibility(Boolean(authState.ok));

    if (!authState.ok) {
      state.hasLoaded = false;
      adminUi.setGateStatus(authState.reason || "Admin access required.");
      state.isLoading = false;
      onUnauthorized?.(authState);
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

  adminUi.bindHandlers({
    onTabChange(tabId) {
      setActiveTab(tabId);
    },
    onRequestFilterToggle() {
      state.requestFilter = toggleAdminRequestFilter(state.requestFilter);
      renderRequestsView();
    },
    onRequestSearch(query) {
      state.requestSearchQuery = query;
      renderRequestsView();
    },
    async onRequestApprove({ requestId, button }) {
      try {
        button.disabled = true;
        state.requestFilter = "all";
        await runAction(() => approveAccessRequest(requestId), {
          activeTab: "requests",
          errorMessage: "Failed to update request.",
        });
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
      state.userRoleFilter = normalizeAdminRoleFilter(nextFilter);
      renderUsersView();
    },
    onUserManageProjects({ userId }) {
      const user = findUser(userId);
      if (!user) {
        adminUi.setGateStatus("User not found.");
        return;
      }

      renderUserProjectsModal(user);
    },
    async onUserToggleRole({ userId, nextRole }) {
      await runAction(() => updateAdminUserRole(userId, nextRole), {
        activeTab: "users",
        errorMessage: "Failed to update user role.",
      });
    },
    async onUserApprove({ userId, button }) {
      const user = findUser(userId);
      if (!user) {
        adminUi.setGateStatus("User not found.");
        return;
      }

      try {
        button.disabled = true;
        await runAction(() => approveAdminUser(userId), {
          activeTab: "users",
          errorMessage: "Failed to approve user.",
          successMessage: user.emailVerified
            ? "User approved."
            : "User approved. Email verification is still required before login.",
        });
      } finally {
        button.disabled = false;
      }
    },
    async onUserDelete({ userId }) {
      await runAction(() => deleteAdminUser(userId), {
        activeTab: "users",
        errorMessage: "Failed to delete user.",
      });
    },
    onProjectCreate() {
      projectEditorModalUi?.open(createEmptyAdminProject(), { mode: "create" });
    },
    onProjectEdit({ rawProject }) {
      try {
        projectEditorModalUi?.open(JSON.parse(rawProject || "{}"), { mode: "edit" });
      } catch {
        adminUi.setGateStatus("Failed to open project editor.");
      }
    },
    async onProjectDelete({ projectId }) {
      await runAction(() => deleteAdminProject(projectId), {
        activeTab: "projects",
        errorMessage: "Failed to delete project.",
      });
    },
  });

  userProjectsModalUi?.bindToggle(async ({ userId, projectId, action, button }) => {
    if (!Number.isFinite(userId)) {
      return;
    }

    try {
      button.disabled = true;
      userProjectsModalUi.setStatus("", { loading: true });
      await updateAdminUserProjectAccess(userId, projectId, action);
      state.activeTab = "users";
      await refreshAdminData();

      const user = findUser(userId);
      if (user) {
        userProjectsModalUi.render(
          renderUserProjectsContent({
            user,
            projects: state.projects,
            getRequestRecord: (requestUserId, nextProjectId) =>
              findAdminRequest(state.requests, requestUserId, nextProjectId),
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
    loadAdminData();
  });

  setActiveTab("users");
  loadAdminData();
}
