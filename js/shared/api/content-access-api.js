import { API_ENDPOINTS } from "./endpoints.js";
import { requestJson } from "./http.js";
import { readBoolean, readNumber, readString, readStringArray } from "../normalize.js";

function withJsonBody(method, payload) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function appendQuery(url, query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    const normalizedValue = String(value ?? "").trim();
    if (normalizedValue) {
      params.set(key, normalizedValue);
    }
  });

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function normalizeRequestStatus(contentItem) {
  return readString(
    contentItem,
    ["requestStatus", "request_status", "accessStatus", "access_status", "status"],
    "not_requested"
  ).toLowerCase();
}

function normalizeContentItem(contentItem) {
  return {
    id: readNumber(contentItem, ["id"], null),
    section: readString(contentItem, ["section"], ""),
    slug: readString(contentItem, ["slug"], ""),
    title: readString(contentItem, ["title"], ""),
    description: readString(contentItem, ["description"], ""),
    date: readString(contentItem, ["date", "updatedAt", "updated_at"], ""),
    imagePath: readString(contentItem, ["imagePath", "image_path"], ""),
    locked: readBoolean(contentItem, ["locked"], false),
    deliveryType:
      readString(contentItem, ["deliveryType", "delivery_type"], "content").toLowerCase() === "link"
        ? "link"
        : "content",
    externalUrl: readString(contentItem, ["externalUrl", "external_url"], ""),
    categories: readStringArray(contentItem, ["categories", "categoriesJson", "categories_json"]),
    canAccess: readBoolean(contentItem, ["canAccess", "can_access"], null),
    requestStatus: normalizeRequestStatus(contentItem),
    accessRequestNote: readString(
      contentItem,
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
      contentItem,
      ["accessReviewNote", "access_review_note", "reviewNote", "review_note"],
      ""
    ),
  };
}

function normalizeContentListResult(result) {
  if (!result.ok) {
    return result;
  }

  const sourceItems = Array.isArray(result.data?.content)
    ? result.data.content
    : Array.isArray(result.data?.items)
      ? result.data.items
      : [];

  return {
    ...result,
    data: {
      ...(result.data || {}),
      content: sourceItems.map(normalizeContentItem).filter((contentItem) => contentItem.slug),
    },
  };
}

function normalizeContentDetailResult(result) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      contentId: readNumber(result.data, ["contentId", "content_id", "id"], null),
      section: readString(result.data, ["section"], ""),
      slug: readString(result.data, ["slug"], ""),
      title: readString(result.data, ["title"], ""),
      deliveryType:
        readString(result.data, ["deliveryType", "delivery_type"], "content").toLowerCase() === "link"
          ? "link"
          : "content",
      externalUrl: readString(result.data, ["externalUrl", "external_url"], ""),
      htmlContent: readString(result.data, ["htmlContent", "html_content"], ""),
    },
  };
}

function normalizeAccessRequestResult(result) {
  if (!result.ok) {
    return result;
  }

  const request = result.data?.request || result.data;

  return {
    ...result,
    data: {
      ...(result.data || {}),
      request: {
        id: readNumber(request, ["id"], null),
        status: readString(request, ["status"], "pending").toLowerCase(),
        note: readString(request, ["note", "userNote", "user_note"], ""),
        requestedAt: readString(request, ["requestedAt", "requested_at"], ""),
      },
    },
  };
}

function normalizeSsoTokenResult(result) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      ssoToken: readString(result.data, ["ssoToken", "sso_token"], ""),
      expiresAt: readString(result.data, ["expiresAt", "expires_at"], ""),
      targetContent: {
        id: readNumber(result.data?.targetContent, ["id"], null),
        section: readString(result.data?.targetContent, ["section"], ""),
        slug: readString(result.data?.targetContent, ["slug"], ""),
      },
    },
  };
}

function normalizeSsoConsumeResult(result) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: {
      ...(result.data || {}),
      targetContent: {
        id: readNumber(result.data?.targetContent, ["id"], null),
        slug: readString(result.data?.targetContent, ["slug"], ""),
      },
    },
  };
}

export const contentAccessApi = Object.freeze({
  endpoints: API_ENDPOINTS.content,
  list({ section = "" } = {}) {
    const url = appendQuery(API_ENDPOINTS.content.list, { section });
    return requestJson(url, { method: "GET" }).then(normalizeContentListResult);
  },
  requestAccess(contentId, payload) {
    return requestJson(
      API_ENDPOINTS.content.requestAccess(contentId),
      withJsonBody("POST", payload)
    ).then(normalizeAccessRequestResult);
  },
  getContent(contentId) {
    return requestJson(API_ENDPOINTS.content.detail(contentId), { method: "GET" }).then(normalizeContentDetailResult);
  },
  createSsoToken(contentId) {
    return requestJson(API_ENDPOINTS.content.ssoToken(contentId), { method: "POST" }).then(normalizeSsoTokenResult);
  },
  consumeSsoToken(ssoToken) {
    return requestJson(
      API_ENDPOINTS.content.consumeSso,
      withJsonBody("POST", {
        ssoToken: String(ssoToken || "").trim(),
      })
    ).then(normalizeSsoConsumeResult);
  },
});
