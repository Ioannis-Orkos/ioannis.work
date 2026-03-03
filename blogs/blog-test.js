(function () {
  const heading = document.querySelector("h1");
  if (!heading) return;

  const badge = document.createElement("small");
  badge.textContent = " JS loaded";
  badge.style.marginLeft = "8px";
  badge.style.color = "#0ea5e9";
  heading.appendChild(badge);

  console.log("[Blog Test] Script loaded for:", heading.textContent.trim());
})();
