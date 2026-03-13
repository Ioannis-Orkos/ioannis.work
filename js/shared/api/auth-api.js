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

export const authApi = Object.freeze({
  endpoints: API_ENDPOINTS.auth,
  getCurrentSession() {
    return requestJson(API_ENDPOINTS.auth.me, { method: "GET" });
  },
  signup(payload) {
    return requestJson(API_ENDPOINTS.auth.signup, withJsonBody("POST", payload));
  },
  login(payload) {
    return requestJson(API_ENDPOINTS.auth.login, withJsonBody("POST", payload));
  },
  forgotPassword(payload) {
    return requestJson(API_ENDPOINTS.auth.forgotPassword, withJsonBody("POST", payload));
  },
  resetPassword(payload) {
    return requestJson(API_ENDPOINTS.auth.resetPassword, withJsonBody("POST", payload));
  },
  logout() {
    return requestJson(API_ENDPOINTS.auth.logout, { method: "POST" });
  },
  updateProfile(payload) {
    return requestJson(API_ENDPOINTS.auth.profile, withJsonBody("PATCH", payload));
  },
  updatePassword(payload) {
    return requestJson(API_ENDPOINTS.auth.password, withJsonBody("PATCH", payload));
  },
});
