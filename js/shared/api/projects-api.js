import { API_ENDPOINTS } from "./endpoints.js";
import { requestJson } from "./http.js";
import { readBoolean, readNumber, readString, readStringArray } from "../normalize.js";

function normalizeRequestStatus(project) {
  return readString(
    project,
    ["requestStatus", "request_status", "accessStatus", "access_status", "status"],
    "not_requested"
  ).toLowerCase();
}

function normalizeProjectRow(project) {
  return {
    id: readNumber(project, ["id"], null),
    slug: readString(project, ["slug", "projectSlug", "project_slug"], ""),
    title: readString(project, ["title"], ""),
    description: readString(project, ["description"], ""),
    date: readString(project, ["date", "updatedAt", "updated_at"], ""),
    imagePath: readString(project, ["imagePath", "image_path"], ""),
    locked: readBoolean(project, ["locked"], false),
    deliveryType:
      readString(project, ["deliveryType", "delivery_type"], "content").toLowerCase() === "link"
        ? "link"
        : "content",
    externalUrl: readString(project, ["externalUrl", "external_url"], ""),
    categories: readStringArray(project, ["categories", "categoriesJson", "categories_json"]),
    canAccess: readBoolean(project, ["canAccess", "can_access"], null),
    requestStatus: normalizeRequestStatus(project),
    accessRequestNote: readString(
      project,
      [
        "accessRequestNote",
        "access_request_note",
        "requestNote",
        "request_note",
        "userMessage",
        "user_message",
        "userNote",
        "user_note",
        "note",
      ],
      ""
    ),
    accessReviewNote: readString(
      project,
      ["accessReviewNote", "access_review_note", "reviewNote", "review_note"],
      ""
    ),
  };
}

function normalizeProjectsResult(result) {
  if (!result.ok) {
    return result;
  }

  const projects = Array.isArray(result.data?.projects)
    ? result.data.projects.map(normalizeProjectRow).filter((project) => project.slug)
    : [];

  return {
    ...result,
    data: {
      ...(result.data || {}),
      projects,
    },
  };
}

function normalizeContentResult(result) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      htmlContent: readString(result.data, ["htmlContent", "html_content"], ""),
    },
  };
}

function normalizeRequestAccessResult(result) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      request: {
        note: readString(result.data?.request || result.data, ["note", "userNote", "user_note"], ""),
      },
    },
  };
}

export const projectsApi = Object.freeze({
  endpoints: API_ENDPOINTS.projects,
  list() {
    return requestJson(API_ENDPOINTS.projects.list, { method: "GET" }).then(normalizeProjectsResult);
  },
  requestAccess(projectRef, payload) {
    return requestJson(API_ENDPOINTS.projects.requestAccess(projectRef), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).then(normalizeRequestAccessResult);
  },
  getContent(projectId) {
    return requestJson(API_ENDPOINTS.projects.content(projectId), { method: "GET" }).then(normalizeContentResult);
  },
  getSsoToken(projectId) {
    return requestJson(API_ENDPOINTS.projects.ssoToken(projectId), { method: "GET" });
  },
});

