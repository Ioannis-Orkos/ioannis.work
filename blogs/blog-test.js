(function () {
  const script = document.currentScript;
  const scopedRoot = script?.closest(".blog-loaded-content") || document.body;
  const heading = scopedRoot.querySelector("h1");
  if (!heading) return;
  if (heading.dataset.jsLoaded === "1") return;
  heading.dataset.jsLoaded = "1";
  console.log("[Blog Test] Script loaded for:", heading.textContent.trim());
})();
