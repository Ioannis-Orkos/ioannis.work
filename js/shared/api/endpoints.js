import { AUTH_API_BASE_URL } from "../config.js";

export const API_ENDPOINTS = Object.freeze({
  auth: Object.freeze({
    signup: `${AUTH_API_BASE_URL}/api/auth/signup`,
    login: `${AUTH_API_BASE_URL}/api/auth/login`,
    logout: `${AUTH_API_BASE_URL}/api/auth/logout`,
    me: `${AUTH_API_BASE_URL}/api/auth/me`,
    profile: `${AUTH_API_BASE_URL}/api/auth/profile`,
    password: `${AUTH_API_BASE_URL}/api/auth/password`,
    google: `${AUTH_API_BASE_URL}/api/auth/google`,
  }),
  projects: Object.freeze({
    list: `${AUTH_API_BASE_URL}/api/projects`,
    requestAccess: (projectRef) =>
      `${AUTH_API_BASE_URL}/api/projects/${encodeURIComponent(String(projectRef))}/request-access`,
    content: (projectId) => `${AUTH_API_BASE_URL}/api/projects/${projectId}/content`,
    ssoToken: (projectId) => `${AUTH_API_BASE_URL}/api/projects/${projectId}/sso-token`,
  }),
  admin: Object.freeze({
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
  }),
});

export const CONTACT_SERVICE_CONFIG = Object.freeze({
  serviceId: "service_3tkfh67",
  templateId: "template_55tr6up",
  publicKey: "0CfalwA7NXSuNVflV",
});

