(() => {
  const root = document.documentElement;

  const storageKey = 'guesant-links-motion';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const resolvePreference = () => {
    if (root.dataset.motion === 'off') {
      return 'off';
    }

    return 'on';
  };

  let preference = resolvePreference();

  let landscapeRequest = 0;

  let prepared:
    { element: HTMLElement; preview: string; final: string } | undefined;

  const decoded = new Map<string, Promise<void>>();

  const unchangedLandscape = (
    element: HTMLElement,
    preview: string,
    final: string,
  ): boolean => {
    return (
      prepared?.element === element &&
      prepared.preview === preview &&
      prepared.final === final
    );
  };

  const backgroundURL = (background: string): string => {
    return background.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || '';
  };

  const decodeImage = async (
    source: string,
    priority?: 'high' | 'low',
  ): Promise<void> => {
    const pending = decoded.get(source);

    if (pending) {
      return pending;
    }

    const loading = (async () => {
      const image = new Image();

      if (priority) {
        image.fetchPriority = priority;
      }

      image.src = source;
      await image.decode();
    })();

    decoded.set(source, loading);

    try {
      await loading;
    } catch (error) {
      decoded.delete(source);

      throw error;
    }
  };

  const prepareLandscape = async (): Promise<void> => {
    const finalLandscape =
      document.querySelector<HTMLElement>('.world-landscape');

    const previewLandscape = document.querySelector<HTMLElement>(
      '.world-landscape-preview',
    );

    if (
      !finalLandscape ||
      !previewLandscape ||
      !root.hasAttribute('data-js-enabled')
    ) {
      return;
    }

    const styles = getComputedStyle(root);

    const previewSource = backgroundURL(
      styles.getPropertyValue('--landscape-preview'),
    );

    const finalSource = backgroundURL(
      styles.getPropertyValue('--landscape-image'),
    );

    if (!previewSource || !finalSource) {
      return;
    }

    if (unchangedLandscape(finalLandscape, previewSource, finalSource)) {
      return;
    }

    prepared = {
      element: finalLandscape,
      preview: previewSource,
      final: finalSource,
    };

    const request = ++landscapeRequest;

    root.removeAttribute('data-landscape-ready');
    root.removeAttribute('data-landscape-preview-failed');
    finalLandscape.style.backgroundImage = 'none';

    try {
      await decodeImage(previewSource);
    } catch {
      if (request === landscapeRequest) {
        finalLandscape.style.backgroundImage = `url("${finalSource}")`;
        root.dataset.landscapePreviewFailed = 'true';
      }

      return;
    }

    if (request !== landscapeRequest) {
      return;
    }

    try {
      await decodeImage(finalSource, 'low');
    } catch {
      if (request === landscapeRequest) {
        prepared = undefined;
      }

      return;
    }

    if (
      request === landscapeRequest &&
      finalSource ===
        backgroundURL(
          getComputedStyle(root).getPropertyValue('--landscape-image'),
        ) &&
      previewSource ===
        backgroundURL(
          getComputedStyle(root).getPropertyValue('--landscape-preview'),
        )
    ) {
      finalLandscape.style.backgroundImage = `url("${finalSource}")`;
      root.dataset.landscapeReady = 'true';
    }
  };

  const sceneThemeObserver = new MutationObserver(() => {
    void prepareLandscape();
  });

  sceneThemeObserver.observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const sceneColorScheme = window.matchMedia('(prefers-color-scheme: light)');

  sceneColorScheme.addEventListener('change', () => {
    return void prepareLandscape();
  });
  window.addEventListener(
    'resize',
    () => {
      return void prepareLandscape();
    },
    {
      passive: true,
    },
  );
  document.addEventListener('lobby:navigate', () => {
    void prepareLandscape();
  });
  void prepareLandscape();

  try {
    const storedPreference = window.localStorage.getItem(storageKey);

    if (storedPreference === 'on' || storedPreference === 'off') {
      preference = storedPreference;
    }
  } catch {}

  const applyPreference = () => {
    const resolveEffectivePreference = () => {
      if (reducedMotion.matches) {
        return 'off';
      }

      return preference;
    };

    const effectivePreference = resolveEffectivePreference();

    root.dataset.motion = effectivePreference;
    root.dataset.pageHidden = String(document.hidden);
    document
      .querySelectorAll<HTMLInputElement>('[data-motion-option]')
      .forEach((option) => {
        option.checked = option.value === effectivePreference;
      });
  };

  document.addEventListener('change', (event) => {
    const option = event.target;

    if (
      !(option instanceof HTMLInputElement) ||
      !option.matches('[data-motion-option]')
    ) {
      return;
    }

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
