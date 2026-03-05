(() => {
  const status = document.getElementById("save-status");
  const task = document.getElementById("task");
  const shift = document.getElementById("shift");
  const notes = document.getElementById("notes");
  const saveBtn = document.getElementById("save-entry");

  saveBtn.addEventListener("click", () => {
    const payload = {
      task: task.value.trim(),
      shift: shift.value,
      notes: notes.value.trim(),
      savedAt: new Date().toISOString(),
    };

    if (!payload.task) {
      status.textContent = "Task is required.";
      return;
    }

    localStorage.setItem("line-maintenance-last-entry", JSON.stringify(payload));
    status.textContent = `Saved checklist item for ${payload.shift} shift.`;
  });
})();
