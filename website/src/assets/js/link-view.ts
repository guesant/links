(() => {
  const root = document.documentElement;

  const storageKey = 'guesant-links-view';

  const modes = new Set(['compact', 'detailed']);

  const sync = () => {
    for (const control of document.querySelectorAll<HTMLInputElement>(
      '[data-link-view-control]',
    )) {
      control.checked = control.value === root.dataset.linkView;
    }
  };

  const apply = (mode: string | null | undefined) => {
    const resolveMode = () => {
      if (mode && modes.has(mode)) {
        return mode;
      }

      return 'compact';
    };

    root.dataset.linkView = resolveMode();
    sync();
  };

  let saved;

  try {
    saved = window.localStorage.getItem(storageKey);
  } catch {}

  apply(saved);
  root.dataset.linkViewReady = 'true';
  document.addEventListener('DOMContentLoaded', sync);
  document.addEventListener('lobby:navigate', sync);
  document.addEventListener('change', (event: Event) => {
    const control = event.target;

    if (
      !(control instanceof HTMLInputElement) ||
      !control.matches('[data-link-view-control]') ||
      !control.checked ||
      !modes.has(control.value)
    ) {
      return;
    }

    apply(control.value);

    try {
      window.localStorage.setItem(storageKey, control.value);
    } catch {}
  });
})();
