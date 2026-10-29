(() => {
  const root = document.documentElement;

  const storageKey = 'guesant-links-motion';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let preference = root.dataset.motion === 'off' ? 'off' : 'on';

  try {
    const storedPreference = window.localStorage.getItem(storageKey);

    if (storedPreference === 'on' || storedPreference === 'off') {
      preference = storedPreference;
    }
  } catch {}

  const applyPreference = () => {
    const effectivePreference = reducedMotion.matches ? 'off' : preference;

    root.dataset.motion = effectivePreference;
    root.dataset.pageHidden = String(document.hidden);
    document.querySelectorAll('[data-motion-option]').forEach((option) => {
      option.checked = option.value === effectivePreference;
    });
  };

  document.addEventListener('change', (event) => {
    const option = event.target;

    if (
      !(option instanceof HTMLInputElement) ||
      !option.matches('[data-motion-option]')
    )
      return;

    preference = option.value;

    try {
      window.localStorage.setItem(storageKey, preference);
    } catch {}

    applyPreference();
  });

  document.addEventListener('visibilitychange', applyPreference);
  reducedMotion.addEventListener('change', applyPreference);
  document.addEventListener('lobby:navigate', applyPreference);
  applyPreference();
})();
