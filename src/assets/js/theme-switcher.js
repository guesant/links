(() => {
  const storageKey = "guesant-links-theme";
  const themes = new Set(["system", "dark", "light"]);
  const root = document.documentElement;
  const options = document.querySelectorAll("[data-theme-option]");

  let storedTheme = "";

  try {
    storedTheme = window.localStorage.getItem(storageKey) || "";
  } catch {}

  const initialTheme = themes.has(storedTheme) ? storedTheme : root.dataset.theme || "system";

  const applyTheme = (theme, persist) => {
    if (!themes.has(theme)) {
      return;
    }

    root.dataset.theme = theme;

    options.forEach((option) => {
      option.checked = option.value === theme;
    });

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch {}
    }
  };

  applyTheme(initialTheme, false);

  options.forEach((option) => {
    option.addEventListener("change", () => {
      applyTheme(option.value, true);
    });
  });
})();
