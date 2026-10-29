(() => {
  const root = document.documentElement;

  const interfaces = new Set(['minecraft', 'terminal']);

  const selected = root.dataset.interface;

  if (!selected || !interfaces.has(selected)) {
    root.dataset.interface = 'minecraft';
  }

  root.dataset.interfaceReady = 'true';

  const url = new URL(location.href);

  const reboot = url.searchParams.get('lobby-boot') === '1';

  if (reboot) {
    url.searchParams.delete('lobby-boot');
    history.replaceState(null, '', url.href);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bios = document.querySelector<HTMLDialogElement>('#bios-dialog');

    let timer: ReturnType<typeof setTimeout> | undefined;

    let previous: HTMLElement | null = null;

    let bootStep = 0;

    const reduced = () => {
      return (
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        root.dataset.motion === 'off'
      );
    };

    function finish() {
      clearTimeout(timer);
      timer = undefined;

      if (bios?.open) {
        bios.close();
      }

      if (previous?.isConnected && !previous.closest('dialog:not([open])')) {
        previous.focus();
      } else if (previous) {
        document.querySelector<HTMLElement>('.navigation-home')?.focus();
      }

      previous = null;
    }

    function boot() {
      if (!bios || reduced() || typeof bios.showModal !== 'function') {
        return;
      }

      const biosDialog = bios;

      const activeElementForBoot = () => {
        if (document.activeElement instanceof HTMLElement) {
          return document.activeElement;
        }

        return null;
      };

      previous = activeElementForBoot();

      for (const dialog of document.querySelectorAll<HTMLDialogElement>(
        'dialog[open]',
      )) {
        if (dialog !== bios) {
          dialog.close();
        }
      }

      clearTimeout(timer);

      const interfaceLine = biosDialog.querySelector<HTMLElement>(
        '[data-bios-interface]',
      );

      const bootLine = biosDialog.querySelector<HTMLElement>(
        '[data-bios-boot-line]',
      );

      const progress = biosDialog.querySelector<HTMLElement>(
        '[data-bios-progress]',
      );

      if (!interfaceLine || !bootLine || !progress) {
        return;
      }

      const bootLineElement = bootLine;

      const progressElement = progress;

      const interfaceBootLabel = () => {
        if (root.dataset.interface === 'terminal') {
          return 'TEXT_INTERFACE';
        }

        return 'GRAPHICAL_INTERFACE';
      };

      interfaceLine.textContent = interfaceBootLabel();
      bootStep = 0;

      for (const line of biosDialog.querySelectorAll<HTMLElement>(
        '[data-bios-step]',
      )) {
        line.hidden = true;
      }

      bootLineElement.hidden = true;
      progressElement.textContent = '▓▒░';
      biosDialog.showModal();

      function advance() {
        bootStep++;

        for (const line of biosDialog.querySelectorAll<HTMLElement>(
          '[data-bios-step]',
        )) {
          if (bootStep >= Number(line.dataset.biosStep)) {
            line.hidden = false;
          }
        }

        if (bootStep >= 19) {
          bootLineElement.hidden = false;

          const blocks = Math.max(0, Math.min(10, bootStep - 19));

          const remainingBootProgress = () => {
            if (blocks < 10) {
              return '▓▒░'.slice(0, 10 - blocks);
            }

            return '';
          };

          progressElement.textContent =
            '█'.repeat(blocks) + remainingBootProgress();
        }

        if (bootStep >= 31) {
          finish();
        } else {
          timer = setTimeout(advance, 80);
        }
      }

      timer = setTimeout(advance, 80);
    }

    function sync() {
      for (const option of document.querySelectorAll<HTMLInputElement>(
        '[data-interface-option]',
      )) {
        option.checked = option.value === root.dataset.interface;
      }
    }

    sync();
    document.addEventListener('change', (event: Event) => {
      const option = event.target;

      if (
        !(option instanceof HTMLInputElement) ||
        !option.matches('[data-interface-option]') ||
        !option.checked ||
        !interfaces.has(option.value)
      ) {
        return;
      }

      const destination = option.dataset.interfaceUrl;

      if (!destination || option.value === root.dataset.interface) {
        return;
      }

      const target = new URL(destination, location.href);

      const current = new URL(location.href);

      target.search = current.search;
      target.hash = current.hash;

      if (option.value === 'terminal') {
        target.searchParams.set('lobby-boot', '1');
      } else {
        target.searchParams.delete('lobby-boot');
      }

      location.assign(target.href);
    });
    bios?.querySelector('[data-bios-skip]')?.addEventListener('click', finish);
    bios?.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish();
    });
    document.addEventListener('change', () => {
      if (bios?.open && reduced()) {
        finish();
      }
    });
    document.addEventListener('click', (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest('[data-reboot]');

      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();

      const target = new URL(location.href);

      target.searchParams.set('lobby-boot', '1');
      location.assign(target.href);
    });

    if (reboot) {
      boot();
    }
  });
})();
