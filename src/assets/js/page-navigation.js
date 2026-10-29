(() => {
  const getSwitcher = () => document.querySelector('[data-section-switcher]');

  const position = () => {
    const switcher = getSwitcher();

    if (!(switcher instanceof HTMLDetailsElement) || !switcher.open) return;

    const trigger = switcher.querySelector('summary');

    const panel = switcher.querySelector('.section-menu');

    const rect = switcher.closest('.page-navigation').getBoundingClientRect();

    const gap = parseFloat(getComputedStyle(panel).marginBlockStart);

    const below = window.innerHeight - rect.bottom - gap * 2;

    const above = rect.top - gap * 2;

    const minimum = parseFloat(getComputedStyle(trigger).minHeight) * 3;

    const upwards = below < Math.min(minimum, above);

    switcher.dataset.placement = upwards ? 'above' : 'below';
    switcher.style.setProperty(
      '--navigation-available-height',
      `${Math.max(0, upwards ? above : below)}px`,
    );
  };

  document.addEventListener(
    'toggle',
    (event) => {
      if (event.target.matches?.('[data-section-switcher]')) position();
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    const switcher = getSwitcher();

    if (event.key !== 'Escape' || !switcher?.open) return;

    event.preventDefault();
    switcher.open = false;
    switcher.querySelector('summary')?.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (event) => {
    const switcher = getSwitcher();

    if (!switcher?.open || switcher.contains(event.target)) return;

    const restoreFocus = switcher.contains(document.activeElement);

    switcher.open = false;

    if (restoreFocus)
      switcher.querySelector('summary')?.focus({ preventScroll: true });
  });
  document.addEventListener('focusin', (event) => {
    const switcher = getSwitcher();

    if (switcher?.open && !switcher.contains(event.target))
      switcher.open = false;
  });
  window.addEventListener('resize', position);
  document.addEventListener('scroll', position, {
    passive: true,
    capture: true,
  });
  document.addEventListener('lobby:navigate', position);
})();
