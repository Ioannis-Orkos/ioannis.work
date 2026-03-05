const EMAIL_SERVICE_ID = "service_3tkfh67";
const EMAIL_TEMPLATE_ID = "template_55tr6up";
const EMAIL_PUBLIC_KEY = "0CfalwA7NXSuNVflV";
const CONTACT_SUCCESS_UNTIL_KEY = "contact-success-until";
const CONTACT_SUCCESS_DURATION_MS = 5 * 60 * 1000;

function setStatus(statusEl, message, color = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = color;
}

function clearErrors(formEl, statusEl) {
  formEl.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = "";
  });
  setStatus(statusEl, "");
}

function showError(formEl, inputId, message) {
  const errorEl = formEl.querySelector(`[data-error-for="${inputId}"]`);
  if (errorEl) errorEl.textContent = message;
}

function validateForm(formEl) {
  let valid = true;

  const name = formEl.querySelector("#contact-name")?.value.trim() || "";
  if (!name) {
    showError(formEl, "contact-name", "Name is required.");
    valid = false;
  } else if (!/^[a-zA-Z\s]{2,50}$/.test(name)) {
    showError(formEl, "contact-name", "Name must be 2-50 letters.");
    valid = false;
  }

  const email = formEl.querySelector("#contact-email")?.value.trim() || "";
  if (!email) {
    showError(formEl, "contact-email", "Email is required.");
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError(formEl, "contact-email", "Invalid email format.");
    valid = false;
  }

  const subject = formEl.querySelector("#contact-subject")?.value.trim() || "";
  if (!subject) {
    showError(formEl, "contact-subject", "Subject is required.");
    valid = false;
  } else if (subject.length < 5 || subject.length > 100) {
    showError(
      formEl,
      "contact-subject",
      "Subject must be between 5 and 100 characters."
    );
    valid = false;
  }

  const message = formEl.querySelector("#contact-message")?.value.trim() || "";
  if (!message) {
    showError(formEl, "contact-message", "Message is required.");
    valid = false;
  } else if (message.length < 10 || message.length > 1000) {
    showError(
      formEl,
      "contact-message",
      "Message must be between 10 and 1000 characters."
    );
    valid = false;
  }

  return valid;
}

function getSuccessUntil() {
  const stored = window.localStorage.getItem(CONTACT_SUCCESS_UNTIL_KEY);
  const timestamp = Number(stored);
  if (!Number.isFinite(timestamp)) return 0;
  return timestamp;
}

function isSuccessActive() {
  return getSuccessUntil() > Date.now();
}

function setSuccessWindow() {
  const until = Date.now() + CONTACT_SUCCESS_DURATION_MS;
  window.localStorage.setItem(CONTACT_SUCCESS_UNTIL_KEY, String(until));
  return until;
}

function clearSuccessWindow() {
  window.localStorage.removeItem(CONTACT_SUCCESS_UNTIL_KEY);
}

function showSuccessState(formEl, thankYouEl, statusEl, modalCardEl, modalTitleEl) {
  formEl.hidden = true;
  if (thankYouEl) {
    thankYouEl.hidden = false;
  }
  if (modalCardEl) {
    modalCardEl.classList.add("contact-success");
  }
  if (modalTitleEl) {
    modalTitleEl.hidden = true;
  }
  if (statusEl) {
    statusEl.hidden = true;
  }
}

function resetFormState(
  formEl,
  thankYouEl,
  submitBtnEl,
  statusEl,
  modalCardEl,
  modalTitleEl
) {
  clearSuccessWindow();
  formEl.hidden = false;
  if (thankYouEl) {
    thankYouEl.hidden = true;
  }
  if (modalCardEl) {
    modalCardEl.classList.remove("contact-success");
  }
  if (modalTitleEl) {
    modalTitleEl.hidden = false;
  }
  if (statusEl) {
    statusEl.hidden = false;
  }
  formEl.reset();
  formEl.querySelectorAll("input, textarea, button").forEach((el) => {
    el.disabled = false;
  });
  if (submitBtnEl) {
    submitBtnEl.textContent = "Send Message";
  }
  setStatus(statusEl, "");
  clearErrors(formEl, statusEl);
}

async function sendEmail({
  formEl,
  submitBtnEl,
  statusEl,
  thankYouEl,
  modalCardEl,
  modalTitleEl,
}) {
  if (typeof window.emailjs === "undefined") {
    setStatus(
      statusEl,
      "EmailJS is not loaded. Please check your internet connection.",
      "red"
    );
    return;
  }

  submitBtnEl.disabled = true;
  submitBtnEl.textContent = "Sending...";

  const payload = {
    user_name: formEl.querySelector("#contact-name")?.value.trim() || "",
    user_email: formEl.querySelector("#contact-email")?.value.trim() || "",
    subject: formEl.querySelector("#contact-subject")?.value.trim() || "",
    message: formEl.querySelector("#contact-message")?.value.trim() || "",
  };

  try {
    await window.emailjs.send(EMAIL_SERVICE_ID, EMAIL_TEMPLATE_ID, payload);
    setSuccessWindow();
    showSuccessState(formEl, thankYouEl, statusEl, modalCardEl, modalTitleEl);
    formEl.querySelectorAll("input, textarea, button").forEach((el) => {
      el.disabled = true;
    });
  } catch (error) {
    console.error("EmailJS Error:", error);
    setStatus(statusEl, "Failed to send the message. Please try again later.", "red");
  } finally {
    submitBtnEl.disabled = false;
    submitBtnEl.textContent = "Send Message";
  }
}

export function initContactForm() {
  const formEl = document.getElementById("contact-form");
  const statusEl = document.getElementById("contact-status");
  const thankYouEl = document.getElementById("thank-you-message");
  const submitBtnEl = document.getElementById("submit-button");
  const contactOverlay = document.getElementById("contact-modal");
  const modalCardEl = contactOverlay?.querySelector(".modal-card");
  const modalTitleEl = document.getElementById("contact-modal-title");
  let resetTimer = null;

  if (!formEl || !submitBtnEl) return;

  const showSuccessUi = () => {
    showSuccessState(formEl, thankYouEl, statusEl, modalCardEl, modalTitleEl);
  };

  const resetContactUi = () => {
    resetFormState(
      formEl,
      thankYouEl,
      submitBtnEl,
      statusEl,
      modalCardEl,
      modalTitleEl
    );
  };

  const scheduleSuccessReset = () => {
    if (resetTimer) {
      window.clearTimeout(resetTimer);
      resetTimer = null;
    }

    const remaining = getSuccessUntil() - Date.now();
    if (remaining <= 0) return;

    resetTimer = window.setTimeout(() => {
      clearSuccessWindow();
      resetContactUi();
    }, remaining);
  };

  if (typeof window.emailjs !== "undefined") {
    window.emailjs.init(EMAIL_PUBLIC_KEY);
  }

  if (isSuccessActive()) {
    showSuccessUi();
    scheduleSuccessReset();
  } else {
    clearSuccessWindow();
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(formEl, statusEl);

    if (!validateForm(formEl)) return;
    await sendEmail({
      formEl,
      submitBtnEl,
      statusEl,
      thankYouEl,
      modalCardEl,
      modalTitleEl,
    });
    if (isSuccessActive()) {
      scheduleSuccessReset();
    }
  });

  // When modal closes, reset the contact form UI back to initial state.
  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-modal-close]");
    const overlay = event.target.closest(".modal-overlay[data-modal-id]");
    const clickedContactOverlay = overlay?.dataset.modalId === "contact";

    if (closeButton && contactOverlay && !contactOverlay.hidden) {
      if (isSuccessActive()) return;
      resetContactUi();
      return;
    }

    if (
      clickedContactOverlay &&
      event.target === overlay &&
      contactOverlay &&
      !contactOverlay.hidden
    ) {
      if (isSuccessActive()) return;
      resetContactUi();
    }
  });

  window.addEventListener("hashchange", () => {
    if (window.location.hash !== "#contact") {
      if (isSuccessActive()) return;
      resetContactUi();
      return;
    }

    if (isSuccessActive()) {
      showSuccessUi();
      scheduleSuccessReset();
    }
  });
}
