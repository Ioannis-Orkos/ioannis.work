import { MODAL_ROUTE_IDS } from "./config.js";

function buildModalHash(modalId) {
  return modalId;
}

function parseModalHash() {
  const hash = window.location.hash.replace("#", "");
  if (!MODAL_ROUTE_IDS.includes(hash)) return null;
  return hash;
}

export function initModals({ mobileNavController, navigationController }) {
  const modalOverlays = [...document.querySelectorAll(".modal-overlay[data-modal-id]")];
  const modalTriggers = [...document.querySelectorAll("[data-modal]")];
  const modalMap = new Map(
    modalOverlays.map((overlay) => [overlay.dataset.modalId, overlay])
  );

  const hideAllModals = () => {
    modalOverlays.forEach((overlay) => {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "";
  };

  const showModal = (modalId) => {
    hideAllModals();
    const overlay = modalMap.get(modalId);
    if (!overlay) return false;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    return true;
  };

  const openModal = (modalId, { push = true } = {}) => {
    if (!modalMap.has(modalId)) return;

    if (mobileNavController.isOpen()) {
      mobileNavController.close();
    }

    const previousPageId = navigationController.getActivePageId();
    showModal(modalId);

    if (push) {
      history.pushState(
        { type: "modal", modalId, previousPageId },
        "",
        `#${buildModalHash(modalId)}`
      );
    }
  };

  const closeModal = () => {
    const modalIdFromHash = parseModalHash();
    if (!modalIdFromHash) return;

    if (history.state?.type === "modal") {
      history.back();
      return;
    }

    hideAllModals();
    navigationController.navigateTo("home", { push: false });
    history.replaceState({ type: "page", targetId: "home" }, "", "/");
  };

  const syncModalFromUrl = () => {
    const modalId = parseModalHash();
    if (!modalId) {
      hideAllModals();
      return;
    }

    if (!showModal(modalId)) {
      hideAllModals();
      navigationController.navigateTo("home", { push: false });
      history.replaceState({ type: "page", targetId: "home" }, "", "/");
    }
  };

  modalTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const modalId = trigger.dataset.modal;
      if (!modalId) return;

      event.preventDefault();
      openModal(modalId, { push: true });
    });
  });

  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-modal-close]");
    if (closeButton) {
      closeModal();
      return;
    }

    const overlay = event.target.closest(".modal-overlay[data-modal-id]");
    if (overlay && event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && parseModalHash()) {
      closeModal();
    }
  });

  window.addEventListener("popstate", syncModalFromUrl);
  window.addEventListener("hashchange", syncModalFromUrl);

  syncModalFromUrl();

  return {
    openModal,
    closeModal,
  };
}
