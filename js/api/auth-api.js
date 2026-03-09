import { AUTH_API_BASE_URL } from "../shared/config.js";
import { requestJson } from "./http.js";

const endpoints = Object.freeze({
  signup: `${AUTH_API_BASE_URL}/api/auth/signup`,
  login: `${AUTH_API_BASE_URL}/api/auth/login`,
  logout: `${AUTH_API_BASE_URL}/api/auth/logout`,
  me: `${AUTH_API_BASE_URL}/api/auth/me`,
  profile: `${AUTH_API_BASE_URL}/api/auth/profile`,
  password: `${AUTH_API_BASE_URL}/api/auth/password`,
  google: `${AUTH_API_BASE_URL}/api/auth/google`,
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

export const authApi = Object.freeze({
  endpoints,
  getCurrentSession() {
    return requestJson(endpoints.me, { method: "GET" });
  },
  signup(payload) {
    return requestJson(endpoints.signup, withJsonBody("POST", payload));
  },
  login(payload) {
    return requestJson(endpoints.login, withJsonBody("POST", payload));
  },
  logout() {
    return requestJson(endpoints.logout, { method: "POST" });
  },
  updateProfile(payload) {
    return requestJson(endpoints.profile, withJsonBody("PATCH", payload));
  },
  updatePassword(payload) {
    return requestJson(endpoints.password, withJsonBody("PATCH", payload));
  },
});
