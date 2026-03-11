import { APP_EVENT_NAMES } from "../../shared/events.js";
import {
  createProjectEditorModalUi,
  createRequestReviewModalUi,
  createUserProjectsModalUi,
} from "../render/admin-modals-ui.js";
import { createAdminUi, renderUserProjectsContent } from "../render/admin-ui.js";
import {
  approveAccessRequest,
  approveAdminUser,
  deleteAdminProject,
  deleteAdminUser,
  ensureAdminAccess,
  fetchAdminDashboardData,
  fetchAdminProjectsData,
  fetchAdminRequestsData,
  fetchAdminUsersData,
  rejectAccessRequest,
  saveAdminProject,
  updateAdminUserProjectAccess,
  updateAdminUserRole,
} from "../service/admin-service.js";
import {
  buildAdminOverview,
  createEmptyAdminProject,
  findAdminRequest,
  getVisibleAdminRequests,
  getVisibleAdminUsers,
  normalizeAdminRoleFilter,
  normalizeAdminTabId,
  toggleAdminRequestFilter,
} from "../model/admin-model.js";
import { createAdminState } from "../state/admin-state.js";

export function initAdminController({ onUnauthorized } = {}) {
  const adminUi = createAdminUi();
  if (!adminUi.isReady) {
    return;
  }

  const state = createAdminState();
  const findUser = (userId) => state.users.find((user) => Number(user.id) === Number(userId)) || null;
  const setOverview = (overview = null) => {
    state.overview = overview || buildAdminOverview(state.users, state.requests);
    adminUi.renderOverview(state.overview);
  };

  const rerenderOpenUserProjectsModal = () => {
    if (!userProjectsModalUi?.isOpen?.()) {
      return;
    }

    const editingUserId = Number(userProjectsModalUi.getEditingUserId());
    if (!Number.isFinite(editingUserId)) {
      return;
    }

    const user = findUser(editingUserId);
    if (!user) {
      userProjectsModalUi.setStatus("User no longer exists.");
      return;
    }

    userProjectsModalUi.render(
      renderUserProjectsContent({
        user,
        projects: state.projects,
        getRequestRecord: (requestUserId, projectId) =>
          findAdminRequest(state.requests, requestUserId, projectId),
      })
    );
  };

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

  const refreshUsersPanel = async () => {
    console.log("[Admin] Refreshing users panel.");
    const result = await fetchAdminUsersData();
    if (!result.ok) {
      throw new Error(result.error || "Unable to refresh users.");
    }

    state.users = result.users;
    renderUsersView();
    setOverview();
    rerenderOpenUserProjectsModal();
  };

  const refreshRequestsPanel = async () => {
    console.log("[Admin] Refreshing requests panel.");
    const result = await fetchAdminRequestsData();
    if (!result.ok) {
      throw new Error(result.error || "Unable to refresh access requests.");
    }

    state.requests = result.requests;
    renderRequestsView();
    setOverview();
    rerenderOpenUserProjectsModal();
  };

  const refreshProjectsPanel = async () => {
    console.log("[Admin] Refreshing projects panel.");
    const result = await fetchAdminProjectsData();
    if (!result.ok) {
      throw new Error(result.error || "Unable to refresh projects.");
    }

    state.projects = result.projects;
    renderProjectsView();
    rerenderOpenUserProjectsModal();
  };

  const setActiveTab = (tabId) => {
    state.activeTab = normalizeAdminTabId(tabId);
    adminUi.setActiveTab(state.activeTab);
  };

  const runAction = async (task, { activeTab, errorMessage, successMessage, refresh } = {}) => {
    try {
      await task();
      if (activeTab) {
        state.activeTab = activeTab;
      }
      if (typeof refresh === "function") {
        await refresh();
      }
      setActiveTab(state.activeTab);
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
      await refreshProjectsPanel();
      setActiveTab(state.activeTab);
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
      await refreshRequestsPanel();
      setActiveTab(state.activeTab);
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

      state.overview = result.overview;
      state.users = result.users;
      state.requests = result.requests;
      state.projects = result.projects;

      setOverview(state.overview);
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
          refresh: refreshRequestsPanel,
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
        refresh: refreshUsersPanel,
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
          refresh: refreshUsersPanel,
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
        refresh: async () => {
          await refreshUsersPanel();
          await refreshRequestsPanel();
        },
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
        refresh: async () => {
          await refreshProjectsPanel();
          await refreshRequestsPanel();
        },
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
      await refreshRequestsPanel();
      setActiveTab(state.activeTab);

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
