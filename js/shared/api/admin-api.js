import { API_ENDPOINTS } from "./endpoints.js";
import { requestJson } from "./http.js";
import { normalizeStringArray, readBoolean, readNumber, readString, readStringArray } from "../normalize.js";

function withJsonBody(method, payload) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function withDeleteConfirmation(url) {
  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}confirm=true`;
}

function withQuery(url, query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    const normalizedValue = String(value ?? "").trim();
    if (normalizedValue) {
      params.set(key, normalizedValue);
    }
  });

  const queryString = params.toString();
  if (!queryString) {
    return url;
  }

  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}${queryString}`;
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

function normalizeAccessRequest(request) {
  return {
    id: readNumber(request, ["id"], 0),
    userId: readNumber(request, ["userId", "user_id"], 0),
    contentId: readNumber(request, ["contentId", "content_id", "projectId", "project_id"], 0),
    section: readString(request, ["section", "contentSection", "content_section"], "project"),
    title: readString(request, ["title", "contentTitle", "content_title", "projectTitle", "project_title"], ""),
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

function normalizeAdminContentItem(contentItem) {
  return {
    id: readNumber(contentItem, ["id"], 0),
    section: readString(contentItem, ["section"], "project"),
    slug: readString(contentItem, ["slug"], ""),
    title: readString(contentItem, ["title"], ""),
    description: readString(contentItem, ["description"], ""),
    imagePath: readString(contentItem, ["imagePath", "image_path"], ""),
    categories: readStringArray(contentItem, ["categories", "categoriesJson", "categories_json"]),
    deliveryType:
      readString(contentItem, ["deliveryType", "delivery_type"], "content").toLowerCase() === "link"
        ? "link"
        : "content",
    locked: readBoolean(contentItem, ["locked"], false),
    externalUrl: readString(contentItem, ["externalUrl", "external_url"], ""),
    htmlContent: readString(contentItem, ["htmlContent", "html_content"], ""),
    isPublished: readBoolean(contentItem, ["isPublished", "is_published"], true),
    updatedAt: readString(contentItem, ["updatedAt", "updated_at", "date"], ""),
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

function normalizeAdminContentResult(result) {
  if (!result.ok) {
    return result;
  }

  const sourceItems = Array.isArray(result.data?.content)
    ? result.data.content
    : Array.isArray(result.data?.projects)
      ? result.data.projects
      : [];

  return {
    ...result,
    data: {
      ...(result.data || {}),
      contentItems: sourceItems.map(normalizeAdminContentItem),
    },
  };
}

function serializeAdminContentPayload(payload) {
  return {
    section: readString(payload, ["section"], "project").toLowerCase(),
    slug: readString(payload, ["slug"], "").toLowerCase(),
    title: readString(payload, ["title"], ""),
    description: readString(payload, ["description"], ""),
    categories: normalizeStringArray(payload?.categories),
    imagePath: readString(payload, ["imagePath"], ""),
    deliveryType: readString(payload, ["deliveryType"], "content").toLowerCase() === "link" ? "link" : "content",
    locked: readBoolean(payload, ["locked"], false),
    externalUrl: readString(payload, ["externalUrl"], ""),
    htmlContent: readString(payload, ["htmlContent"], ""),
    isPublished: readBoolean(payload, ["isPublished"], true),
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
  getContent(query = {}) {
    return requestJson(withQuery(API_ENDPOINTS.admin.content, query), {
      method: "GET",
    }).then(normalizeAdminContentResult);
  },
  getAccessRequests() {
    return requestJson(API_ENDPOINTS.admin.accessRequests, { method: "GET" }).then((result) =>
      normalizeListResult(result, "requests", normalizeAccessRequest)
    );
  },
  updateAccessRequest(requestId, status, note = null) {
    return requestJson(
      API_ENDPOINTS.admin.accessRequestById(requestId),
      withJsonBody("PATCH", { status, note: typeof note === "string" ? note.trim() : null })
    );
  },
  saveContent(contentId, payload) {
    return requestJson(
      Number.isFinite(contentId)
        ? API_ENDPOINTS.admin.contentById(contentId)
        : API_ENDPOINTS.admin.content,
      withJsonBody(Number.isFinite(contentId) ? "PATCH" : "POST", serializeAdminContentPayload(payload))
    );
  },
  deleteContent(contentId) {
    return requestJson(withDeleteConfirmation(API_ENDPOINTS.admin.contentById(contentId)), {
      method: "DELETE",
    });
  },
  updateUserRole(userId, role) {
    return requestJson(API_ENDPOINTS.admin.userRoleById(userId), withJsonBody("PATCH", { role }));
  },
  updateUserStatus(userId, status) {
    return requestJson(API_ENDPOINTS.admin.userStatusById(userId), withJsonBody("PATCH", { status }));
  },
  deleteUser(userId) {
    return requestJson(withDeleteConfirmation(API_ENDPOINTS.admin.userById(userId)), { method: "DELETE" });
  },
  updateUserContentAccess(userId, contentId, action) {
    return requestJson(API_ENDPOINTS.admin.userContentByIds(userId, contentId), {
      method: action === "assign" ? "POST" : "DELETE",
    });
  },
});
