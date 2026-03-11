function includesQuery(parts, query) {
  if (!query) {
    return true;
  }

  return parts.join(" ").toLowerCase().includes(query);
}

const USER_ROLE_FILTERS = new Set(["all", "admin", "user"]);
const ADMIN_TABS = new Set(["users", "requests", "projects"]);

export function normalizeAdminTabId(tabId) {
  const normalizedTabId = String(tabId || "").trim().toLowerCase();
  return ADMIN_TABS.has(normalizedTabId) ? normalizedTabId : "users";
}

export function normalizeAdminRoleFilter(roleFilter) {
  const normalizedRoleFilter = String(roleFilter || "").trim().toLowerCase();
  return USER_ROLE_FILTERS.has(normalizedRoleFilter) ? normalizedRoleFilter : "all";
}

export function toggleAdminRequestFilter(requestFilter) {
  return requestFilter === "all" ? "pending" : "all";
}

export function createEmptyAdminProject() {
  return {
    slug: "",
    title: "",
    description: "",
    imagePath: "",
    categories: [],
    deliveryType: "content",
    locked: false,
    externalUrl: "",
    htmlContent: "",
  };
}

export function findAdminRequest(requests, userId, projectId) {
  return (
    requests.find(
      (request) => Number(request.userId) === Number(userId) && Number(request.projectId) === Number(projectId)
    ) || null
  );
}

export function getVisibleAdminUsers({ users, query, roleFilter }) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const normalizedRoleFilter = normalizeAdminRoleFilter(roleFilter);

  return users.filter((user) => {
    const roleMatches = normalizedRoleFilter === "all" ? true : user.role === normalizedRoleFilter;
    if (!roleMatches) {
      return false;
    }

    return includesQuery(
      [
        user.fullName,
        user.email,
        user.role,
        user.status,
        user.emailVerified ? "verified" : "unverified",
      ],
      normalizedQuery
    );
  });
}

export function getVisibleAdminRequests({ requests, filter, query }) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const visibleRequests = filter === "all" ? requests : requests.filter((request) => request.status === "pending");

  return [...visibleRequests]
    .sort((left, right) => {
      const leftPendingRank = left.status === "pending" ? 0 : 1;
      const rightPendingRank = right.status === "pending" ? 0 : 1;
      if (leftPendingRank !== rightPendingRank) {
        return leftPendingRank - rightPendingRank;
      }

      return String(right.requestedAt || "").localeCompare(String(left.requestedAt || ""));
    })
    .filter((request) =>
      includesQuery(
        [
          request.title,
          request.fullName,
          request.email,
          request.status,
          request.requestNote,
          request.reviewNote,
        ],
        normalizedQuery
      )
    );
}
