import { AUTH_API_BASE_URL } from "./api-config.js";

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
  content: Object.freeze({
    list: `${AUTH_API_BASE_URL}/api/content`,
    requestAccess: (contentId) =>
      `${AUTH_API_BASE_URL}/api/content/${encodeURIComponent(String(contentId))}/request-access`,
    detail: (contentId) => `${AUTH_API_BASE_URL}/api/content/${contentId}/content`,
    ssoToken: (contentId) => `${AUTH_API_BASE_URL}/api/content/${contentId}/sso-token`,
    consumeSso: `${AUTH_API_BASE_URL}/api/content/sso/consume`,
  }),
  admin: Object.freeze({
    overview: `${AUTH_API_BASE_URL}/api/admin/overview`,
    users: `${AUTH_API_BASE_URL}/api/admin/users`,
    content: `${AUTH_API_BASE_URL}/api/admin/content`,
    accessRequests: `${AUTH_API_BASE_URL}/api/admin/access-requests`,
    accessRequestById: (id) => `${AUTH_API_BASE_URL}/api/admin/access-requests/${id}`,
    contentById: (id) => `${AUTH_API_BASE_URL}/api/admin/content/${id}`,
    userRoleById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}/role`,
    userById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}`,
    userStatusById: (id) => `${AUTH_API_BASE_URL}/api/admin/users/${id}/status`,
    userContentByIds: (userId, contentId) =>
      `${AUTH_API_BASE_URL}/api/admin/users/${userId}/content/${contentId}`,
  }),
});

export const CONTACT_SERVICE_CONFIG = Object.freeze({
  serviceId: "service_3tkfh67",
  templateId: "template_55tr6up",
  publicKey: "0CfalwA7NXSuNVflV",
});

