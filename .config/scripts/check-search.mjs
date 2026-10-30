import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { clientScript } from './client-source.mjs';

const context = {
  document: {
    querySelector: () => {
      return null;
    },
  },
};

runInNewContext(await clientScript('search'), context);

const items = [
  {
    id: 'one',
    title: 'Formação',
    summary: 'A public summary',
    tags: [
      'backend',
    ],
    metadata: {
      area: 'Computação',
    },
  },
  {
    id: 'two',
    title: 'Project',
    summary: 'Other',
    tags: [],
    metadata: {},
  },
];

test('search matches accents, case, tags, metadata and multiple terms', () => {
  for (const query of [
    'FORMACAO',
    'backend',
    'computacao',
    'public backend',
  ]) {
    assert.equal(context.lobbySearchItems(items, query)[0].id, 'one');
  }

  assert.equal(context.lobbySearchItems(items, 'backend missing').length, 0);
  assert.equal(context.lobbySearchItems(items, ' ').length, 0);
});
test('search returns every match without changing source records', () => {
  const many = Array.from(
    {
      length: 150,
    },
    (_, id) => {
      return {
        ...items[0],
        id,
      };
    },
  );

  assert.equal(context.lobbySearchItems(many, 'backend').length, 150);
  assert.equal(many.length, 150);
});
test('explicit list limits preserve totals and reject invalid limits', () => {
  const selection = context.lobbySelectList(items, 1);

  assert.equal(selection.shown, 1);
  assert.equal(selection.total, 2);
  assert.equal(selection.partial, true);
  assert.equal(items.length, 2);

  for (const limit of [
    undefined,
    0,
    2,
    10,
  ]) {
    const complete = context.lobbySelectList(items, limit);

    assert.equal(complete.shown, 2);
    assert.equal(complete.partial, false);
  }

  for (const limit of [
    -1,
    1.5,
    'invalid',
  ]) {
    assert.throws(() => {
      return context.lobbySelectList(items, limit);
    }, /List limit/);
  }
});

function searchHarness() {
  let activeElement;

  class Element {
    constructor() {
      this.children = [];
      this.listeners = new Map();
      this.attributes = {};
      this.value = '';
      this.hidden = false;
      this.disabled = false;
    }

    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }

    append(...children) {
      this.children.push(...children);
    }

    replaceChildren() {
      this.children = [];
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    focus() {
      activeElement = this;
    }

    showModal() {
      this.open = true;
    }

    closest(selector) {
      if (selector === '[data-search-open]') {
        return this;
      }

      return null;
    }
  }

  const query = new Element();

  const results = new Element();

  const status = new Element();

  const retry = new Element();

  const button = new Element();

  const dialog = new Element();

  const documentListeners = new Map();

  dialog.dataset = {
    searchIndex: '/search/pt-br-minecraft.json',
    searchLoading: 'Loading',
    searchStart: 'Start',
    searchUnavailable: 'Unavailable',
    searchEmpty: 'Empty',
    searchSource: 'Source',
    searchLanguage: 'Language',
    searchPartial: 'Showing {shown} of {total}',
  };
  dialog.querySelector = (selector) => {
    return {
      input: query,
      '#search-results': results,
      '#search-status': status,
      '[data-search-retry]': retry,
    }[selector];
  };

  const requests = [];

  runInNewContext(script, {
    Element,
    URL,
    location: new URL('https://guesant.net/pt-br/'),
    AbortSignal: {
      timeout(duration) {
        assert.equal(duration, 10000);

        return 'timeout-signal';
      },
    },
    document: {
      querySelector: (selector) => {
        if (
          selector === '#search-dialog' ||
          (selector === 'dialog[open]' && dialog.open)
        ) {
          return dialog;
        }

        return null;
      },
      querySelectorAll: () => {
        return [
          button,
        ];
      },
      createElement: () => {
        return new Element();
      },
      addEventListener(name, listener) {
        documentListeners.set(name, listener);
      },
      get activeElement() {
        return activeElement;
      },
    },
    fetch(url, options) {
      assert.equal(url, dialog.dataset.searchIndex);
      assert.equal(options.signal, 'timeout-signal');

      return new Promise((resolve, reject) => {
        return requests.push({
          resolve,
          reject,
        });
      });
    },
  });

  const flush = async () => {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
  };

  return {
    dialog,
    query,
    results,
    status,
    retry,
    requests,
    flush,
    open() {
      documentListeners.get('click')({
        target: new Element(),
      });
    },
    input(value) {
      query.value = value;
      query.listeners.get('input')();
    },
    retryLoad() {
      retry.listeners.get('click')();
    },
    resolve(value, ok = true) {
      requests.at(-1).resolve({
        ok,
        json: async () => {
          return value;
        },
      });
    },
  };
}

const script = await clientScript('search');

const searchEntry = {
  ...items[0],
  url: '/pt-br/career/',
  group: 'Pages',
  source: 'lobby',
  language: 'pt-br',
  type: 'link',
};

test('search renders and counts more than one hundred matches', async () => {
  const h = searchHarness();

  h.open();
  h.input('backend');
  h.resolve(
    Array.from(
      {
        length: 150,
      },
      (_, id) => {
        return {
          ...searchEntry,
          id: String(id),
        };
      },
    ),
  );
  await h.flush();
  assert.equal(h.status.textContent, '150');
  assert.equal(h.results.children[1].children.length, 150);
  assert.notEqual(
    h.results.children[1].children[0].children[0].target,
    '_blank',
  );
});
test('an explicit search limit reports the full matching count', async () => {
  const h = searchHarness();

  h.dialog.dataset.searchLimit = '2';
  h.open();
  h.input('backend');
  h.resolve([
    ...Array.from(
      {
        length: 3,
      },
      (_, id) => {
        return {
          ...searchEntry,
          id: String(id),
        };
      },
    ),
    {
      ...searchEntry,
      title: 'Other',
      summary: '',
      tags: [],
      metadata: {},
    },
  ]);
  await h.flush();
  assert.equal(h.status.textContent, 'Showing 2 of 3');
  assert.equal(h.results.children[1].children.length, 2);
});
test('project search results keep the repository and curriculum as independent links', async () => {
  const h = searchHarness();

  h.open();
  h.input('backend');
  h.resolve([
    {
      ...searchEntry,
      url: 'https://curriculum.guesant.net/en/#project-one',
      details_url: 'https://github.com/guesant/ava-pro',
      details_label: 'View on GitHub',
    },
  ]);
  await h.flush();

  const row = h.results.children[1].children[0];

  assert.equal(
    row.children[0].href,
    'https://curriculum.guesant.net/en/#project-one',
  );
  assert.equal(row.children[0].target, '_blank');
  assert.equal(row.children[0].rel, 'noopener noreferrer');
  assert.equal(row.children[0].children[0].attributes['aria-hidden'], 'true');
  assert.equal(row.children[0].children[0].textContent, ' ↗');
  assert.equal(row.children[2].href, 'https://github.com/guesant/ava-pro');
  assert.equal(row.children[2].textContent, 'View on GitHub');
  assert.equal(row.children[2].target, '_blank');
  assert.equal(row.children[2].rel, 'noopener noreferrer');
});
test('search shows loading rather than no results while preparing its index', async () => {
  const h = searchHarness();

  h.open();
  assert.equal(h.status.textContent, 'Loading');
  assert.equal(h.results.attributes['aria-busy'], 'true');
  h.input('backend');
  assert.equal(h.status.textContent, 'Loading');
  h.resolve([
    searchEntry,
  ]);
  await h.flush();
  assert.equal(h.status.textContent, '1');
  assert.equal(h.results.attributes['aria-busy'], 'false');
  assert.equal(h.retry.hidden, true);
});
test('search keeps failure visible while editing and retries without losing the query', async () => {
  const h = searchHarness();

  h.open();
  h.input('backend');
  h.requests[0].reject(new Error('Offline'));
  await h.flush();
  assert.equal(h.status.textContent, 'Unavailable');
  assert.equal(h.retry.hidden, false);
  h.input('formacao');
  assert.equal(h.status.textContent, 'Unavailable');
  h.retryLoad();
  h.retryLoad();
  assert.equal(h.requests.length, 2);
  assert.equal(h.status.textContent, 'Loading');
  assert.equal(h.query.value, 'formacao');
  h.resolve([
    searchEntry,
  ]);
  await h.flush();
  assert.equal(h.status.textContent, '1');
  assert.equal(h.retry.hidden, true);
});
test('search handles empty indexes, malformed indexes and HTTP failures distinctly', async () => {
  for (const [
    value,
    ok,
    expected,
  ] of [
    [
      [],
      true,
      'Empty',
    ],
    [
      {},
      true,
      'Unavailable',
    ],
    [
      [
        null,
      ],
      true,
      'Unavailable',
    ],
    [
      [],
      false,
      'Unavailable',
    ],
  ]) {
    const h = searchHarness();

    h.open();
    h.input('anything');
    h.resolve(value, ok);
    await h.flush();
    assert.equal(h.status.textContent, expected);
    assert.equal(h.retry.hidden, expected !== 'Unavailable');
  }
});
test('search settles closed requests and reopens without fetching a ready index again', async () => {
  const h = searchHarness();

  h.open();
  h.dialog.open = false;
  h.resolve([
    searchEntry,
  ]);
  await h.flush();
  h.open();
  assert.equal(h.requests.length, 1);
  assert.equal(h.status.textContent, 'Start');
  assert.equal(h.results.attributes['aria-busy'], 'false');
});
