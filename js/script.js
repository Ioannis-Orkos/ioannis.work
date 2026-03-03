(() => {

  const mobileNav = document.getElementById("mobile-nav");
  const burgerButton = document.getElementById("h-burger-menu");


  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll("header nav ul li a[data-target]")];
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  if (!mobileNav || !burgerButton || pages.length === 0 || navLinks.length === 0) {
    return;
  }

  /* ==ACTIVE LINK + PAGE ========================== */

  const setActiveLink = (targetId) => {
    navLinks.forEach((link) => {
      const isActive = link.dataset.target === targetId;

      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const setActivePage = (targetId) => {
    if (!pageMap.has(targetId)) return false;

    pages.forEach((page) => {
      page.classList.toggle("active", page.id === targetId);
    });

    setActiveLink(targetId);
    return true;
  };



  /* == MOBILE NAV ========================== */

  const closeMobileNav = () => {
    mobileNav.classList.remove("active");
    burgerButton.classList.remove("active");
    burgerButton.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  const openMobileNav = () => {
    mobileNav.classList.add("active");
    burgerButton.classList.add("active");
    burgerButton.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  burgerButton.setAttribute("role", "button");
  burgerButton.setAttribute("aria-label", "Toggle mobile navigation");
  burgerButton.setAttribute("aria-expanded", "false");
  burgerButton.setAttribute("tabindex", "0");

  burgerButton.addEventListener("click", () => {
    mobileNav.classList.contains("active")
      ? closeMobileNav()
      : openMobileNav();
  });

  burgerButton.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      burgerButton.click();
    }
  });

  const desktopMq = window.matchMedia("(min-width: 769px)");

  desktopMq.addEventListener("change", (event) => {
    if (event.matches) {
      closeMobileNav();
    }
  });

  /* == NAVIGATION ========================== */

  const navigateTo = (targetId, { push = true } = {}) => {
    if (!setActivePage(targetId)) return;

    if (mobileNav.classList.contains("active")) {
      closeMobileNav();
    }

    if (push) {
      history.pushState({ targetId }, "", `#${targetId}`);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  };


  // Handle clicks on any link with data-target, including those inside mobile nav
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-target]");
    if (!link) return;

    e.preventDefault();
    navigateTo(link.dataset.target, { push: true });
  });


  /* == BACK / FORWARD SUPPORT ========================== */

  const syncFromUrl = () => {
    const hash = window.location.hash.replace("#", "");
    const defaultPage =
      pages.find((p) => p.classList.contains("active"))?.id || pages[0].id;

    const target = pageMap.has(hash) ? hash : defaultPage;

    setActivePage(target);
  };

  window.addEventListener("popstate", syncFromUrl);
  window.addEventListener("hashchange", syncFromUrl);



  /* == FIRST LOAD  ========================== */

  const initialHash = window.location.hash.replace("#", "");
  const defaultPage =
    pages.find((p) => p.classList.contains("active"))?.id || pages[0].id;

  const startPage = pageMap.has(initialHash) ? initialHash : defaultPage;

  setActivePage(startPage);

  // If no hash exists, write it once
  if (!initialHash) {
    history.replaceState(null, "", `#${startPage}`);
  }
 
})();