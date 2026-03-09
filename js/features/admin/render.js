import { escapeHtml } from "../../shared/html.js";

export const loadingMarkup =
  '<div class="admin-loading"><span class="admin-spinner" aria-hidden="true"></span><span>Loading...</span></div>';

export function renderOverview(container, overview) {
  container.innerHTML = `
    <article class="admin-stat"><h4>Users</h4><p>${Number(overview?.usersTotal || 0)}</p></article>
    <article class="admin-stat"><h4>Pending Users</h4><p>${Number(overview?.pendingUsers || 0)}</p></article>
    <article class="admin-stat"><h4>Pending</h4><p>${Number(overview?.pendingRequests || 0)}</p></article>
    <article class="admin-stat"><h4>Approved</h4><p>${Number(overview?.approvedRequests || 0)}</p></article>
    <article class="admin-stat"><h4>Rejected</h4><p>${Number(overview?.rejectedRequests || 0)}</p></article>
  `;
}

export function renderUsers(container, { users, userSearchQuery, userRoleFilter, currentUserId }) {
  if (!Array.isArray(users) || !users.length) {
    container.innerHTML = "<p>No users found.</p>";
    return;
  }

  const normalizedQuery = userSearchQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const role = String(user.role || "").toLowerCase();
    const roleMatch = userRoleFilter === "all" ? true : role === userRoleFilter;
    if (!roleMatch) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      user.full_name,
      user.email,
      user.role,
      user.status,
      user.email_verified ? "verified" : "unverified",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  const toolbar = `
    <div class="admin-toolbar" style="justify-content:flex-start;margin-bottom:0.8rem;">
      <input type="search" class="admin-users-search" placeholder="Search users..." value="${escapeHtml(userSearchQuery)}" />
      <select class="admin-users-role-filter">
        <option value="all" ${userRoleFilter === "all" ? "selected" : ""}>All Roles</option>
        <option value="admin" ${userRoleFilter === "admin" ? "selected" : ""}>Admins</option>
        <option value="user" ${userRoleFilter === "user" ? "selected" : ""}>Users</option>
      </select>
    </div>
  `;

  if (!filteredUsers.length) {
    container.innerHTML = `${toolbar}<p>No users match current filters.</p>`;
    return;
  }

  container.innerHTML = `
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
        ${filteredUsers
          .map((user) => {
            const canDelete = Number(user.id) !== currentUserId;
            const status = String(user.status || "").toLowerCase();
            const isAdminRole = String(user.role || "").toLowerCase() === "admin";
            const isPendingUser = status === "pending";
            const isEmailVerified = Boolean(user.email_verified);
            const verificationStateLabel =
              status === "active" && !isEmailVerified
                ? "Login enabled by admin"
                : isEmailVerified
                  ? "Email verified"
                  : "Email not verified";
            const approveTitle = !isPendingUser
              ? "Only pending users can be approved."
              : isEmailVerified
                ? "Approve user"
                : "Approve user. Email verification is still required before login.";

            return `
              <tr data-user-id="${user.id}">
                <td>${escapeHtml(user.full_name || "No Name")}</td>
                <td>${escapeHtml(user.email)}</td>
                <td class="admin-users-col-role"><span class="admin-badge">${escapeHtml(user.role)}</span></td>
                <td class="admin-users-col-status">
                  <div class="admin-user-status-stack">
                    <span class="admin-badge">${escapeHtml(user.status)}</span>
                    <span class="admin-user-verify-state">${escapeHtml(verificationStateLabel)}</span>
                  </div>
                </td>
                <td class="admin-actions-cell">
                  ${isAdminRole ? "" : '<button type="button" class="auth-switch-button admin-manage-user-projects">Projects</button>'}
                  <button
                    type="button"
                    class="auth-switch-button admin-approve-user"
                    data-email-verified="${isEmailVerified ? "1" : "0"}"
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
          })
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderRequests(container, { requests, requestFilter, requestSearchQuery }) {
  if (!Array.isArray(requests) || !requests.length) {
    container.innerHTML = "<p>No access requests.</p>";
    return;
  }

  const sortedRequests = [...requests].sort((left, right) => {
    const leftPending = String(left.status || "") === "pending" ? 0 : 1;
    const rightPending = String(right.status || "") === "pending" ? 0 : 1;
    if (leftPending !== rightPending) return leftPending - rightPending;
    return String(right.requested_at || "").localeCompare(String(left.requested_at || ""));
  });

  const filteredRequests =
    requestFilter === "all"
      ? sortedRequests
      : sortedRequests.filter((request) => String(request.status || "") === "pending");

  const normalizedQuery = requestSearchQuery.trim().toLowerCase();
  const searchedRequests = normalizedQuery
    ? filteredRequests.filter((request) => {
        const haystack = [
          request.title,
          request.full_name,
          request.email,
          request.status,
          request.user_message,
          request.user_note,
          request.note,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : filteredRequests;

  container.innerHTML = `
    <div class="admin-toolbar" style="justify-content:flex-start;margin-bottom:0.8rem;">
      <button type="button" class="auth-switch-button admin-req-filter-toggle ${requestFilter === "all" ? "active" : ""}" data-filter-toggle="1">
        ${requestFilter === "all" ? "Show Pending" : "Show All"}
      </button>
      <input type="search" class="admin-requests-search" placeholder="Search requests..." value="${escapeHtml(requestSearchQuery)}" />
    </div>
    <table class="admin-table admin-requests-table">
      <thead>
        <tr>
          <th>Project</th>
          <th>User</th>
          <th class="admin-requests-col-status">Status</th>
          <th>Message</th>
          <th class="admin-requests-col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${searchedRequests
          .map((request) => {
            const status = String(request.status || "").toLowerCase();
            const isApproved = status === "approved";
            const userMessage = String(
              request.user_message ||
                request.userMessage ||
                request.user_note ||
                request.userNote ||
                request.accessRequestNote ||
                request.note ||
                ""
            ).trim();
            const reviewMessage = String(request.review_note || request.reviewNote || "").trim();

            return `
              <tr data-request-id="${request.id}">
                <td>${escapeHtml(request.title)}</td>
                <td class="admin-request-user-cell">
                  <span class="admin-request-user-name">${escapeHtml(request.full_name || "No Name")}</span>
                  <span class="admin-request-user-email">${escapeHtml(request.email || "")}</span>
                </td>
                <td class="admin-requests-col-status"><span class="admin-badge" data-status="${escapeHtml(status)}">${escapeHtml(request.status)}</span></td>
                <td>
                  <div>${escapeHtml(userMessage || "No message")}</div>
                  ${reviewMessage ? `<div class="admin-request-review-note">Admin: ${escapeHtml(reviewMessage)}</div>` : ""}
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
          })
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderProjects(container, projects) {
  if (!Array.isArray(projects) || !projects.length) {
    container.innerHTML = "<p>No projects found.</p>";
    return;
  }

  container.innerHTML = `
    <div class="admin-toolbar" style="justify-content:center;margin-bottom:0.8rem;">
      <button type="button" class="auth-switch-button admin-add-project">Add Project</button>
    </div>
    <div class="project-list">
      ${projects
        .map((project) => {
          const locked = Boolean(project.locked);
          const deliveryType =
            String(project.delivery_type || "content").toLowerCase() === "link" ? "link" : "content";
          const imagePath = String(project.image_path || "").trim();
          const imageUrl = imagePath
            ? /^https?:\/\//i.test(imagePath) || imagePath.startsWith("/")
              ? imagePath
              : `/projects/${imagePath}`
            : "";
          const dateText = String(project.updated_at || "").slice(0, 10);
          const categories = Array.isArray(project.categories)
            ? project.categories.map((item) => String(item).trim()).filter(Boolean)
            : [];
          const categoriesText = categories.length ? categories.join(", ") : "No categories";

          return `
            <article class="blog-item project-item ${locked ? "project-item-locked" : ""}"
                     data-project-id="${project.id}"
                     data-project='${escapeHtml(JSON.stringify(project))}'>
              <button type="button" class="admin-edit-project-icon" aria-label="Edit project" title="Edit project">✎</button>
              <button type="button" class="admin-delete-project-icon" aria-label="Delete project" title="Delete project">🗑</button>
              <div class="blog-item-media ${imageUrl ? "" : "blog-item-media-empty"}">
                ${imageUrl ? `<img class="blog-item-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(project.title)}" />` : ""}
              </div>
              <div class="blog-item-details">
                <h3>${escapeHtml(project.title)}</h3>
                <p class="blog-item-date">${escapeHtml(dateText)}</p>
                <p class="blog-item-description">${escapeHtml(project.description || "")}</p>
                <p class="blog-item-date">categories: ${escapeHtml(categoriesText)}</p>
                <p class="blog-item-date">slug: ${escapeHtml(project.slug)} | ${locked ? "locked" : "open"} | ${deliveryType}</p>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderUserProjectsContent({ user, projects, getRequestRecord }) {
  const projectRows = projects.length
    ? projects
        .map((project) => {
          const request = getRequestRecord(user.id, project.id);
          const status = String(request?.status || (project.locked ? "none" : "open")).toLowerCase();
          const isAssigned = status === "approved";
          const action = project.locked ? (isAssigned ? "remove" : "assign") : "noop";
          const label = project.locked ? (isAssigned ? "Remove" : "Add") : "Open";
          const isDisabled = !(project.locked && String(user.role || "").toLowerCase() !== "admin");

          return `
            <div class="admin-user-project-item" data-project-id="${project.id}">
              <div class="admin-user-project-meta">
                <strong>${escapeHtml(project.title)}</strong>
                <span>${escapeHtml(project.slug)} | ${project.locked ? "locked" : "open"} | ${escapeHtml(status)}</span>
              </div>
              <button
                type="button"
                class="auth-switch-button admin-user-project-toggle"
                data-project-toggle="${action}"
                ${isDisabled ? "disabled" : ""}
              >${label}</button>
            </div>
          `;
        })
        .join("")
    : "<p>No projects found.</p>";

  return `
    <div class="admin-user-projects-header">
      <p>Manage project access for <strong>${escapeHtml(user.full_name || user.email || "User")}</strong>.</p>
    </div>
    <div class="admin-user-projects-list">${projectRows}</div>
  `;
}
