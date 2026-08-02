document.addEventListener("DOMContentLoaded", () => {
  // ---------------------------------------------------------------- idiomas
  const LANGS = ["es", "en", "pt"];
  const DEFAULT_LANG = "es";
  const LANG_KEY = "gymnasia.arch.lang";
  const SVG_NS = "http://www.w3.org/2000/svg";

  function resolveInitialLang() {
    const fromQuery = new URLSearchParams(window.location.search).get("lang");
    if (LANGS.includes(fromQuery)) return fromQuery;
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (LANGS.includes(stored)) return stored;
    } catch {}
    const navLang = (navigator.language || "").slice(0, 2).toLowerCase();
    return LANGS.includes(navLang) ? navLang : DEFAULT_LANG;
  }

  function applyLang(lang) {
    const dict = window.I18N?.[lang];
    if (!dict) return;
    const fallback = window.I18N[DEFAULT_LANG] || {};

    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = dict[key] ?? fallback[key];
      if (typeof value !== "string") return;
      // Los <text> de SVG no admiten innerHTML de forma fiable.
      if (el.namespaceURI === SVG_NS) el.textContent = value;
      else el.innerHTML = value;
    });

    // Etiquetas accesibles de los grafos.
    document.querySelectorAll("[data-i18n-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-label");
      const value = dict[key] ?? fallback[key];
      if (typeof value === "string") el.setAttribute("aria-label", value);
    });

    const title = dict["head.title"] ?? fallback["head.title"];
    if (title) document.title = title;
    const desc = dict["head.desc"] ?? fallback["head.desc"];
    const descTag = document.querySelector('meta[name="description"]');
    if (desc && descTag) descTag.setAttribute("content", desc);

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const isActive = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {}

    // El idioma queda en la URL para poder compartir el enlace traducido.
    const url = new URL(window.location.href);
    if (lang === DEFAULT_LANG) url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    window.history.replaceState(null, "", url.toString());
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.getAttribute("data-lang")));
  });

  const initialLang = resolveInitialLang();
  if (initialLang !== DEFAULT_LANG) applyLang(initialLang);
  else applyLang(DEFAULT_LANG);

  // ---------------------------------------------------------------- pestañas
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

  const initialTab = window.location.hash.replace("#", "");
  if (initialTab && panels[initialTab]) {
    document.querySelector(`.tab-btn[data-tab="${initialTab}"]`)?.click();
  }
});
