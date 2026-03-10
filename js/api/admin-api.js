import { API_ENDPOINTS } from "./endpoints.js";
import { requestJson } from "./http.js";

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
  endpoints: API_ENDPOINTS.admin,
  getOverview() {
    return requestJson(API_ENDPOINTS.admin.overview, { method: "GET" });
  },
  getUsers() {
    return requestJson(API_ENDPOINTS.admin.users, { method: "GET" });
  },
  getProjects() {
    return requestJson(API_ENDPOINTS.admin.projects, { method: "GET" });
  },
  getAccessRequests() {
    return requestJson(API_ENDPOINTS.admin.accessRequests, { method: "GET" });
  },
  updateAccessRequest(requestId, status, note = null) {
    return requestJson(
      API_ENDPOINTS.admin.accessRequestById(requestId),
      withJsonBody("PATCH", { status, note })
    );
  },
  saveProject(projectId, payload) {
    return requestJson(
      Number.isFinite(projectId)
        ? API_ENDPOINTS.admin.projectById(projectId)
        : API_ENDPOINTS.admin.projects,
      withJsonBody(Number.isFinite(projectId) ? "PATCH" : "POST", payload)
    );
  },
  deleteProject(projectId) {
    return requestJson(API_ENDPOINTS.admin.projectById(projectId), { method: "DELETE" });
  },
  updateUserRole(userId, role) {
    return requestJson(API_ENDPOINTS.admin.userRoleById(userId), withJsonBody("PATCH", { role }));
  },
  updateUserStatus(userId, status) {
    return requestJson(
      API_ENDPOINTS.admin.userStatusById(userId),
      withJsonBody("PATCH", { status })
    );
  },
  deleteUser(userId) {
    return requestJson(API_ENDPOINTS.admin.userById(userId), { method: "DELETE" });
  },
  updateUserProjectAccess(userId, projectId, action) {
    return requestJson(API_ENDPOINTS.admin.userProjectByIds(userId, projectId), {
      method: action === "assign" ? "POST" : "DELETE",
    });
  },
});
