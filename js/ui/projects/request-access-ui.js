import { APP_EVENT_NAMES, emitAppEvent } from "../../shared/events.js";

export function createRequestAccessModalUi() {
  const formEl = document.getElementById("request-access-form");
  const noteEl = document.getElementById("request-access-note");
  const messageEl = document.getElementById("request-access-message");
  const statusEl = document.getElementById("request-access-status");
  const confirmBtn = document.getElementById("request-access-confirm");
  const modalCardEl = document.querySelector("#request-access-modal .modal-card");

  if (!formEl || !noteEl || !messageEl || !statusEl || !confirmBtn || !modalCardEl) {
    return null;
  }

  const setStatus = (message) => {
    statusEl.textContent = message || "";
  };

  const reset = () => {
    formEl.reset();
    noteEl.disabled = false;
    noteEl.readOnly = false;
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Send Request";
    confirmBtn.dataset.pending = "";
    modalCardEl.classList.remove("request-access-waiting", "request-access-rejected");
    setStatus("");
  };

  const open = ({ project, requestStatus, canSubmit, requestNote = "", reviewNote = "" }) => {
    reset();

    const isPending = requestStatus === "pending";
    confirmBtn.dataset.pending = isPending ? "1" : "";

    if (requestStatus === "pending") {
      messageEl.textContent = `Your request for "${project.title}" is waiting approval from admin.`;
    } else if (requestStatus === "rejected") {
      messageEl.textContent = reviewNote
        ? `Access to\n"${project.title}" was rejected.\nYour previous message: ${requestNote || "No message provided."}\nAdmin message: ${reviewNote}\n\nContact admin to continue.`
        : `Your request for "${project.title}" was rejected. Contact admin or send a new message for review.`;
    } else {
      messageEl.textContent = `You do not have access to "${project.title}" yet. Send a request message to admin?`;
    }

    modalCardEl.classList.toggle("request-access-waiting", isPending);
    modalCardEl.classList.toggle("request-access-rejected", requestStatus === "rejected");

    noteEl.value = isPending ? requestNote : "";
    noteEl.disabled = !canSubmit || isPending;
    noteEl.readOnly = isPending;

    confirmBtn.disabled = !canSubmit || isPending;
    confirmBtn.textContent = isPending ? "Waiting Approval" : "Send Request";

    emitAppEvent(APP_EVENT_NAMES.openModal, { modalId: "request-access" });
  };

  const setSubmitting = (isSubmitting) => {
    if (confirmBtn.dataset.pending === "1") return;
    confirmBtn.disabled = isSubmitting;
    confirmBtn.textContent = isSubmitting ? "Sending..." : "Send Request";
  };

  return {
    formEl,
    noteEl,
    setStatus,
    getNote() {
      return String(noteEl.value || "").trim();
    },
    open,
    reset,
    setSubmitting,
  };
}
