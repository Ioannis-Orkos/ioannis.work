import { MODAL_ROUTE_IDS } from "../../shared/config.js";
import { APP_EVENT_NAMES } from "../../shared/events.js";

function parseModalHash() {
  const hash = window.location.hash.replace("#", "");
  return MODAL_ROUTE_IDS.includes(hash) ? hash : null;
}

export function createModalRouterUi({
  mobileNavController,
  navigationController,
  fallbackPageId = "home",
  fallbackPath = "/",
}) {
  const modalOverlays = [...document.querySelectorAll(".modal-overlay[data-modal-id]")];
  const modalTriggers = [...document.querySelectorAll("[data-modal]")];
  const modalMap = new Map(modalOverlays.map((overlay) => [overlay.dataset.modalId, overlay]));

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

    if (mobileNavController?.isOpen?.()) {
      mobileNavController.close();
    }

    const previousPageId = navigationController?.getActivePageId?.() || fallbackPageId;
    showModal(modalId);

    if (push) {
      history.pushState({ type: "modal", modalId, previousPageId }, "", `#${modalId}`);
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
    navigationController?.navigateTo?.(fallbackPageId, { push: false });
    history.replaceState({ type: "page", targetId: fallbackPageId }, "", fallbackPath);
  };

  const syncModalFromUrl = () => {
    const modalId = parseModalHash();
    if (!modalId) {
      hideAllModals();
      return;
    }

    if (!showModal(modalId)) {
      hideAllModals();
      navigationController?.navigateTo?.(fallbackPageId, { push: false });
      history.replaceState({ type: "page", targetId: fallbackPageId }, "", fallbackPath);
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

  window.addEventListener(APP_EVENT_NAMES.openModal, (event) => {
    const modalId = event?.detail?.modalId;
    if (!modalId) return;
    openModal(modalId, { push: true });
  });

  window.addEventListener(APP_EVENT_NAMES.closeModal, () => {
    closeModal();
  });

  syncModalFromUrl();

  return {
    openModal,
    closeModal,
  };
}
