import { AUTH_API_BASE_URL } from "../shared/config.js";
import { requestJson } from "./http.js";

const endpoints = Object.freeze({
  overview: `${AUTH_API_BASE_URL}/api/admin/overview`,
  users: `${AUTH_API_BASE_URL}/api/admin/users`,
  projects: `${AUTH_API_BASE_URL}/api/admin/projects`,
  accessRequests: `${AUTH_API_BASE_URL}/api/admin/access-requests`,
  accessRequestById: (id) => `${AUTH_API_BASE_URL}/api/admin/access-requests/${id}`,
  projectById: (id) => `${AUTH_API_BASE_URL}/api/admin/projects/${id}`,
  userRoleById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}/role`,
  userById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}`,
  userStatusById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}/status`,
  userProjectByIds: (userId, projectId) =>
    `${AUTH_API_BASE_URL}/api/admin/users/${userId}/projects/${projectId}`,
});

function withJsonBody(method, payload) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

export const adminApi = Object.freeze({
  endpoints,
  getOverview() {
    return requestJson(endpoints.overview, { method: "GET" });
  },
  getUsers() {
    return requestJson(endpoints.users, { method: "GET" });
  },
  getProjects() {
    return requestJson(endpoints.projects, { method: "GET" });
  },
  getAccessRequests() {
    return requestJson(endpoints.accessRequests, { method: "GET" });
  },
  updateAccessRequest(requestId, status, note = null) {
    return requestJson(endpoints.accessRequestById(requestId), withJsonBody("PATCH", { status, note }));
  },
  saveProject(projectId, payload) {
    return requestJson(
      Number.isFinite(projectId) ? endpoints.projectById(projectId) : endpoints.projects,
      withJsonBody(Number.isFinite(projectId) ? "PATCH" : "POST", payload)
    );
  },
  deleteProject(projectId) {
    return requestJson(endpoints.projectById(projectId), { method: "DELETE" });
  },
  updateUserRole(userId, role) {
    return requestJson(endpoints.userRoleById(userId), withJsonBody("PATCH", { role }));
  },
  updateUserStatus(userId, status) {
    return requestJson(endpoints.userStatusById(userId), withJsonBody("PATCH", { status }));
  },
  deleteUser(userId) {
    return requestJson(endpoints.userById(userId), { method: "DELETE" });
  },
  updateUserProjectAccess(userId, projectId, action) {
    return requestJson(endpoints.userProjectByIds(userId, projectId), {
      method: action === "assign" ? "POST" : "DELETE",
    });
  },
});
