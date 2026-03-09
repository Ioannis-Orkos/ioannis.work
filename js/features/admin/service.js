import { adminApi } from "../../api/admin-api.js";
import { authApi } from "../../api/auth-api.js";
import { setAuthUser } from "../auth/session-store.js";

function buildFallbackOverview(users, requests) {
  return {
    usersTotal: users.length,
    pendingUsers: users.filter((user) => user.status === "pending").length,
    pendingRequests: requests.filter((request) => request.status === "pending").length,
    approvedRequests: requests.filter((request) => request.status === "approved").length,
    rejectedRequests: requests.filter((request) => request.status === "rejected").length,
  };
}

export async function ensureAdminAccess() {
  try {
    const { response, body } = await authApi.getCurrentSession();
    if (!response.ok) {
      return {
        ok: false,
        reason: body.error || (response.status === 401 ? "Login required." : "Unable to verify session."),
      };
    }

    setAuthUser(body?.user || window.__AUTH_USER || null);
    if (String(body?.user?.role || "").toLowerCase() !== "admin") {
      return {
        ok: false,
        reason: "Admin access required.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "Unable to verify session.",
    };
  }
}

export async function fetchAdminDashboardData() {
  const [overviewResult, usersResult, requestsResult, projectsResult] = await Promise.all([
    adminApi.getOverview().catch(() => null),
    adminApi.getUsers(),
    adminApi.getAccessRequests(),
    adminApi.getProjects(),
  ]);

  if (!usersResult.response.ok || !requestsResult.response.ok || !projectsResult.response.ok) {
    return {
      ok: false,
      error:
        usersResult.body?.error ||
        requestsResult.body?.error ||
        projectsResult.body?.error ||
        "Unable to load admin data.",
    };
  }

  const users = Array.isArray(usersResult.body?.users) ? usersResult.body.users : [];
  const requests = Array.isArray(requestsResult.body?.requests) ? requestsResult.body.requests : [];
  const projects = Array.isArray(projectsResult.body?.projects) ? projectsResult.body.projects : [];

  return {
    ok: true,
    overview:
      overviewResult?.response?.ok && overviewResult.body?.overview
        ? overviewResult.body.overview
        : buildFallbackOverview(users, requests),
    users,
    requests,
    projects,
  };
}

export async function saveAdminProject(projectId, payload) {
  const { response, body } = await adminApi.saveProject(projectId, payload);
  if (!response.ok) {
    throw new Error(body.error || "Failed to save project.");
  }
}

export async function rejectAccessRequest(requestId, note) {
  const { response, body } = await adminApi.updateAccessRequest(requestId, "rejected", note);
  if (!response.ok) {
    throw new Error(body.error || "Failed to reject request.");
  }
}

export async function approveAccessRequest(requestId) {
  const { response, body } = await adminApi.updateAccessRequest(requestId, "approved");
  if (!response.ok) {
    throw new Error(body.error || "Failed to update access request.");
  }
}

export async function updateAdminUserRole(userId, role) {
  const { response, body } = await adminApi.updateUserRole(userId, role);
  if (!response.ok) {
    throw new Error(body.error || "Failed to update user role.");
  }
}

export async function approveAdminUser(userId) {
  const { response, body } = await adminApi.updateUserStatus(userId, "active");
  if (!response.ok) {
    throw new Error(body.error || "Failed to approve user.");
  }
}

export async function deleteAdminUser(userId) {
  const { response, body } = await adminApi.deleteUser(userId);
  if (!response.ok) {
    throw new Error(body.error || "Failed to delete user.");
  }
}

export async function updateAdminUserProjectAccess(userId, projectId, action) {
  const { response, body } = await adminApi.updateUserProjectAccess(userId, projectId, action);
  if (!response.ok) {
    throw new Error(body.error || "Failed to update project access.");
  }
}

export async function deleteAdminProject(projectId) {
  const { response, body } = await adminApi.deleteProject(projectId);
  if (!response.ok) {
    throw new Error(body.error || "Failed to delete project.");
  }
}
