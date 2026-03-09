export const APP_EVENT_NAMES = Object.freeze({
  authChanged: "auth:changed",
  openModal: "app:open-modal",
  closeModal: "app:close-modal",
});

export function emitAppEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
