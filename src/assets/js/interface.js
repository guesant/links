(() => {
  const root = document.documentElement;

  const interfaces = new Set(['minecraft', 'terminal']);

  const selected = root.dataset.interface;

  if (!interfaces.has(selected)) root.dataset.interface = 'minecraft';

  root.dataset.interfaceReady = 'true';

  const url = new URL(location.href);

  const reboot = url.searchParams.get('lobby-boot') === '1';

  if (reboot) {
    url.searchParams.delete('lobby-boot');
    history.replaceState(null, '', url.href);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bios = document.querySelector('#bios-dialog');

    let timer;

    let previous;

    let bootStep = 0;

    const reduced = () =>
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      root.dataset.motion === 'off';

    function finish() {
      clearTimeout(timer);
      timer = undefined;

      if (bios?.open) bios.close();

      if (previous?.isConnected && !previous.closest('dialog:not([open])'))
        previous.focus();
      else if (previous) document.querySelector('.navigation-home')?.focus();

      previous = undefined;
    }

    function boot() {
      if (!bios || reduced() || typeof bios.showModal !== 'function') return;

      previous = document.activeElement;

      for (const dialog of document.querySelectorAll('dialog[open]'))
        if (dialog !== bios) dialog.close();

      clearTimeout(timer);
      bios.querySelector('[data-bios-interface]').textContent =
        root.dataset.interface === 'terminal'
          ? 'TEXT_INTERFACE'
          : 'GRAPHICAL_INTERFACE';
      bootStep = 0;

      for (const line of bios.querySelectorAll('[data-bios-step]'))
        line.hidden = true;

      bios.querySelector('[data-bios-boot-line]').hidden = true;
      bios.querySelector('[data-bios-progress]').textContent = '▓▒░';
      bios.showModal();

      function advance() {
        bootStep++;

        for (const line of bios.querySelectorAll('[data-bios-step]'))
          if (bootStep >= Number(line.dataset.biosStep)) line.hidden = false;

        const bootLine = bios.querySelector('[data-bios-boot-line]');

        if (bootStep >= 19) {
          bootLine.hidden = false;

          const blocks = Math.max(0, Math.min(10, bootStep - 19));

          bios.querySelector('[data-bios-progress]').textContent =
            '█'.repeat(blocks) +
            (blocks < 10 ? '▓▒░'.slice(0, 10 - blocks) : '');
        }

        if (bootStep >= 31) finish();
        else timer = setTimeout(advance, 80);
      }

      timer = setTimeout(advance, 80);
    }

    function sync() {
      for (const option of document.querySelectorAll('[data-interface-option]'))
        option.checked = option.value === root.dataset.interface;
    }

    sync();
    document.addEventListener('change', (event) => {
      const option = event.target;

      if (
        !(option instanceof HTMLInputElement) ||
        !option.matches('[data-interface-option]') ||
        !option.checked ||
        !interfaces.has(option.value)
      )
        return;

      const destination = option.dataset.interfaceUrl;

      if (!destination || option.value === root.dataset.interface) return;

      const target = new URL(destination, location.href);

      const current = new URL(location.href);

      target.search = current.search;
      target.hash = current.hash;

      if (option.value === 'terminal')
        target.searchParams.set('lobby-boot', '1');
      else target.searchParams.delete('lobby-boot');

      location.assign(target.href);
    });
    bios?.querySelector('[data-bios-skip]')?.addEventListener('click', finish);
    bios?.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish();
    });
    document.addEventListener('change', () => {
      if (bios?.open && reduced()) finish();
    });
    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('[data-reboot]');

      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      event.preventDefault();

      const target = new URL(location.href);

      target.searchParams.set('lobby-boot', '1');
      location.assign(target.href);
    });

    if (reboot) boot();
  });
})();
