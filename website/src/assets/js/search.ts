type SearchItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  group: string;
  source: string;
  language: string;
  type: string;
  tags: string[];
  metadata?: Record<string, string | number | boolean | string[]>;
  details_url?: string;
  details_label?: string;
};

function lobbySearchLink(href: string, title: string): HTMLAnchorElement {
  const link: HTMLAnchorElement = document.createElement('a');

  const url: URL = new URL(href, location.href);

  link.href = href;
  link.textContent = title;

  if (
    [
      'http:',
      'https:',
    ].includes(url.protocol) &&
    url.origin !== location.origin
  ) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const indicator: HTMLSpanElement = document.createElement('span');

    indicator.className = 'external-navigation-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = ' ↗';
    link.append(indicator);
  }

  return link;
}

function lobbySelectList(items: SearchItem[], limit: number | string = 0) {
  limit = Number(limit);

  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError('List limit must be a nonnegative integer');
  }

  const total = items.length;

  const resolveSelected = () => {
    if (limit) {
      return items.slice(0, limit);
    }

    return items;
  };

  const selected = resolveSelected();

  return {
    items: selected,
    total,
    shown: selected.length,
    partial: selected.length < total,
  };
}

function lobbySearchItems(index: SearchItem[], query: string) {
  const normalize = (value: string) => {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  };

  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);

  if (!terms.length) {
    return [];
  }

  return index.filter((item: SearchItem) => {
    const haystack = normalize(
      [
        item.title,
        item.summary,
        ...(item.tags || []),
        ...Object.values(item.metadata || {}).map(String),
      ].join(' '),
    );

    return terms.every((term: string) => {
      return haystack.includes(term);
    });
  });
}

function isSearchItem(value: unknown): value is SearchItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const item = value as Record<string, unknown>;

  const requiredFields = [
    'id',
    'title',
    'summary',
    'url',
    'group',
    'source',
    'language',
    'type',
  ];

  if (
    !requiredFields.every((key) => {
      return typeof item[key] === 'string';
    })
  ) {
    return false;
  }

  if (
    !Array.isArray(item.tags) ||
    !item.tags.every((tag) => {
      return typeof tag === 'string';
    })
  ) {
    return false;
  }

  if (item.details_url !== undefined && typeof item.details_url !== 'string') {
    return false;
  }

  if (
    item.details_label !== undefined &&
    typeof item.details_label !== 'string'
  ) {
    return false;
  }

  if (item.details_url && !item.details_label) {
    return false;
  }

  if (item.metadata !== undefined) {
    if (
      !item.metadata ||
      typeof item.metadata !== 'object' ||
      Array.isArray(item.metadata)
    ) {
      return false;
    }

    if (
      !Object.values(item.metadata).every((entry) => {
        return (
          typeof entry === 'string' ||
          typeof entry === 'number' ||
          typeof entry === 'boolean' ||
          (Array.isArray(entry) &&
            entry.every((tag) => {
              return typeof tag === 'string';
            }))
        );
      })
    ) {
      return false;
    }
  }

  return true;
}

(() => {
  let currentOpen: () => void = () => {};

  const initialized = new WeakSet();

  function initialize() {
    const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');

    if (!dialog || initialized.has(dialog)) {
      return;
    }

    initialized.add(dialog);

    const query = dialog.querySelector<HTMLInputElement>('input');

    const results = dialog.querySelector<HTMLElement>('#search-results');

    const status = dialog.querySelector<HTMLElement>('#search-status');

    const retry = dialog.querySelector<HTMLButtonElement>(
      '[data-search-retry]',
    );

    if (!query || !results || !status || !retry) {
      return;
    }

    const searchDialog = dialog;

    const searchQuery = query;

    const searchResults = results;

    const searchStatus = status;

    const searchRetry = retry;

    let index: SearchItem[] = [];

    let state: 'idle' | 'loading' | 'error' | 'ready' = 'idle';

    function render() {
      searchResults.replaceChildren();
      searchResults.setAttribute('aria-busy', String(state === 'loading'));
      searchRetry.hidden = state !== 'error';
      searchRetry.disabled = state === 'loading';

      if (state === 'loading') {
        searchStatus.textContent = searchDialog.dataset.searchLoading || '';

        return;
      }

      if (state === 'error') {
        searchStatus.textContent = searchDialog.dataset.searchUnavailable || '';

        return;
      }

      if (!searchQuery.value.trim()) {
        searchStatus.textContent = searchDialog.dataset.searchStart || '';

        return;
      }

      const selection = lobbySelectList(
        lobbySearchItems(index, searchQuery.value),
        searchDialog.dataset.searchLimit || 0,
      );

      const resultCountLabel = () => {
        if (selection.partial) {
          return (searchDialog.dataset.searchPartial || '{shown} of {total}')
            .replaceAll('{shown}', String(selection.shown))
            .replaceAll('{total}', String(selection.total));
        }

        if (selection.total) {
          return String(selection.total);
        }

        return searchDialog.dataset.searchEmpty || '';
      };

      searchStatus.textContent = resultCountLabel();

      const groups = new Map<string, HTMLUListElement>();

      for (const item of selection.items) {
        let list = groups.get(item.group);

        if (!list) {
          const heading = document.createElement('h3');

          heading.textContent = item.group;
          list = document.createElement('ul');
          searchResults.append(heading, list);
          groups.set(item.group, list);
        }

        const row = document.createElement('li');

        const link = lobbySearchLink(item.url, item.title);

        const meta = document.createElement('small');

        meta.textContent = `${searchDialog.dataset.searchSource || ''}: ${item.source} · ${searchDialog.dataset.searchLanguage || ''}: ${item.language}`;
        row.append(link, meta);

        if (item.details_url) {
          const detailsLabel = item.details_label || item.title;

          const details = lobbySearchLink(item.details_url, detailsLabel);

          details.setAttribute('aria-label', `${detailsLabel}: ${item.title}`);
          details.className = 'editorial-details';
          row.append(details);
        }

        list.append(row);
      }
    }

    async function load() {
      if (state === 'loading') {
        return;
      }

      state = 'loading';
      render();

      try {
        const response = await fetch(searchDialog.dataset.searchIndex || '', {
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error('Search unavailable');
        }

        const payload: unknown = await response.json();

        if (!Array.isArray(payload) || !payload.every(isSearchItem)) {
          throw new Error('Invalid search index');
        }

        index = payload;
        state = 'ready';

        if (searchDialog.open) {
          render();
        }
      } catch {
        state = 'error';

        if (searchDialog.open) {
          render();
        }
      }
    }

    function open() {
      if (searchDialog.open) {
        return;
      }

      searchDialog.showModal();
      searchQuery.focus();

      if (state === 'idle') {
        void load();
      } else {
        render();
      }
    }

    currentOpen = open;
    searchRetry.addEventListener('click', () => {
      searchQuery.focus();
      void load();
    });
    searchQuery.addEventListener('input', render);
    searchQuery.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown') {
        return;
      }

      const first = searchResults.querySelector<HTMLAnchorElement>('a');

      if (first) {
        event.preventDefault();
        first.focus();
      }
    });
    searchResults.addEventListener('keydown', (event) => {
      if (
        ![
          'ArrowDown',
          'ArrowUp',
        ].includes(event.key)
      ) {
        return;
      }

      const links = [
        ...searchResults.querySelectorAll<HTMLAnchorElement>('a'),
      ];

      const resolvePosition = () => {
        if (document.activeElement instanceof HTMLAnchorElement) {
          return links.indexOf(document.activeElement);
        }

        return -1;
      };

      const position = resolvePosition();

      if (position < 0) {
        return;
      }

      event.preventDefault();

      if (event.key === 'ArrowUp' && position === 0) {
        searchQuery.focus();
      } else {
        const navigationStep = () => {
          if (event.key === 'ArrowDown') {
            return 1;
          }

          return -1;
        };

        links[
          Math.max(0, Math.min(links.length - 1, position + navigationStep()))
        ]?.focus();
      }
    });
  }

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('lobby:navigate', initialize);
    document.addEventListener('click', (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-search-open]')
      ) {
        initialize();
        currentOpen();
      }
    });
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();

        if (
          !document.querySelector<HTMLDialogElement>('dialog[open]') ||
          document.querySelector<HTMLDialogElement>('#search-dialog')?.open
        ) {
          initialize();
          currentOpen();
        }
      }
    });
  }

  initialize();
})();
