(() => {
  const storageKey = 'guesant-links-theme';

  const themes = new Set(['system', 'dark', 'light']);

  const root = document.documentElement;

  root.dataset.themeReady = 'true';

  let storedTheme = '';

  try {
    storedTheme = window.localStorage.getItem(storageKey) || '';
  } catch {}

  const resolveInitialTheme = () => {
    if (themes.has(storedTheme)) {
      return storedTheme;
    }

    return root.dataset.theme || 'system';
  };

  const initialTheme = resolveInitialTheme();

  const applyTheme = (theme: string | undefined, persist: boolean) => {
    if (!theme || !themes.has(theme)) {
      return;
    }

    root.dataset.theme = theme;

    document
      .querySelectorAll<HTMLInputElement>('[data-theme-option]')
      .forEach((option) => {
        option.checked = option.value === theme;
      });

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch {}
    }
  };

  applyTheme(initialTheme, false);

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(root.dataset.theme, false);
  });
  document.addEventListener('lobby:navigate', () => {
    applyTheme(root.dataset.theme, false);
  });

  document.addEventListener('change', (event: Event) => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.matches('[data-theme-option]')
    ) {
      applyTheme(event.target.value, true);
    }
  });
})();
