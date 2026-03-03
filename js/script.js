(() => {

  const mobileNav = document.getElementById("mobile-nav");
  const burgerButton = document.getElementById("h-burger-menu");


  if (!mobileNav || !burgerButton ) {
    return;
  }



  // == MOBILE NAV ========================== 

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

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-target]");
    if (!link) return;
    
    event.preventDefault();
    closeMobileNav();
  });

 
})();