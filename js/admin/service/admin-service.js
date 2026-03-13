import { adminApi } from "../../shared/api/admin-api.js";
import { fetchCurrentSession } from "../../shared/auth/auth-service.js";

function buildFallbackOverview(users, accessRequests) {
  return {
    usersTotal: users.length,
    pendingUsers: users.filter((user) => user.status === "pending").length,
    pendingRequests: accessRequests.filter((request) => request.status === "pending").length,
    approvedRequests: accessRequests.filter((request) => request.status === "approved").length,
    rejectedRequests: accessRequests.filter((request) => request.status === "rejected").length,
  };
}

function normalizeListPayload(result, key, fallbackMessage) {
  if (!result?.ok) {
    return {
      ok: false,
      error: result?.error || fallbackMessage,
      [key]: [],
    };
  }

  return {
    ok: true,
    error: "",
    [key]: Array.isArray(result.data?.[key]) ? result.data[key] : [],
  };
}

export async function ensureAdminAccess() {
  const user = await fetchCurrentSession({ clearOnFailure: false });
  if (!user?.id) {
    return {
      ok: false,
      reason: "Login required.",
    };
  }

  if (String(user.role || "").toLowerCase() !== "admin") {
    return {
      ok: false,
      reason: "Admin access required.",
    };
  }

  return { ok: true };
}

export async function fetchAdminDashboardData() {
  const [overviewResult, usersResult, accessRequestsResult, contentResult] = await Promise.all([
    adminApi.getOverview().catch(() => null),
    adminApi.getUsers(),
    adminApi.getAccessRequests(),
    adminApi.getContent(),
  ]);

  if (!usersResult.ok || !accessRequestsResult.ok || !contentResult.ok) {
    return {
      ok: false,
      error:
        usersResult.error ||
        accessRequestsResult.error ||
        contentResult.error ||
        "Unable to load admin data.",
    };
  }

  const users = Array.isArray(usersResult.data?.users) ? usersResult.data.users : [];
  const accessRequests = Array.isArray(accessRequestsResult.data?.requests)
    ? accessRequestsResult.data.requests
    : [];
  const contentItems = Array.isArray(contentResult.data?.contentItems)
    ? contentResult.data.contentItems
    : [];

  return {
    ok: true,
    overview:
      overviewResult?.ok && overviewResult.data?.overview
        ? overviewResult.data.overview
        : buildFallbackOverview(users, accessRequests),
    users,
    accessRequests,
    contentItems,
  };
}

export async function fetchAdminUsersData() {
  return normalizeListPayload(await adminApi.getUsers(), "users", "Unable to load users.");
}

export async function fetchAdminAccessRequestsData() {
  return normalizeListPayload(await adminApi.getAccessRequests(), "requests", "Unable to load access requests.");
}

export async function fetchAdminContentData() {
  return normalizeListPayload(await adminApi.getContent(), "contentItems", "Unable to load content.");
}

export async function saveAdminContent(contentId, payload) {
  const result = await adminApi.saveContent(contentId, payload);
  if (!result.ok) {
    throw new Error(result.error || "Failed to save content.");
  }
}

export async function rejectAccessRequest(requestId, note) {
  const result = await adminApi.updateAccessRequest(requestId, "rejected", note);
  if (!result.ok) {
    throw new Error(result.error || "Failed to reject request.");
  }
}

export async function approveAccessRequest(requestId) {
  const result = await adminApi.updateAccessRequest(requestId, "approved");
  if (!result.ok) {
    throw new Error(result.error || "Failed to update access request.");
  }
}

export async function updateAdminUserRole(userId, role) {
  const result = await adminApi.updateUserRole(userId, role);
  if (!result.ok) {
    throw new Error(result.error || "Failed to update user role.");
  }
}

export async function approveAdminUser(userId) {
  const result = await adminApi.updateUserStatus(userId, "active");
  if (!result.ok) {
    throw new Error(result.error || "Failed to approve user.");
  }
}

export async function deleteAdminUser(userId) {
  const result = await adminApi.deleteUser(userId);
  if (!result.ok) {
    throw new Error(result.error || "Failed to delete user.");
  }
}

export async function updateAdminUserContentAccess(userId, contentId, action) {
  const result = await adminApi.updateUserContentAccess(userId, contentId, action);
  if (!result.ok) {
    throw new Error(result.error || "Failed to update content access.");
  }
}

export async function deleteAdminContent(contentId) {
  const result = await adminApi.deleteContent(contentId);
  if (!result.ok) {
    throw new Error(result.error || "Failed to delete content.");
  }
}
