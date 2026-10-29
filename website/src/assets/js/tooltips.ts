(() => {
  const controlFor = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) {
      return null;
    }

    const control = target.closest<HTMLElement>('[data-tooltip]');

    if (control) {
      return control;
    }

    if (!target.matches('[data-link-view-control]')) {
      return null;
    }

    if (!(target.nextElementSibling instanceof HTMLElement)) {
      return null;
    }

    return target.nextElementSibling;
  };

  const positionTooltip = (control: HTMLElement) => {
    const tooltip = control.querySelector<HTMLElement>('.control-tooltip');

    if (!tooltip) {
      return;
    }

    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';

    const rect = tooltip.getBoundingClientRect();

    const gutter =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--page-gutter',
        ),
      ) || 0;

    const resolveShift = () => {
      if (rect.left < gutter) {
        return gutter - rect.left;
      }

      if (rect.right > innerWidth - gutter) {
        return innerWidth - gutter - rect.right;
      }

      return 0;
    };

    const shift = resolveShift();

    tooltip.style.setProperty('--tooltip-shift', `${shift}px`);
    tooltip.style.removeProperty('display');
    tooltip.style.removeProperty('visibility');
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    document
      .querySelectorAll<HTMLElement>('[data-tooltip]')
      .forEach((control) => {
        control.dataset.tooltipDismissed = 'true';
      });
  });
  document.addEventListener('pointerover', (event) => {
    const control = controlFor(event.target);

    if (control && !control.contains(event.relatedTarget as Node | null)) {
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
