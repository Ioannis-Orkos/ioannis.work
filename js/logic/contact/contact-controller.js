import { initializeContactApi, sendContactMessage } from "../../api/contact-api.js";
import { createContactUi } from "../../ui/contact/contact-ui.js";

const CONTACT_SUCCESS_UNTIL_KEY = "contact-success-until";
const CONTACT_SUCCESS_DURATION_MS = 5 * 60 * 1000;

function validateContactForm(payload) {
  const errors = {};

  if (!payload.name) {
    errors["contact-name"] = "Name is required.";
  } else if (!/^[a-zA-Z\s]{2,50}$/.test(payload.name)) {
    errors["contact-name"] = "Name must be 2-50 letters.";
  }

  if (!payload.email) {
    errors["contact-email"] = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors["contact-email"] = "Invalid email format.";
  }

  if (!payload.subject) {
    errors["contact-subject"] = "Subject is required.";
  } else if (payload.subject.length < 5 || payload.subject.length > 100) {
    errors["contact-subject"] = "Subject must be between 5 and 100 characters.";
  }

  if (!payload.message) {
    errors["contact-message"] = "Message is required.";
  } else if (payload.message.length < 10 || payload.message.length > 1000) {
    errors["contact-message"] = "Message must be between 10 and 1000 characters.";
  }

  return errors;
}

function getSuccessUntil() {
  const stored = window.localStorage.getItem(CONTACT_SUCCESS_UNTIL_KEY);
  const timestamp = Number(stored);
  return Number.isFinite(timestamp) ? timestamp : 0;
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

export function initContactController() {
  const ui = createContactUi();
  if (!ui.isReady) return;

  let resetTimer = null;
  initializeContactApi();

  const resetContactUi = () => {
    clearSuccessWindow();
    ui.reset();
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
      ui.reset();
    }, remaining);
  };

  if (isSuccessActive()) {
    ui.showSuccessState();
    ui.setInputsDisabled(true);
    scheduleSuccessReset();
  } else {
    clearSuccessWindow();
    ui.reset();
  }

  ui.bindSubmit(async () => {
    ui.clearErrors();
    ui.setStatus("");

    const payload = ui.getFormData();
    const errors = validateContactForm(payload);
    if (Object.keys(errors).length) {
      ui.showErrors(errors);
      return;
    }

    ui.setSubmitting(true);
    const result = await sendContactMessage({
      user_name: payload.name,
      user_email: payload.email,
      subject: payload.subject,
      message: payload.message,
    });
    ui.setSubmitting(false);

    if (!result.ok) {
      ui.setStatus(result.error, "red");
      return;
    }

    setSuccessWindow();
    ui.showSuccessState();
    ui.setInputsDisabled(true);
    scheduleSuccessReset();
  });

  ui.bindDismiss(() => {
    if (isSuccessActive()) return;
    resetContactUi();
  });

  ui.bindRouteChange(() => {
    if (window.location.hash !== "#contact") {
      if (isSuccessActive()) return;
      resetContactUi();
      return;
    }

    if (isSuccessActive()) {
      ui.showSuccessState();
      ui.setInputsDisabled(true);
      scheduleSuccessReset();
    }
  });
}
