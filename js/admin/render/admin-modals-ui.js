import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";
import { toSlug } from "../../shared/html.js";
import { normalizeStringArray } from "../../shared/normalize.js";
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

export function createContentEditorModalUi({ onSubmit }) {
  const overlay = document.getElementById("admin-content-editor-modal");
  const form = document.getElementById("admin-content-editor-form");
  const titleEl = document.getElementById("admin-content-editor-title");
  const statusEl = document.getElementById("admin-content-editor-status");
  const submitBtn = form?.querySelector('button[type="submit"]') || null;
  const titleField = document.getElementById("admin-content-title");
  const slugField = document.getElementById("admin-content-slug");

  const fields = {
    section: document.getElementById("admin-content-section"),
    slug: slugField,
    title: titleField,
    description: document.getElementById("admin-content-description"),
    imagePath: document.getElementById("admin-content-image"),
    categoriesText: document.getElementById("admin-content-categories"),
    deliveryType: document.getElementById("admin-content-delivery"),
    locked: document.getElementById("admin-content-locked"),
    isPublished: document.getElementById("admin-content-published"),
    externalUrl: document.getElementById("admin-content-external-url"),
    htmlContent: document.getElementById("admin-content-body"),
  };

  if (
    !overlay ||
    !form ||
    !titleEl ||
    !statusEl ||
    !submitBtn ||
    !titleField ||
    !slugField ||
    !fields.section ||
    !fields.description ||
    !fields.imagePath ||
    !fields.categoriesText ||
    !fields.deliveryType ||
    !fields.locked ||
    !fields.isPublished ||
    !fields.externalUrl ||
    !fields.htmlContent
  ) {
    return null;
  }

  const state = {
    mode: "edit",
    contentId: null,
  };

  const clear = () => {
    form.reset();
    state.mode = "edit";
    state.contentId = null;
    titleEl.textContent = "Edit Content";
    submitBtn.textContent = "Save Content";
    slugField.dataset.manual = "0";
    if (fields.section) {
      fields.section.value = "project";
    }
    if (fields.locked) {
      fields.locked.value = "false";
    }
    if (fields.isPublished) {
      fields.isPublished.checked = true;
    }
    statusEl.textContent = "";
    submitBtn.disabled = false;
  };

  bindModalReset("admin-content-editor-modal", clear);

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
      section: String(fields.section?.value || "project").trim().toLowerCase(),
      slug: String(fields.slug.value || "").trim().toLowerCase(),
      title: String(fields.title.value || "").trim(),
      description: String(fields.description?.value || "").trim(),
      categories: normalizeStringArray(String(fields.categoriesText?.value || "")),
      imagePath: String(fields.imagePath?.value || "").trim(),
      deliveryType: String(fields.deliveryType?.value || "content").trim().toLowerCase(),
      locked: String(fields.locked?.value || "false").toLowerCase() === "true",
      isPublished: Boolean(fields.isPublished?.checked),
      externalUrl: String(fields.externalUrl?.value || "").trim(),
      htmlContent: String(fields.htmlContent?.value || ""),
    };

    try {
      submitBtn.disabled = true;
      statusEl.innerHTML = loadingMarkup;
      await onSubmit({
        mode: state.mode,
        contentId: state.contentId,
        payload,
      });
      clear();
      emitAppEvent(APP_EVENT_NAMES.closeModal);
    } catch (error) {
      statusEl.textContent = error.message || "Failed to save content.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    open(contentItem, { mode = "edit" } = {}) {
      state.mode = mode === "create" ? "create" : "edit";
      state.contentId = state.mode === "edit" ? Number(contentItem?.id) : null;

      titleEl.textContent = state.mode === "create" ? "Add Content" : "Edit Content";
      submitBtn.textContent = state.mode === "create" ? "Add Content" : "Save Content";

      fields.section.value = String(contentItem?.section || "project").trim().toLowerCase();
      fields.slug.value = String(contentItem?.slug || "");
      fields.slug.dataset.manual = state.mode === "create" && fields.slug.value.trim() ? "1" : "0";
      fields.title.value = String(contentItem?.title || "");
      fields.description.value = String(contentItem?.description || "");
      fields.imagePath.value = String(contentItem?.imagePath || "");
      fields.deliveryType.value =
        String(contentItem?.deliveryType || "content").toLowerCase() === "link" ? "link" : "content";
      fields.locked.value = Boolean(contentItem?.locked) ? "true" : "false";
      fields.isPublished.checked = contentItem?.isPublished !== false;
      fields.externalUrl.value = String(contentItem?.externalUrl || "");
      fields.htmlContent.value = String(contentItem?.htmlContent || "");
      fields.categoriesText.value = Array.isArray(contentItem?.categories) ? contentItem.categories.join(", ") : "";

      statusEl.textContent = "";
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "admin-content-editor" });
    },
  };
}

export function createUserContentModalUi() {
  const overlay = document.getElementById("admin-user-content-modal");
  const bodyEl = document.getElementById("admin-user-content-body");
  const statusEl = document.getElementById("admin-user-content-status");

  if (!overlay || !bodyEl || !statusEl) {
    return null;
  }

  let editingUserId = null;

  const reset = () => {
    editingUserId = null;
    bodyEl.innerHTML = "";
    statusEl.textContent = "";
  };

  bindModalReset("admin-user-content-modal", reset);

  return {
    root: overlay,
    open(contentHtml, userId) {
      editingUserId = userId;
      bodyEl.innerHTML = contentHtml;
      statusEl.textContent = "";
      emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "admin-user-content" });
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
        const toggleBtn = event.target.closest(".admin-user-content-toggle[data-content-toggle]");
        if (!toggleBtn || overlay.hidden) return;

        const action = String(toggleBtn.dataset.contentToggle || "");
        if (!["assign", "remove"].includes(action)) return;

        const contentRow = toggleBtn.closest("[data-content-id]");
        const contentId = Number(contentRow?.dataset.contentId);
        if (!Number.isFinite(contentId)) return;

        await handler({
          userId: Number(editingUserId),
          contentId,
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
