export function createContactUi() {
  const formEl = document.getElementById("contact-form");
  const statusEl = document.getElementById("contact-status");
  const thankYouEl = document.getElementById("thank-you-message");
  const submitBtnEl = document.getElementById("submit-button");
  const overlayEl = document.getElementById("contact-modal");
  const modalCardEl = overlayEl?.querySelector(".modal-card") || null;
  const modalTitleEl = document.getElementById("contact-modal-title");

  const clearErrors = () => {
    formEl.querySelectorAll(".error-message").forEach((el) => {
      el.textContent = "";
    });
  };

  const setStatus = (message, color = "") => {
    statusEl.textContent = message;
    statusEl.style.color = color;
  };

  const setSubmitting = (isSubmitting) => {
    submitBtnEl.disabled = isSubmitting;
    submitBtnEl.textContent = isSubmitting ? "Sending..." : "Send Message";
  };

  const setInputsDisabled = (disabled) => {
    formEl.querySelectorAll("input, textarea, button").forEach((el) => {
      el.disabled = disabled;
    });
  };

  const showSuccessState = () => {
    formEl.hidden = true;
    thankYouEl.hidden = false;
    modalCardEl.classList.add("contact-success");
    modalTitleEl.hidden = true;
    statusEl.hidden = true;
  };

  const showFormState = () => {
    formEl.hidden = false;
    thankYouEl.hidden = true;
    modalCardEl.classList.remove("contact-success");
    modalTitleEl.hidden = false;
    statusEl.hidden = false;
  };

  const reset = () => {
    formEl.reset();
    clearErrors();
    setStatus("");
    showFormState();
    setInputsDisabled(false);
    setSubmitting(false);
  };

  return {
    isReady: Boolean(formEl && statusEl && thankYouEl && submitBtnEl && overlayEl && modalCardEl && modalTitleEl),
    getFormData() {
      return {
        name: formEl.querySelector("#contact-name")?.value.trim() || "",
        email: formEl.querySelector("#contact-email")?.value.trim() || "",
        subject: formEl.querySelector("#contact-subject")?.value.trim() || "",
        message: formEl.querySelector("#contact-message")?.value.trim() || "",
      };
    },
    bindSubmit(handler) {
      formEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        await handler();
      });
    },
    bindDismiss(handler) {
      document.addEventListener("click", (event) => {
        const closeButton = event.target.closest("[data-modal-close]");
        const overlay = event.target.closest(".modal-overlay[data-modal-id]");
        const clickedContactOverlay = overlay?.dataset.modalId === "contact";

        if (closeButton && overlayEl && !overlayEl.hidden) {
          handler();
          return;
        }

        if (clickedContactOverlay && event.target === overlay && overlayEl && !overlayEl.hidden) {
          handler();
        }
      });
    },
    bindRouteChange(handler) {
      window.addEventListener("hashchange", handler);
    },
    clearErrors,
    showErrors(errors) {
      Object.entries(errors).forEach(([inputId, message]) => {
        const errorEl = formEl.querySelector(`[data-error-for="${inputId}"]`);
        if (errorEl) errorEl.textContent = message;
      });
    },
    setStatus,
    setSubmitting,
    setInputsDisabled,
    showSuccessState,
    showFormState,
    reset,
  };
}
