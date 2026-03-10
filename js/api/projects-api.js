import { API_ENDPOINTS } from "./endpoints.js";
import { requestJson } from "./http.js";

export const projectsApi = Object.freeze({
  endpoints: API_ENDPOINTS.projects,
  list() {
    return requestJson(API_ENDPOINTS.projects.list, { method: "GET" });
  },
  requestAccess(projectRef, payload) {
    return requestJson(API_ENDPOINTS.projects.requestAccess(projectRef), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  },
  getContent(projectId) {
    return requestJson(API_ENDPOINTS.projects.content(projectId), { method: "GET" });
  },
  getSsoToken(projectId) {
    return requestJson(API_ENDPOINTS.projects.ssoToken(projectId), { method: "GET" });
  },
});
