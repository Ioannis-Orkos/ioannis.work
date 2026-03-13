import { fetchEmbeddedHtml } from "../../shared/api/content-api.js";
import { APP_EVENT_NAMES } from "../../shared/events.js";
import { createRequestAccessModalUi } from "../projects/render/request-access-ui.js";
import { createEmbeddedDetailUi } from "../../shared/render/embedded-detail-ui.js";
import { isAdminUser, isAuthorizedUser } from "../../shared/auth/session-state.js";
import { createAviationUi } from "./render/aviation-ui.js";
import { createAviationService } from "./aviation-service.js";
import { createAviationState } from "./aviation-state.js";
import {
  buildAviationImageUrl,
  filterAviationItems,
  resolveAviationAccessLabel,
} from "./aviation-model.js";

export async function initAviationController({ navigationController } = {}) {
  const aviationPage = document.getElementById("aviation");
  const mainEl = document.querySelector("main");
  const aviationUi = createAviationUi();

  if (!aviationPage || !mainEl || !aviationUi.isReady) {
    return;
  }

  const state = createAviationState();
  const requestAccessModalUi = createRequestAccessModalUi();
  const embeddedDetailUi = createEmbeddedDetailUi({
    mainEl,
    sectionDataAttribute: "data-aviation-folder",
    sectionDatasetKey: "aviationFolder",
    frameIdPrefix: "aviation-frame",
    messageType: "aviation-frame-height",
    failureMessage: "Failed to load aviation content.",
    failureLogLabel: "[Aviation] Failed to load aviation page:",
    loadHtml: fetchEmbeddedHtml,
    sectionClassName: "page blog-embedded-page",
    frameClassName: "blog-embedded-frame",
  });

  const renderItems = () => {
    const filteredItems = filterAviationItems({
      items: state.items,
      query: aviationUi.getSearchQuery(),
      selectedCategories: state.selectedCategories,
    });

    aviationUi.renderList({
      items: filteredItems,
      onOpen: (item) => service.openItem(item, { push: true }),
      getImageUrl: buildAviationImageUrl,
      resolveAccessLabel: (item) =>
        resolveAviationAccessLabel({
          item,
          protectedContentBySlug: state.protectedContentBySlug,
          isAuthorized: isAuthorizedUser(),
          isAdmin: isAdminUser(),
        }),
    });

    return filteredItems;
  };

  const renderCategories = () => {
    aviationUi.renderCategories({
      items: state.items,
      selectedCategories: state.selectedCategories,
      onToggle: (category) => {
        if (state.selectedCategories.has(category)) {
          state.selectedCategories.delete(category);
        } else {
          state.selectedCategories.add(category);
        }

        renderItems();
        renderCategories();
      },
    });
  };

  const renderCatalog = () => {
    renderCategories();
    renderItems();
  };

  const service = createAviationService({
    state,
    navigationController,
    embeddedDetailUi,
    requestAccessModalUi,
    setStatus: (message) => aviationUi.setStatus(message),
    renderCatalog,
  });

  aviationUi.bindSearchInput(() => {
    renderItems();
  });

  aviationUi.bindSearchSubmit(() => {
    const filteredItems = renderItems();
    if (filteredItems.length) {
      service.openItem(filteredItems[0], { push: true });
    }
  });

  window.addEventListener(APP_EVENT_NAMES.authChanged, service.refreshAuthSensitiveState);

  if (requestAccessModalUi) {
    requestAccessModalUi.formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      requestAccessModalUi.setSubmitting(true);
      const submitted = await service.submitPendingAccessRequest();
      requestAccessModalUi.setSubmitting(false);
      if (!submitted) return;
      console.log("[Aviation] Request access UI updated without leaving the page.");
    });
  }

  try {
    await service.initialize();
    window.addEventListener("popstate", service.handleLocation);
    window.addEventListener("hashchange", service.handleLocation);
  } catch (error) {
    console.error("[Aviation] Failed to initialize aviation module:", error);
    aviationUi.showLoadError();
  }
}
