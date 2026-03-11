import { adminApi } from "../../shared/api/admin-api.js";
import { fetchCurrentSession } from "../../shared/auth/auth-service.js";

function buildFallbackOverview(users, requests) {
  return {
    usersTotal: users.length,
    pendingUsers: users.filter((user) => user.status === "pending").length,
    pendingRequests: requests.filter((request) => request.status === "pending").length,
    approvedRequests: requests.filter((request) => request.status === "approved").length,
    rejectedRequests: requests.filter((request) => request.status === "rejected").length,
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
  const [overviewResult, usersResult, requestsResult, projectsResult] = await Promise.all([
    adminApi.getOverview().catch(() => null),
    adminApi.getUsers(),
    adminApi.getAccessRequests(),
    adminApi.getProjects(),
  ]);

  if (!usersResult.ok || !requestsResult.ok || !projectsResult.ok) {
    return {
      ok: false,
      error: usersResult.error || requestsResult.error || projectsResult.error || "Unable to load admin data.",
    };
  }

  const users = Array.isArray(usersResult.data?.users) ? usersResult.data.users : [];
  const requests = Array.isArray(requestsResult.data?.requests) ? requestsResult.data.requests : [];
  const projects = Array.isArray(projectsResult.data?.projects) ? projectsResult.data.projects : [];

  return {
    ok: true,
    overview:
      overviewResult?.ok && overviewResult.data?.overview
        ? overviewResult.data.overview
        : buildFallbackOverview(users, requests),
    users,
    requests,
    projects,
  };
}

export async function fetchAdminUsersData() {
  return normalizeListPayload(await adminApi.getUsers(), "users", "Unable to load users.");
}

export async function fetchAdminRequestsData() {
  return normalizeListPayload(await adminApi.getAccessRequests(), "requests", "Unable to load access requests.");
}

export async function fetchAdminProjectsData() {
  return normalizeListPayload(await adminApi.getProjects(), "projects", "Unable to load projects.");
}

export async function saveAdminProject(projectId, payload) {
  const result = await adminApi.saveProject(projectId, payload);
  if (!result.ok) {
    throw new Error(result.error || "Failed to save project.");
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

export async function updateAdminUserProjectAccess(userId, projectId, action) {
  const result = await adminApi.updateUserProjectAccess(userId, projectId, action);
  if (!result.ok) {
    throw new Error(result.error || "Failed to update project access.");
  }
}

export async function deleteAdminProject(projectId) {
  const result = await adminApi.deleteProject(projectId);
  if (!result.ok) {
    throw new Error(result.error || "Failed to delete project.");
  }
}
