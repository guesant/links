(() => {
  const controlFor = (target) => {
    if (!(target instanceof Element)) return null;

    return (
      target.closest('[data-tooltip]') ||
      (target.matches('[data-link-view-control]')
        ? target.nextElementSibling
        : null)
    );
  };

  const positionTooltip = (control) => {
    const tooltip = control.querySelector('.control-tooltip');

    if (!tooltip) return;

    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';

    const rect = tooltip.getBoundingClientRect();

    const gutter =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--page-gutter',
        ),
      ) || 0;

    const shift =
      rect.left < gutter
        ? gutter - rect.left
        : rect.right > innerWidth - gutter
          ? innerWidth - gutter - rect.right
          : 0;

    tooltip.style.setProperty('--tooltip-shift', `${shift}px`);
    tooltip.style.removeProperty('display');
    tooltip.style.removeProperty('visibility');
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    document.querySelectorAll('[data-tooltip]').forEach((control) => {
      control.dataset.tooltipDismissed = 'true';
    });
  });
  document.addEventListener('pointerover', (event) => {
    const control = controlFor(event.target);

    if (control && !control.contains(event.relatedTarget)) {
      delete control.dataset.tooltipDismissed;
      positionTooltip(control);
    }
  });
  document.addEventListener('focusin', (event) => {
    const control = controlFor(event.target);

    if (control) {
      delete control.dataset.tooltipDismissed;
      positionTooltip(control);
    }
  });
})();
