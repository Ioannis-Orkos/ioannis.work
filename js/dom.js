export function getDomRefs() {
  const root = document.documentElement;
  const header = document.querySelector("header");
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
  const navLinks = [...document.querySelectorAll("a[data-target]")];
  const pageMap = new Map(pages.map((page) => [page.id, page]));

  return {
    root,
    header,
    mobileNav,
    burgerButton,
    themeButtons,
    themeIcons,
    pages,
    navLinks,
    pageMap,
  };
}

export function hasRequiredDom(refs) {
  return Boolean(
    refs.root &&
    refs.header &&
    refs.mobileNav &&
    refs.burgerButton &&
    refs.themeButtons.length &&
    refs.themeIcons.length &&
    refs.pages.length
  );
}
