import { AUTH_API_BASE_URL } from "../shared/config.js";
import { requestJson } from "./http.js";

const endpoints = Object.freeze({
  list: `${AUTH_API_BASE_URL}/api/projects`,
  requestAccess: (projectRef) =>
    `${AUTH_API_BASE_URL}/api/projects/${encodeURIComponent(String(projectRef))}/request-access`,
  content: (projectId) => `${AUTH_API_BASE_URL}/api/projects/${projectId}/content`,
  ssoToken: (projectId) => `${AUTH_API_BASE_URL}/api/projects/${projectId}/sso-token`,
});

export const projectsApi = Object.freeze({
  endpoints,
  list() {
    return requestJson(endpoints.list, { method: "GET" });
  },
  requestAccess(projectRef, payload) {
    return requestJson(endpoints.requestAccess(projectRef), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  },
  getContent(projectId) {
    return requestJson(endpoints.content(projectId), { method: "GET" });
  },
  getSsoToken(projectId) {
    return requestJson(endpoints.ssoToken(projectId), { method: "GET" });
  },
});
