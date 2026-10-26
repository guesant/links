(() => {
  const storageKey = "guesant-links-theme";
  const themes = new Set(["system", "dark", "light"]);
  const root = document.documentElement;
  root.dataset.themeReady = "true";

  let storedTheme = "";

  try {
    storedTheme = window.localStorage.getItem(storageKey) || "";
  } catch {}

  const initialTheme = themes.has(storedTheme)
    ? storedTheme
    : root.dataset.theme || "system";

  const applyTheme = (theme, persist) => {
    if (!themes.has(theme)) {
      return;
    }

    root.dataset.theme = theme;

    document.querySelectorAll("[data-theme-option]").forEach((option) => {
      option.checked = option.value === theme;
    });

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch {}
    }
  };

  applyTheme(initialTheme, false);

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(root.dataset.theme, false);
  });

  document.addEventListener("change", (event) => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.matches("[data-theme-option]")
    ) {
      applyTheme(event.target.value, true);
    }
  });
})();
