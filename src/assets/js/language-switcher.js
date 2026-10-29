(() => {
  const raw = document.currentScript?.dataset.languageConfig;

  if (!raw) return;

  let config;

  try {
    config = JSON.parse(raw);
  } catch {
    return;
  }

  const routes = config.routes;

  if (!Array.isArray(routes)) return;

  const storageKey = 'guesant-links-language';

  const language = (id) => routes.find((route) => route.id === id);

  const remember = (id) => {
    try {
      window.localStorage.setItem(storageKey, id);

      return window.localStorage.getItem(storageKey) === id;
    } catch {
      return false;
    }
  };

  let saved;

  try {
    saved = language(window.localStorage.getItem(storageKey));
  } catch {}

  const currentURL = new URL(window.location.href);

  const explicit = language(currentURL.searchParams.get('lang'));

  if (explicit && remember(explicit.id)) {
    currentURL.searchParams.delete('lang');
    window.history.replaceState(null, '', currentURL.href);
  }

  const preferred = () => {
    for (const tag of navigator.languages || [navigator.language]) {
      if (typeof tag !== 'string') continue;

      const normalized = tag.toLowerCase().replaceAll('_', '-');

      const match =
        language(normalized) ||
        routes.find(
          (route) => route.id.split('-')[0] === normalized.split('-')[0],
        );

      if (match) return match;
    }

    return language(config.default);
  };

  const destination = (route, manual = false) => {
    const path = route.url || (manual ? route.home : '');

    if (!path) return null;

    const url = new URL(path, window.location.href);

    if (url.origin !== window.location.origin) return null;

    const source = new URL(window.location.href);

    url.search = source.search;

    if (route.url) url.hash = source.hash;

    return url;
  };

  const selected = explicit || saved || (config.neutral ? preferred() : null);

  if (selected && selected.id !== config.current) {
    const url = destination(selected);

    if (url && url.pathname !== window.location.pathname)
      window.location.replace(url.href);
  }

  document.addEventListener('change', (event) => {
    if (
      event.target instanceof HTMLSelectElement &&
      event.target.matches('[data-language-switcher]')
    ) {
      const selectedOption = event.target.selectedOptions[0];

      const route = language(selectedOption?.dataset.language);

      if (!route) return;

      const url = selectedOption?.value
        ? new URL(selectedOption.value, window.location.href)
        : destination(route, true);

      if (!url) return;

      const source = new URL(window.location.href);

      if (url.origin !== window.location.origin) return;

      url.search = source.search;
      url.hash = route.url ? source.hash : '';

      if (remember(route.id)) url.searchParams.delete('lang');
      else url.searchParams.set('lang', route.id);

      window.location.assign(url.href);
    }
  });
})();
