import { loadingMarkup } from "./render.js";
import { toSlug } from "../../shared/html.js";

export function createProjectEditorModal({ onSubmit }) {
  const overlay = document.createElement("div");
  overlay.id = "admin-project-editor-modal";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-project-editor-title">
      <button type="button" class="modal-close admin-project-editor-close" aria-label="Close project editor">×</button>
      <h2 id="admin-project-editor-title">Edit Project</h2>
      <form id="admin-project-editor-form" class="modal-form admin-project-editor-form">
        <div class="admin-project-editor-grid">
          <div class="admin-project-editor-field">
            <label for="admin-project-slug">Slug</label>
            <input id="admin-project-slug" name="slug" type="text" required />
          </div>
          <div class="admin-project-editor-field">
            <label for="admin-project-title">Title</label>
            <input id="admin-project-title" name="title" type="text" required />
          </div>
          <div class="admin-project-editor-field">
            <label for="admin-project-image">Image</label>
            <input id="admin-project-image" name="imagePath" type="text" placeholder="folder/asset/preview.webp" />
          </div>
          <div class="admin-project-editor-field">
            <label for="admin-project-delivery">Delivery</label>
            <select id="admin-project-delivery" name="deliveryType">
              <option value="content">content</option>
              <option value="link">link</option>
            </select>
          </div>
          <div class="admin-project-editor-field">
            <label for="admin-project-locked">Locked</label>
            <select id="admin-project-locked" name="locked">
              <option value="false">open</option>
              <option value="true">locked</option>
            </select>
          </div>
          <div class="admin-project-editor-field admin-project-editor-field-full">
            <label for="admin-project-description">Description</label>
            <textarea id="admin-project-description" name="description" rows="3"></textarea>
          </div>
          <div class="admin-project-editor-field admin-project-editor-field-full">
            <label for="admin-project-categories">Categories (comma separated)</label>
            <input id="admin-project-categories" name="categoriesText" type="text" placeholder="Aviation, Workflow, Frontend" />
          </div>
          <div class="admin-project-editor-field admin-project-editor-field-full">
            <label for="admin-project-external-url">External URL</label>
            <input id="admin-project-external-url" name="externalUrl" type="url" placeholder="https://..." />
          </div>
          <div class="admin-project-editor-field admin-project-editor-field-full">
            <label for="admin-project-content">Content</label>
            <textarea id="admin-project-content" name="htmlContent" rows="10" placeholder="Project HTML content..."></textarea>
          </div>
        </div>
        <button type="submit" class="modal-submit">Save Project</button>
      </form>
      <p id="admin-project-editor-status" class="modal-status" aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#admin-project-editor-form");
  const statusEl = overlay.querySelector("#admin-project-editor-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const titleField = form.querySelector("#admin-project-title");
  const slugField = form.querySelector("#admin-project-slug");
  const fields = {
    slug: slugField,
    title: titleField,
    description: form.querySelector("#admin-project-description"),
    imagePath: form.querySelector("#admin-project-image"),
    categoriesText: form.querySelector("#admin-project-categories"),
    deliveryType: form.querySelector("#admin-project-delivery"),
    locked: form.querySelector("#admin-project-locked"),
    externalUrl: form.querySelector("#admin-project-external-url"),
    htmlContent: form.querySelector("#admin-project-content"),
  };
  const state = {
    mode: "edit",
    projectId: null,
  };

  const close = () => {
    overlay.hidden = true;
    state.mode = "edit";
    state.projectId = null;
    statusEl.textContent = "";
  };

  const setStatus = (message, { loading = false } = {}) => {
    if (loading) {
      statusEl.innerHTML = loadingMarkup;
      return;
    }

    statusEl.textContent = message || "";
  };

  const setSubmitting = (isSubmitting) => {
    submitBtn.disabled = isSubmitting;
  };

  const open = (project, { mode = "edit" } = {}) => {
    state.mode = mode === "create" ? "create" : "edit";
    state.projectId = state.mode === "edit" ? Number(project?.id) : null;

    fields.slug.value = String(project?.slug || "");
    fields.slug.dataset.manual = state.mode === "create" && fields.slug.value.trim() ? "1" : "0";
    fields.slug.disabled = false;
    fields.title.value = String(project?.title || "");
    fields.description.value = String(project?.description || "");
    fields.imagePath.value = String(project?.image_path || "");
    fields.deliveryType.value =
      String(project?.delivery_type || "content").toLowerCase() === "link" ? "link" : "content";
    fields.locked.value = Boolean(project?.locked) ? "true" : "false";
    fields.externalUrl.value = String(project?.external_url || "");
    fields.htmlContent.value = String(project?.html_content || "");
    const categoriesValue = Array.isArray(project?.categories)
      ? project.categories
      : String(project?.categories_json || "");
    fields.categoriesText.value = Array.isArray(categoriesValue)
      ? categoriesValue.join(", ")
      : String(categoriesValue);

    setStatus("");
    overlay.hidden = false;
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".admin-project-editor-close")) {
      close();
    }
  });

  titleField.addEventListener("input", () => {
    if (state.mode !== "create") return;
    if (slugField.dataset.manual === "1") return;
    slugField.value = toSlug(titleField.value || "");
  });

  slugField.addEventListener("input", () => {
    slugField.dataset.manual = slugField.value.trim() ? "1" : "0";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      slug: String(fields.slug.value || "").trim().toLowerCase(),
      title: String(fields.title.value || "").trim(),
      description: String(fields.description.value || "").trim(),
      categories: String(fields.categoriesText.value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      imagePath: String(fields.imagePath.value || "").trim(),
      deliveryType: String(fields.deliveryType.value || "content").trim().toLowerCase(),
      locked: String(fields.locked.value || "false").toLowerCase() === "true",
      externalUrl: String(fields.externalUrl.value || "").trim(),
      htmlContent: String(fields.htmlContent.value || ""),
    };

    try {
      setSubmitting(true);
      setStatus("", { loading: true });
      await onSubmit({
        mode: state.mode,
        projectId: state.projectId,
        payload,
      });
      close();
    } catch (error) {
      setStatus(error.message || "Failed to save project.");
    } finally {
      setSubmitting(false);
    }
  });

  return {
    open,
    close,
  };
}

export function createUserProjectsModal() {
  const overlay = document.createElement("div");
  overlay.id = "admin-user-projects-modal";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-user-projects-title">
      <button type="button" class="modal-close admin-user-projects-close" aria-label="Close user projects">×</button>
      <h2 id="admin-user-projects-title">User Projects</h2>
      <div id="admin-user-projects-body" class="admin-user-projects-body"></div>
      <p id="admin-user-projects-status" class="modal-status" aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const bodyEl = overlay.querySelector("#admin-user-projects-body");
  const statusEl = overlay.querySelector("#admin-user-projects-status");
  let editingUserId = null;

  const close = () => {
    overlay.hidden = true;
    editingUserId = null;
    statusEl.textContent = "";
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".admin-user-projects-close")) {
      close();
    }
  });

  return {
    root: overlay,
    open(contentHtml, userId) {
      editingUserId = userId;
      bodyEl.innerHTML = contentHtml;
      statusEl.textContent = "";
      overlay.hidden = false;
    },
    render(contentHtml) {
      bodyEl.innerHTML = contentHtml;
    },
    setStatus(message, { loading = false } = {}) {
      if (loading) {
        statusEl.innerHTML = loadingMarkup;
        return;
      }

      statusEl.textContent = message || "";
    },
    close,
    isOpen() {
      return !overlay.hidden;
    },
    getEditingUserId() {
      return editingUserId;
    },
  };
}

export function createRequestReviewModal({ onSubmit }) {
  const overlay = document.createElement("div");
  overlay.id = "admin-request-review-modal";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="admin-request-review-title">
      <button type="button" class="modal-close admin-request-review-close" aria-label="Close review modal">×</button>
      <h2 id="admin-request-review-title">Reject Request</h2>
      <form id="admin-request-review-form" class="modal-form">
        <label for="admin-request-review-note">Message to user</label>
        <textarea id="admin-request-review-note" name="note" rows="5" placeholder="Explain why access is rejected..." required></textarea>
        <button type="submit" class="modal-submit">Send Rejection</button>
      </form>
      <p id="admin-request-review-status" class="modal-status" aria-live="polite"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#admin-request-review-form");
  const statusEl = overlay.querySelector("#admin-request-review-status");
  const noteField = form.querySelector("#admin-request-review-note");
  const submitBtn = form.querySelector('button[type="submit"]');
  let editingRequestId = null;

  const close = () => {
    overlay.hidden = true;
    editingRequestId = null;
    form.reset();
    statusEl.textContent = "";
  };

  const setStatus = (message, { loading = false } = {}) => {
    if (loading) {
      statusEl.innerHTML = loadingMarkup;
      return;
    }

    statusEl.textContent = message || "";
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest(".admin-request-review-close")) {
      close();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const note = String(noteField.value || "").trim();
    if (!note) {
      setStatus("A rejection message is required.");
      return;
    }

    try {
      submitBtn.disabled = true;
      setStatus("", { loading: true });
      await onSubmit({
        requestId: editingRequestId,
        note,
      });
      close();
    } catch (error) {
      setStatus(error.message || "Failed to reject request.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    open(requestId) {
      editingRequestId = requestId;
      form.reset();
      statusEl.textContent = "";
      overlay.hidden = false;
      noteField.focus();
    },
    close,
  };
}
