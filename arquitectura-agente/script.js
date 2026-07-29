document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = {
    general: document.getElementById("panel-general"),
    food: document.getElementById("panel-food"),
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle("active", key === target);
      });
      window.location.hash = target;
    });
  });

  const initial = window.location.hash.replace("#", "");
  if (initial && panels[initial]) {
    document.querySelector(`.tab-btn[data-tab="${initial}"]`)?.click();
  }
});
