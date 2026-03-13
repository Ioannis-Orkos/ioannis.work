import { APP_EVENT_NAMES } from "../../shared/events.js";
import {
  createContentEditorModalUi,
  createRequestReviewModalUi,
  createUserContentModalUi,
} from "../render/admin-modals-ui.js";
import { createAdminUi, renderUserContentAccess } from "../render/admin-ui.js";
import {
  approveAccessRequest,
  approveAdminUser,
  deleteAdminContent,
  deleteAdminUser,
  ensureAdminAccess,
  fetchAdminAccessRequestsData,
  fetchAdminContentData,
  fetchAdminDashboardData,
  fetchAdminUsersData,
  rejectAccessRequest,
  saveAdminContent,
  updateAdminUserContentAccess,
  updateAdminUserRole,
} from "../service/admin-service.js";
import {
  buildAdminOverview,
  createEmptyAdminContent,
  findAccessRequestByContent,
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
    state.overview = overview || buildAdminOverview(state.users, state.accessRequests);
    adminUi.renderOverview(state.overview);
  };

  const userContentModalUi = createUserContentModalUi();
  const contentEditorModalUi = createContentEditorModalUi({
    onSubmit: async ({ mode, contentId, payload }) => {
      if (mode !== "create" && !Number.isFinite(contentId)) {
        throw new Error("Content reference missing.");
      }

      await saveAdminContent(mode === "create" ? null : contentId, payload);
      state.activeTab = "content";
      await refreshContentPanel();
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

  const rerenderOpenUserContentModal = () => {
    if (!userContentModalUi?.isOpen?.()) {
      return;
    }

    const editingUserId = Number(userContentModalUi.getEditingUserId());
    if (!Number.isFinite(editingUserId)) {
      return;
    }

    const user = findUser(editingUserId);
    if (!user) {
      userContentModalUi.setStatus("User no longer exists.");
      return;
    }

    userContentModalUi.render(
      renderUserContentAccess({
        user,
        contentItems: state.contentItems,
        getRequestRecord: (requestUserId, contentId) =>
          findAccessRequestByContent(state.accessRequests, requestUserId, contentId),
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
        accessRequests: state.accessRequests,
        filter: state.requestFilter,
        query: state.requestSearchQuery,
      }),
      hasRequests: state.accessRequests.length > 0,
      requestFilter: state.requestFilter,
      requestSearchQuery: state.requestSearchQuery,
    });
  };

  const renderContentView = () => {
    adminUi.renderContent(state.contentItems);
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
    rerenderOpenUserContentModal();
  };

  const refreshRequestsPanel = async () => {
    console.log("[Admin] Refreshing requests panel.");
    const result = await fetchAdminAccessRequestsData();
    if (!result.ok) {
      throw new Error(result.error || "Unable to refresh access requests.");
    }

    state.accessRequests = result.requests;
    renderRequestsView();
    setOverview();
    rerenderOpenUserContentModal();
  };

  const refreshContentPanel = async () => {
    console.log("[Admin] Refreshing content panel.");
    const result = await fetchAdminContentData();
    if (!result.ok) {
      throw new Error(result.error || "Unable to refresh content.");
    }

    state.contentItems = result.contentItems;
    renderContentView();
    rerenderOpenUserContentModal();
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

  const renderUserContentModal = (user) => {
    userContentModalUi?.open(
      renderUserContentAccess({
        user,
        contentItems: state.contentItems,
        getRequestRecord: (requestUserId, contentId) =>
          findAccessRequestByContent(state.accessRequests, requestUserId, contentId),
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
      state.accessRequests = result.accessRequests;
      state.contentItems = result.contentItems;

      setOverview(state.overview);
      renderUsersView();
      renderRequestsView();
      renderContentView();
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
    onUserManageContent({ userId }) {
      const user = findUser(userId);
      if (!user) {
        adminUi.setGateStatus("User not found.");
        return;
      }

      renderUserContentModal(user);
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
            : "User and Email verification approved.",
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
    onContentCreate() {
      contentEditorModalUi?.open(createEmptyAdminContent(), { mode: "create" });
    },
    onContentEdit({ rawContent }) {
      try {
        contentEditorModalUi?.open(JSON.parse(rawContent || "{}"), { mode: "edit" });
      } catch {
        adminUi.setGateStatus("Failed to open content editor.");
      }
    },
    async onContentDelete({ contentId }) {
      await runAction(() => deleteAdminContent(contentId), {
        activeTab: "content",
        errorMessage: "Failed to delete content.",
        refresh: async () => {
          await refreshContentPanel();
          await refreshRequestsPanel();
        },
      });
    },
  });

  userContentModalUi?.bindToggle(async ({ userId, contentId, action, button }) => {
    if (!Number.isFinite(userId)) {
      return;
    }

    try {
      button.disabled = true;
      userContentModalUi.setStatus("", { loading: true });
      await updateAdminUserContentAccess(userId, contentId, action);
      state.activeTab = "users";
      await refreshRequestsPanel();
      setActiveTab(state.activeTab);

      userContentModalUi.setStatus(
        action === "assign" ? "Content access added to user." : "Content access removed from user."
      );
    } catch (error) {
      userContentModalUi.setStatus(error.message || "Failed to update content access.");
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
