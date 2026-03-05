(() => {
  const data = [
    { id: "DEF-104", title: "Hydraulic pressure fluctuation", risk: 9, state: "Open" },
    { id: "DEF-088", title: "Cabin temp sensor drift", risk: 5, state: "Open" },
    { id: "DEF-141", title: "Nose gear indication delay", risk: 8, state: "In Progress" },
    { id: "DEF-072", title: "Galley power intermittent", risk: 4, state: "Deferred" },
  ];

  const rankBtn = document.getElementById("rank-btn");
  const openCol = document.getElementById("col-open");
  const inProgressCol = document.getElementById("col-in-progress");
  const deferredCol = document.getElementById("col-deferred");

  const createItem = (entry) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${entry.id}</strong> - ${entry.title}<br><span class="score">Score: ${entry.risk}</span>`;
    return div;
  };

  const render = (items) => {
    openCol.innerHTML = "";
    inProgressCol.innerHTML = "";
    deferredCol.innerHTML = "";

    items.forEach((entry) => {
      const item = createItem(entry);
      if (entry.state === "Open") openCol.appendChild(item);
      if (entry.state === "In Progress") inProgressCol.appendChild(item);
      if (entry.state === "Deferred") deferredCol.appendChild(item);
    });
  };

  rankBtn.addEventListener("click", () => {
    const sorted = [...data].sort((a, b) => b.risk - a.risk);
    render(sorted);
  });

  render(data);
})();
