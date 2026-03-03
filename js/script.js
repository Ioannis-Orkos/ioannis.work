(() => {
  const root = document.documentElement;
  const mobileNav = document.getElementById("mobile-nav");
  const burgerButton = document.getElementById("h-burger-menu");

  const themeButtons = [
    document.getElementById("theme-toggle"),
    document.getElementById("theme-toggle-mobile"),
  ].filter(Boolean);

  const themeIcons = [
    document.getElementById("theme-icon"),
    document.getElementById("theme-icon-mobile"),
  ].filter(Boolean);


  const pages = [...document.querySelectorAll(".page")];
  const navLinks = [...document.querySelectorAll("header nav ul li a[data-target]")];
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  if ( !mobileNav || !burgerButton || !themeButtons.length || !themeIcons.length || !pages.length) {
    return;
  }


  const THEME_STORAGE_KEY = "site-theme";

  // Set theme and update icons/labels
  const setTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    const nextIcon = theme === "dark" ? "☀️" : "🌙";
    const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    for (const icon of themeIcons) {
      icon.textContent = nextIcon;
    }
    for (const button of themeButtons) {
      button.setAttribute("aria-label", nextLabel);
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  };

  // Initialize theme based on stored preference or default to light
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    setTheme(storedTheme);
  } else {
    setTheme("light");
  }


  for (const themeButton of themeButtons) {
    themeButton.addEventListener("click", () => {
      const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    });
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

  
  // Close mobile nav if switching to desktop view
  const desktopMq = window.matchMedia("(min-width: 769px)");
  desktopMq.addEventListener("change", (event) => {
    if (event.matches) {
      closeMobileNav();
    }
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