import { escapeHtml } from "../../shared/html.js";

const CONTENT_IMAGE_DIRECTORIES = Object.freeze({
  aviation: "/aviation/",
  blog: "/blogs/",
  project: "/projects/",
});

export const loadingMarkup =
  '<div class="admin-loading"><span class="admin-spinner" aria-hidden="true"></span><span>Loading...</span></div>';

function formatContentSectionLabel(section) {
  const normalizedSection = String(section || "").trim().toLowerCase();

  if (normalizedSection === "aviation") {
    return "Aviation";
  }

  if (normalizedSection === "blog") {
    return "Blog";
  }

  return "Project";
}

function buildContentImageUrl(contentItem) {
  const normalizedImagePath = String(contentItem?.imagePath || "").trim();
  if (!normalizedImagePath) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedImagePath) || normalizedImagePath.startsWith("/")) {
    return normalizedImagePath;
  }

  const sectionDirectory = CONTENT_IMAGE_DIRECTORIES[String(contentItem?.section || "").trim().toLowerCase()] || "/";
  return `${sectionDirectory}${normalizedImagePath}`.replace(/\/{2,}/g, "/");
}

function renderOverviewMarkup(overview) {
  return `
    <article class="admin-stat"><h4>Users</h4><p>${Number(overview?.usersTotal || 0)}</p></article>
    <article class="admin-stat"><h4>Pending Users</h4><p>${Number(overview?.pendingUsers || 0)}</p></article>
    <article class="admin-stat"><h4>Pending</h4><p>${Number(overview?.pendingRequests || 0)}</p></article>
    <article class="admin-stat"><h4>Approved</h4><p>${Number(overview?.approvedRequests || 0)}</p></article>
    <article class="admin-stat"><h4>Rejected</h4><p>${Number(overview?.rejectedRequests || 0)}</p></article>
  `;
}

function renderUsersToolbar(userSearchQuery, userRoleFilter) {
  return `
    <div class="admin-toolbar admin-toolbar-left">
      <input type="search" class="admin-users-search" placeholder="Search users..." value="${escapeHtml(userSearchQuery)}" />
      <select class="admin-users-role-filter">
        <option value="all" ${userRoleFilter === "all" ? "selected" : ""}>All Roles</option>
        <option value="admin" ${userRoleFilter === "admin" ? "selected" : ""}>Admins</option>
        <option value="user" ${userRoleFilter === "user" ? "selected" : ""}>Users</option>
      </select>
    </div>
  `;
}

function renderUserRow(user, currentUserId) {
  const canDelete = Number(user.id) !== currentUserId;
  const isAdminRole = user.role === "admin";
  const isPendingUser = user.status === "pending";
  const verificationStateLabel =
    user.status === "active" && !user.emailVerified
      ? "Login enabled by admin"
      : user.emailVerified
        ? "Email verified"
        : "Email not verified";
  const approveTitle = !isPendingUser
    ? "Only pending users can be approved."
    : user.emailVerified
      ? "Approve user"
      : "Approve user. Email verification is still required before login.";

  return `
    <tr data-user-id="${user.id}">
      <td>${escapeHtml(user.fullName || "No Name")}</td>
      <td>${escapeHtml(user.email)}</td>
      <td class="admin-users-col-role"><span class="admin-badge">${escapeHtml(user.role)}</span></td>
      <td class="admin-users-col-status">
        <div class="admin-user-status-stack">
          <span class="admin-badge">${escapeHtml(user.status)}</span>
          <span class="admin-user-verify-state">${escapeHtml(verificationStateLabel)}</span>
        </div>
      </td>
      <td class="admin-actions-cell">
        ${isAdminRole ? "" : '<button type="button" class="auth-switch-button admin-manage-user-content">Content</button>'}
        <button
          type="button"
          class="auth-switch-button admin-approve-user"
          data-email-verified="${user.emailVerified ? "1" : "0"}"
          title="${escapeHtml(approveTitle)}"
          ${isPendingUser ? "" : "disabled"}
        >Approve</button>
        <button type="button" class="auth-switch-button admin-toggle-user-role" data-next-role="${isAdminRole ? "user" : "admin"}" ${canDelete ? "" : "disabled"}>${isAdminRole ? "Make User" : "Make Admin"}</button>
        <button
          type="button"
          class="auth-switch-button admin-delete-user admin-icon-button"
          aria-label="Delete user"
          title="Delete user"
          ${canDelete ? "" : "disabled"}
        >🗑</button>
      </td>
    </tr>
  `;
}

function renderUsersMarkup({ users, hasUsers, userSearchQuery, userRoleFilter, currentUserId }) {
  const toolbar = renderUsersToolbar(userSearchQuery, userRoleFilter);

  if (!hasUsers) {
    return `${toolbar}<p>No users found.</p>`;
  }

  if (!users.length) {
    return `${toolbar}<p>No users match current filters.</p>`;
  }

  return `
    ${toolbar}
    <table class="admin-table admin-users-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map((user) => renderUserRow(user, currentUserId)).join("")}
      </tbody>
    </table>
  `;
}

function renderRequestsToolbar(requestFilter, requestSearchQuery) {
  return `
    <div class="admin-toolbar admin-toolbar-left">
      <button type="button" class="auth-switch-button admin-req-filter-toggle ${requestFilter === "all" ? "active" : ""}" data-filter-toggle="1">
        ${requestFilter === "all" ? "Show Pending" : "Show All"}
      </button>
      <input type="search" class="admin-requests-search" placeholder="Search requests..." value="${escapeHtml(requestSearchQuery)}" />
    </div>
  `;
}

function renderRequestRow(request) {
  const isApproved = request.status === "approved";

  return `
    <tr data-request-id="${request.id}">
      <td class="admin-request-content-cell">
        <span class="admin-request-content-title">${escapeHtml(request.title)}</span>
        <div class="admin-request-content-meta">
          <span class="admin-badge">${escapeHtml(formatContentSectionLabel(request.section))}</span>
        </div>
      </td>
      <td class="admin-request-user-cell">
        <span class="admin-request-user-name">${escapeHtml(request.fullName || "No Name")}</span>
        <span class="admin-request-user-email">${escapeHtml(request.email || "")}</span>
      </td>
      <td class="admin-requests-col-status"><span class="admin-badge" data-status="${escapeHtml(request.status)}">${escapeHtml(request.status)}</span></td>
      <td>
        <div>${escapeHtml(request.requestNote || "No message")}</div>
        ${request.reviewNote ? `<div class="admin-request-review-note">Admin: ${escapeHtml(request.reviewNote)}</div>` : ""}
      </td>
      <td class="admin-actions-cell admin-requests-col-actions">
        <button
          type="button"
          class="modal-submit admin-request-approve ${isApproved ? "active" : ""}"
          data-status="approved"
          aria-pressed="${isApproved ? "true" : "false"}"
        >
          Approve
        </button>
        <button
          type="button"
          class="auth-switch-button admin-request-reject"
          data-status="rejected"
        >
          Reject
        </button>
      </td>
    </tr>
  `;
}

function renderRequestsMarkup({ requests, hasRequests, requestFilter, requestSearchQuery }) {
  const toolbar = renderRequestsToolbar(requestFilter, requestSearchQuery);

  if (!hasRequests) {
    return `${toolbar}<p>No access requests.</p>`;
  }

  if (!requests.length) {
    return `${toolbar}<p>No access requests match current filters.</p>`;
  }

  return `
    ${toolbar}
    <table class="admin-table admin-requests-table">
      <thead>
        <tr>
          <th>Content</th>
          <th>User</th>
          <th class="admin-requests-col-status">Status</th>
          <th>Message</th>
          <th class="admin-requests-col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${requests.map((request) => renderRequestRow(request)).join("")}
      </tbody>
    </table>
  `;
}

function renderContentToolbar() {
  return `
    <div class="admin-toolbar admin-toolbar-center">
      <button type="button" class="auth-switch-button admin-add-content">Add Content</button>
    </div>
  `;
}

function renderContentCard(contentItem) {
  const imageUrl = buildContentImageUrl(contentItem);
  const categoriesText = contentItem.categories.length ? contentItem.categories.join(", ") : "No categories";
  const dateText = String(contentItem.updatedAt || "").slice(0, 10);

  return `
    <article class="blog-item project-item admin-content-card ${contentItem.locked ? "project-item-locked" : ""}"
             data-content-id="${contentItem.id}"
             data-content='${escapeHtml(JSON.stringify(contentItem))}'>
      <button type="button" class="admin-edit-content-icon" aria-label="Edit content" title="Edit content">✎</button>
      <button type="button" class="admin-delete-content-icon" aria-label="Delete content" title="Delete content">🗑</button>
      <div class="blog-item-media ${imageUrl ? "" : "blog-item-media-empty"}">
        ${imageUrl ? `<img class="blog-item-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(contentItem.title)}" />` : ""}
      </div>
      <div class="blog-item-details">
        <div class="admin-content-card-topline">
          <span class="admin-badge">${escapeHtml(formatContentSectionLabel(contentItem.section))}</span>
          <span class="admin-badge">${contentItem.isPublished ? "Published" : "Draft"}</span>
        </div>
        <h3>${escapeHtml(contentItem.title)}</h3>
        <p class="blog-item-date">${escapeHtml(dateText)}</p>
        <p class="blog-item-description">${escapeHtml(contentItem.description || "")}</p>
        <p class="blog-item-date">categories: ${escapeHtml(categoriesText)}</p>
        <p class="blog-item-date">slug: ${escapeHtml(contentItem.slug)} | ${contentItem.locked ? "locked" : "open"} | ${escapeHtml(contentItem.deliveryType)}</p>
      </div>
    </article>
  `;
}

function renderContentMarkup(contentItems) {
  const toolbar = renderContentToolbar();

  if (!Array.isArray(contentItems) || !contentItems.length) {
    return `${toolbar}<p>No content found.</p>`;
  }

  return `
    ${toolbar}
    <div class="project-list">
      ${contentItems.map((contentItem) => renderContentCard(contentItem)).join("")}
    </div>
  `;
}

export function renderUserContentAccess({ user, contentItems, getRequestRecord }) {
  const contentRows = contentItems.length
    ? contentItems
        .map((contentItem) => {
          const request = getRequestRecord(user.id, contentItem.id);
          const status = String(request?.status || (contentItem.locked ? "none" : "open")).toLowerCase();
          const isAssigned = status === "approved";
          const action = contentItem.locked ? (isAssigned ? "remove" : "assign") : "noop";
          const label = contentItem.locked ? (isAssigned ? "Remove" : "Add") : "Open";
          const isDisabled = !(contentItem.locked && String(user.role || "").toLowerCase() !== "admin");

          return `
            <div class="admin-user-content-item" data-content-id="${contentItem.id}">
              <div class="admin-user-content-meta">
                <strong>${escapeHtml(contentItem.title)}</strong>
                <span>${escapeHtml(formatContentSectionLabel(contentItem.section))} | ${escapeHtml(contentItem.slug)} | ${contentItem.locked ? "locked" : "open"} | ${contentItem.isPublished ? "published" : "draft"} | ${escapeHtml(status)}</span>
              </div>
              <button
                type="button"
                class="auth-switch-button admin-user-content-toggle"
                data-content-toggle="${action}"
                ${isDisabled ? "disabled" : ""}
              >${label}</button>
            </div>
          `;
        })
        .join("")
    : "<p>No content found.</p>";

  return `
    <div class="admin-user-content-header">
      <p>Manage content access for <strong>${escapeHtml(user.fullName || user.email || "User")}</strong>.</p>
    </div>
    <div class="admin-user-content-list">${contentRows}</div>
  `;
}

export function createAdminUi() {
  const pageEl = document.getElementById("admin");
  const gateStatusEl = document.getElementById("admin-gate-status");
  const controlsEl = document.getElementById("admin-controls");
  const overviewEl = document.getElementById("admin-overview");
  const usersEl = document.getElementById("admin-users");
  const requestsEl = document.getElementById("admin-access-requests");
  const contentEl = document.getElementById("admin-content");
  const tabUsersBtn = document.getElementById("admin-tab-users");
  const tabRequestsBtn = document.getElementById("admin-tab-requests");
  const tabContentBtn = document.getElementById("admin-tab-content");
  const panels = [...document.querySelectorAll(".admin-panel[data-admin-panel]")];

  return {
    isReady: Boolean(
      pageEl &&
        gateStatusEl &&
        controlsEl &&
        overviewEl &&
        usersEl &&
        requestsEl &&
        contentEl &&
        tabUsersBtn &&
        tabRequestsBtn &&
        tabContentBtn
    ),
    setGateStatus(message) {
      gateStatusEl.textContent = message || "";
    },
    setControlsVisibility(isVisible) {
      controlsEl.hidden = !isVisible;
      if (!isVisible) {
        overviewEl.innerHTML = "";
        usersEl.innerHTML = "";
        requestsEl.innerHTML = "";
        contentEl.innerHTML = "";
      }
    },
    showLoading() {
      overviewEl.innerHTML = loadingMarkup;
      usersEl.innerHTML = loadingMarkup;
      requestsEl.innerHTML = loadingMarkup;
      contentEl.innerHTML = loadingMarkup;
    },
    renderOverview(overview) {
      overviewEl.innerHTML = renderOverviewMarkup(overview);
    },
    renderUsers(payload) {
      usersEl.innerHTML = renderUsersMarkup(payload);
    },
    renderRequests(payload) {
      requestsEl.innerHTML = renderRequestsMarkup(payload);
    },
    renderContent(contentItems) {
      contentEl.innerHTML = renderContentMarkup(contentItems);
    },
    setActiveTab(tabId) {
      const activeTab = String(tabId || "users");

      new Map([
        ["users", tabUsersBtn],
        ["requests", tabRequestsBtn],
        ["content", tabContentBtn],
      ]).forEach((button, key) => {
        button.classList.toggle("active", key === activeTab);
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.adminPanel !== activeTab;
      });
    },
    bindHandlers(handlers) {
      tabUsersBtn.addEventListener("click", () => handlers.onTabChange?.("users"));
      tabRequestsBtn.addEventListener("click", () => handlers.onTabChange?.("requests"));
      tabContentBtn.addEventListener("click", () => handlers.onTabChange?.("content"));

      requestsEl.addEventListener("click", (event) => {
        const filterBtn = event.target.closest(".admin-req-filter-toggle[data-filter-toggle]");
        if (filterBtn) {
          handlers.onRequestFilterToggle?.();
          return;
        }

        const row = event.target.closest("tr[data-request-id]");
        if (!row) return;
        const requestId = Number(row.dataset.requestId);
        if (!Number.isFinite(requestId)) return;

        const approveBtn = event.target.closest(".admin-request-approve[data-status]");
        if (approveBtn) {
          handlers.onRequestApprove?.({ requestId, button: approveBtn });
          return;
        }

        if (event.target.closest(".admin-request-reject[data-status]")) {
          handlers.onRequestReject?.({ requestId });
        }
      });

      requestsEl.addEventListener("input", (event) => {
        const searchInput = event.target.closest(".admin-requests-search");
        if (!searchInput) return;
        handlers.onRequestSearch?.(String(searchInput.value || ""));
      });

      usersEl.addEventListener("input", (event) => {
        const searchInput = event.target.closest(".admin-users-search");
        if (!searchInput) return;
        handlers.onUserSearch?.(String(searchInput.value || ""));
      });

      usersEl.addEventListener("change", (event) => {
        const roleFilter = event.target.closest(".admin-users-role-filter");
        if (!roleFilter) return;
        handlers.onUserRoleFilterChange?.(String(roleFilter.value || "all").toLowerCase());
      });

      usersEl.addEventListener("click", (event) => {
        const row = event.target.closest("tr[data-user-id]");
        if (!row) return;
        const userId = Number(row.dataset.userId);
        if (!Number.isFinite(userId)) return;

        if (event.target.closest(".admin-manage-user-content")) {
          handlers.onUserManageContent?.({ userId });
          return;
        }

        if (event.target.closest(".admin-toggle-user-role")) {
          const toggleBtn = event.target.closest(".admin-toggle-user-role");
          handlers.onUserToggleRole?.({
            userId,
            nextRole: String(toggleBtn?.dataset.nextRole || "").toLowerCase() === "user" ? "user" : "admin",
          });
          return;
        }

        if (event.target.closest(".admin-approve-user")) {
          const approveBtn = event.target.closest(".admin-approve-user");
          handlers.onUserApprove?.({ userId, button: approveBtn });
          return;
        }

        if (event.target.closest(".admin-delete-user")) {
          handlers.onUserDelete?.({ userId });
        }
      });

      contentEl.addEventListener("click", (event) => {
        if (event.target.closest(".admin-add-content")) {
          handlers.onContentCreate?.();
          return;
        }

        const card = event.target.closest("[data-content-id]");
        if (!card) return;
        const contentId = Number(card.dataset.contentId);
        if (!Number.isFinite(contentId)) return;

        if (event.target.closest(".admin-edit-content-icon")) {
          handlers.onContentEdit?.({
            contentId,
            rawContent: card.getAttribute("data-content") || "{}",
          });
          return;
        }

        if (event.target.closest(".admin-delete-content-icon")) {
          handlers.onContentDelete?.({ contentId });
        }
      });
    },
  };
}
