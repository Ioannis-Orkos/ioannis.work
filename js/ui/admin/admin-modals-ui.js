import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { toSlug } from "../../shared/html.js";
import { loadingMarkup } from "./admin-ui.js";

function bindModalReset(modalId, onReset) {
  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest(`#${modalId} [data-modal-close]`);
    if (closeButton) {
      onReset();
      return;
    }

    const overlay = event.target.closest(`#${modalId}`);
    if (overlay && event.target === overlay) {
      onReset();
    }
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash !== `#${modalId.replace("-modal", "")}`) {
      onReset();
    }
  });
}

export function createProjectEditorModalUi({ onSubmit }) {
  const overlay = document.getElementById("admin-project-editor-modal");
  const form = document.getElementById("admin-project-editor-form");
  const statusEl = document.getElementById("admin-project-editor-status");
  const submitBtn = form?.querySelector('button[type="submit"]') || null;
  const titleField = document.getElementById("admin-project-title");
  const slugField = document.getElementById("admin-project-slug");

  if (!overlay || !form || !statusEl || !submitBtn || !titleField || !slugField) {
    return null;
  }

  const fields = {
    slug: slugField,
    title: titleField,
    description: document.getElementById("admin-project-description"),
    imagePath: document.getElementById("admin-project-image"),
    categoriesText: document.getElementById("admin-project-categories"),
    deliveryType: document.getElementById("admin-project-delivery"),
    locked: document.getElementById("admin-project-locked"),
    externalUrl: document.getElementById("admin-project-external-url"),
    htmlContent: document.getElementById("admin-project-content"),
  };

  const state = {
    mode: "edit",
    projectId: null,
  };

  const clear = () => {
    form.reset();
    state.mode = "edit";
    state.projectId = null;
    slugField.dataset.manual = "0";
    statusEl.textContent = "";
    submitBtn.disabled = false;
  };

  bindModalReset("admin-project-editor-modal", clear);

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
      submitBtn.disabled = true;
      statusEl.innerHTML = loadingMarkup;
      await onSubmit({
        mode: state.mode,
        projectId: state.projectId,
        payload,
      });
      clear();
      emitAppEvent(APP_EVENT_NAMES.closeModal);
    } catch (error) {
      statusEl.textContent = error.message || "Failed to save project.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    open(project, { mode = "edit" } = {}) {
      state.mode = mode === "create" ? "create" : "edit";
      state.projectId = state.mode === "edit" ? Number(project?.id) : null;

      fields.slug.value = String(project?.slug || "");
      fields.slug.dataset.manual = state.mode === "create" && fields.slug.value.trim() ? "1" : "0";
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

      statusEl.textContent = "";
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "admin-project-editor" });
    },
  };
}

export function createUserProjectsModalUi() {
  const overlay = document.getElementById("admin-user-projects-modal");
  const bodyEl = document.getElementById("admin-user-projects-body");
  const statusEl = document.getElementById("admin-user-projects-status");

  if (!overlay || !bodyEl || !statusEl) {
    return null;
  }

  let editingUserId = null;

  const reset = () => {
    editingUserId = null;
    bodyEl.innerHTML = "";
    statusEl.textContent = "";
  };

  bindModalReset("admin-user-projects-modal", reset);

  return {
    root: overlay,
    open(contentHtml, userId) {
      editingUserId = userId;
      bodyEl.innerHTML = contentHtml;
      statusEl.textContent = "";
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "admin-user-projects" });
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
    bindToggle(handler) {
      overlay.addEventListener("click", async (event) => {
        const toggleBtn = event.target.closest(".admin-user-project-toggle[data-project-toggle]");
        if (!toggleBtn || overlay.hidden) return;

        const action = String(toggleBtn.dataset.projectToggle || "");
        if (!["assign", "remove"].includes(action)) return;

        const projectRow = toggleBtn.closest("[data-project-id]");
        const projectId = Number(projectRow?.dataset.projectId);
        if (!Number.isFinite(projectId)) return;

        await handler({
          userId: Number(editingUserId),
          projectId,
          action,
          button: toggleBtn,
        });
      });
    },
    isOpen() {
      return !overlay.hidden;
    },
    getEditingUserId() {
      return editingUserId;
    },
  };
}

export function createRequestReviewModalUi({ onSubmit }) {
  const overlay = document.getElementById("admin-request-review-modal");
  const form = document.getElementById("admin-request-review-form");
  const statusEl = document.getElementById("admin-request-review-status");
  const noteField = document.getElementById("admin-request-review-note");
  const submitBtn = form?.querySelector('button[type="submit"]') || null;

  if (!overlay || !form || !statusEl || !noteField || !submitBtn) {
    return null;
  }

  let editingRequestId = null;

  const reset = () => {
    editingRequestId = null;
    form.reset();
    statusEl.textContent = "";
    submitBtn.disabled = false;
  };

  bindModalReset("admin-request-review-modal", reset);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const note = String(noteField.value || "").trim();
    if (!note) {
      statusEl.textContent = "A rejection message is required.";
      return;
    }

    try {
      submitBtn.disabled = true;
      statusEl.innerHTML = loadingMarkup;
      await onSubmit({
        requestId: editingRequestId,
        note,
      });
      reset();
      emitAppEvent(APP_EVENT_NAMES.closeModal);
    } catch (error) {
      statusEl.textContent = error.message || "Failed to reject request.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    open(requestId) {
      editingRequestId = requestId;
      form.reset();
      statusEl.textContent = "";
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "admin-request-review" });
      window.setTimeout(() => {
        noteField.focus();
      }, 0);
    },
  };
}
