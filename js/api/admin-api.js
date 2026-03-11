import { API_ENDPOINTS } from "./endpoints.js";
import { requestJson } from "./http.js";
import { normalizeStringArray, readBoolean, readNumber, readString, readStringArray } from "../shared/normalize.js";

function withJsonBody(method, payload) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function normalizeOverview(overview) {
  return {
    usersTotal: readNumber(overview, ["usersTotal", "users_total"], 0),
    pendingUsers: readNumber(overview, ["pendingUsers", "pending_users"], 0),
    pendingRequests: readNumber(overview, ["pendingRequests", "pending_requests"], 0),
    approvedRequests: readNumber(overview, ["approvedRequests", "approved_requests"], 0),
    rejectedRequests: readNumber(overview, ["rejectedRequests", "rejected_requests"], 0),
  };
}

function normalizeAdminUser(user) {
  return {
    id: readNumber(user, ["id"], 0),
    fullName: readString(user, ["fullName", "full_name"], ""),
    email: readString(user, ["email"], ""),
    role: readString(user, ["role"], "user").toLowerCase(),
    status: readString(user, ["status"], "pending").toLowerCase(),
    emailVerified: readBoolean(user, ["emailVerified", "email_verified"], false),
  };
}

function normalizeAdminRequest(request) {
  return {
    id: readNumber(request, ["id"], 0),
    userId: readNumber(request, ["userId", "user_id"], 0),
    projectId: readNumber(request, ["projectId", "project_id"], 0),
    title: readString(request, ["title", "projectTitle", "project_title"], ""),
    fullName: readString(request, ["fullName", "full_name", "userFullName", "user_full_name"], ""),
    email: readString(request, ["email", "userEmail", "user_email"], ""),
    status: readString(
      request,
      ["status", "requestStatus", "request_status", "accessStatus", "access_status"],
      "pending"
    ).toLowerCase(),
    requestNote: readString(
      request,
      [
        "requestNote",
        "request_note",
        "userMessage",
        "user_message",
        "userNote",
        "user_note",
        "accessRequestNote",
        "access_request_note",
        "note",
      ],
      ""
    ),
    reviewNote: readString(
      request,
      ["reviewNote", "review_note", "accessReviewNote", "access_review_note"],
      ""
    ),
    requestedAt: readString(request, ["requestedAt", "requested_at", "createdAt", "created_at"], ""),
  };
}

function normalizeAdminProject(project) {
  return {
    id: readNumber(project, ["id"], 0),
    slug: readString(project, ["slug"], ""),
    title: readString(project, ["title"], ""),
    description: readString(project, ["description"], ""),
    imagePath: readString(project, ["imagePath", "image_path"], ""),
    categories: readStringArray(project, ["categories", "categoriesJson", "categories_json"]),
    deliveryType:
      readString(project, ["deliveryType", "delivery_type"], "content").toLowerCase() === "link"
        ? "link"
        : "content",
    locked: readBoolean(project, ["locked"], false),
    externalUrl: readString(project, ["externalUrl", "external_url"], ""),
    htmlContent: readString(project, ["htmlContent", "html_content"], ""),
    updatedAt: readString(project, ["updatedAt", "updated_at", "date"], ""),
  };
}

function normalizeListResult(result, key, normalizeItem) {
  if (!result.ok) {
    return result;
  }

  const rows = Array.isArray(result.data?.[key]) ? result.data[key].map(normalizeItem) : [];
  return {
    ...result,
    data: {
      ...(result.data || {}),
      [key]: rows,
    },
  };
}

function normalizeObjectResult(result, key, normalizeItem) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      [key]: normalizeItem(result.data?.[key] || {}),
    },
  };
}

function serializeProjectPayload(payload) {
  return {
    slug: readString(payload, ["slug"], "").toLowerCase(),
    title: readString(payload, ["title"], ""),
    description: readString(payload, ["description"], ""),
    categories: normalizeStringArray(payload?.categories),
    imagePath: readString(payload, ["imagePath"], ""),
    deliveryType: readString(payload, ["deliveryType"], "content").toLowerCase() === "link" ? "link" : "content",
    locked: readBoolean(payload, ["locked"], false),
    externalUrl: readString(payload, ["externalUrl"], ""),
    htmlContent: readString(payload, ["htmlContent"], ""),
  };
}

export const adminApi = Object.freeze({
  endpoints: API_ENDPOINTS.admin,
  getOverview() {
    return requestJson(API_ENDPOINTS.admin.overview, { method: "GET" }).then((result) =>
      normalizeObjectResult(result, "overview", normalizeOverview)
    );
  },
  getUsers() {
    return requestJson(API_ENDPOINTS.admin.users, { method: "GET" }).then((result) =>
      normalizeListResult(result, "users", normalizeAdminUser)
    );
  },
  getProjects() {
    return requestJson(API_ENDPOINTS.admin.projects, { method: "GET" }).then((result) =>
      normalizeListResult(result, "projects", normalizeAdminProject)
    );
  },
  getAccessRequests() {
    return requestJson(API_ENDPOINTS.admin.accessRequests, { method: "GET" }).then((result) =>
      normalizeListResult(result, "requests", normalizeAdminRequest)
    );
  },
  updateAccessRequest(requestId, status, note = null) {
    return requestJson(
      API_ENDPOINTS.admin.accessRequestById(requestId),
      withJsonBody("PATCH", { status, note: typeof note === "string" ? note.trim() : null })
    );
  },
  saveProject(projectId, payload) {
    return requestJson(
      Number.isFinite(projectId)
        ? API_ENDPOINTS.admin.projectById(projectId)
        : API_ENDPOINTS.admin.projects,
      withJsonBody(Number.isFinite(projectId) ? "PATCH" : "POST", serializeProjectPayload(payload))
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
