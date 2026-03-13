const COOKIE_NOTICE_KEY = "ioannis_cookie_notice_acknowledged";
const COOKIE_BANNER_MINIMIZE_DELAY_MS = 10000;

function readCookieNoticeAcknowledged() {
  try {
    return window.localStorage.getItem(COOKIE_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveCookieNoticeAcknowledged() {
  try {
    window.localStorage.setItem(COOKIE_NOTICE_KEY, "1");
  } catch {
    // Ignore storage errors and simply hide the banner for the current page view.
  }
}

export function initCookieController() {
  const bannerEl = document.getElementById("cookie-banner");
  const acceptButtonEl = document.getElementById("cookie-banner-accept");
  const minimizeButtonEl = document.getElementById("cookie-banner-minimize");
  const pillButtonEl = document.getElementById("cookie-banner-pill");

  if (!bannerEl || !acceptButtonEl || !minimizeButtonEl || !pillButtonEl) {
    return;
  }

  let minimizeTimerId = 0;

  const clearMinimizeTimer = () => {
    if (!minimizeTimerId) {
      return;
    }

    window.clearTimeout(minimizeTimerId);
    minimizeTimerId = 0;
  };

  const hideBanner = () => {
    clearMinimizeTimer();
    bannerEl.classList.remove("is-minimized");
    bannerEl.hidden = true;
    pillButtonEl.hidden = true;
  };

  const minimizeBanner = () => {
    clearMinimizeTimer();
    bannerEl.classList.add("is-minimized");
    pillButtonEl.hidden = false;
  };

  const expandBanner = () => {
    clearMinimizeTimer();
    bannerEl.hidden = false;
    bannerEl.classList.remove("is-minimized");
    pillButtonEl.hidden = true;
    minimizeTimerId = window.setTimeout(minimizeBanner, COOKIE_BANNER_MINIMIZE_DELAY_MS);
  };

  if (readCookieNoticeAcknowledged()) {
    hideBanner();
    return;
  }

  expandBanner();

  minimizeButtonEl.addEventListener("click", () => {
    minimizeBanner();
  });

  pillButtonEl.addEventListener("click", () => {
    expandBanner();
  });

  acceptButtonEl.addEventListener("click", () => {
    saveCookieNoticeAcknowledged();
    hideBanner();
  });
}
