import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = await readFile('src/assets/js/language-switcher.js', 'utf8');

function harness({
  current = '',
  languages = ['pt-BR', 'en-US'],
  saved,
  blocked = false,
  unavailable = [],
  prefix = '/',
  page = '',
  suffix = '',
} = {}) {
  const routes = ['pt-br', 'zh', 'fr', 'es', 'it', 'en'].map((id) => {
    const home = `${prefix}${id}/`;

    return { id, home, url: unavailable.includes(id) ? '' : `${home}${page}` };
  });

  let url = new URL(
    `https://example.test${current ? routes.find((r) => r.id === current).url : prefix}${suffix}`,
  );

  const state = {
    saved,
    writes: [],
    replacements: [],
    assignments: [],
    cleanups: [],
  };

  const listeners = new Map();

  class HTMLSelectElement {
    constructor(id) {
      this.selectedOptions = [{ dataset: { language: id } }];
    }

    matches() {
      return true;
    }
  }

  runInNewContext(script, {
    URL,
    HTMLSelectElement,
    navigator: { languages },
    document: {
      currentScript: {
        dataset: {
          languageConfig: JSON.stringify({
            current,
            default: 'pt-br',
            neutral: !current,
            routes,
          }),
        },
      },
      addEventListener(name, callback) {
        listeners.set(name, callback);
      },
    },
    window: {
      localStorage: {
        getItem() {
          if (blocked) throw new Error('Storage blocked');

          return state.saved;
        },
        setItem(key, value) {
          if (blocked) throw new Error('Storage blocked');

          assert.equal(key, 'guesant-links-language');
          state.saved = value;
          state.writes.push(value);
        },
      },
      location: {
        get href() {
          return url.href;
        },
        get origin() {
          return url.origin;
        },
        get pathname() {
          return url.pathname;
        },
        replace(value) {
          state.replacements.push(value);
          url = new URL(value);
        },
        assign(value) {
          state.assignments.push(value);
          url = new URL(value);
        },
      },
      history: {
        replaceState(_state, _title, value) {
          state.cleanups.push(value);
          url = new URL(value);
        },
      },
    },
  });

  return {
    state,
    select: (id) =>
      listeners.get('change')({ target: new HTMLSelectElement(id) }),
  };
}

for (const [tag, expected] of [
  ['pt-PT', 'pt-br'],
  ['fr-CA', 'fr'],
  ['es-MX', 'es'],
  ['zh-TW', 'zh'],
  ['it-IT', 'it'],
  ['en-US', 'en'],
]) {
  test(`browser preference ${tag} resolves a supported locale`, () => {
    const { state } = harness({ languages: [tag] });

    assert.deepEqual(state.replacements, [`https://example.test/${expected}/`]);
    assert.deepEqual(state.writes, []);
  });
}

test('unsupported and absent preferences default to Portuguese', () => {
  for (const languages of [['de-DE', 'ru-RU'], []]) {
    assert.deepEqual(harness({ languages }).state.replacements, [
      'https://example.test/pt-br/',
    ]);
  }
});
test('ordered browser preferences skip unsupported languages', () => {
  assert.deepEqual(
    harness({ languages: ['de-DE', 'en-US', 'pt-BR'] }).state.replacements,
    ['https://example.test/en/'],
  );
});
test('first visits respect explicit locale prefixes', () => {
  for (const current of ['pt-br', 'zh', 'fr', 'es', 'it', 'en'])
    assert.deepEqual(harness({ current }).state.replacements, []);
});
test('a manual preference overrides browser language and URL locale', () => {
  for (const current of ['en', 'fr']) {
    assert.deepEqual(
      harness({ current, page: 'code/', languages: ['en-US'], saved: 'pt-br' })
        .state.replacements,
      ['https://example.test/pt-br/code/'],
    );
  }
});
test('invalid saved preferences cannot create arbitrary redirects', () => {
  assert.deepEqual(
    harness({ saved: 'https://evil.test/', languages: ['en'] }).state
      .replacements,
    ['https://example.test/en/'],
  );
});
test('matching locales never redirect again', () => {
  assert.deepEqual(
    harness({ current: 'pt-br', saved: 'pt-br' }).state.replacements,
    [],
  );
});
test('automatic redirects preserve query, fragment and installation prefix', () => {
  assert.deepEqual(
    harness({ prefix: '/prefix/', suffix: '?source=link#details' }).state
      .replacements,
    ['https://example.test/prefix/pt-br/?source=link#details'],
  );
});
test('missing page translations do not redirect visitors away from their content', () => {
  assert.deepEqual(
    harness({ current: 'en', page: 'now/', saved: 'fr', unavailable: ['fr'] })
      .state.replacements,
    [],
  );
});
test('manual selection persists a locale and the equivalent page', () => {
  const { state, select } = harness({
    current: 'pt-br',
    page: 'code/',
    suffix: '?source=link#details',
  });

  select('fr');
  assert.equal(state.saved, 'fr');
  assert.deepEqual(state.assignments, [
    'https://example.test/fr/code/?source=link#details',
  ]);
});
test('manual fallback to a locale home drops an unavailable page fragment', () => {
  const { state, select } = harness({
    current: 'pt-br',
    unavailable: ['fr'],
    suffix: '#now-context',
  });

  select('fr');
  assert.deepEqual(state.assignments, ['https://example.test/fr/']);
});
test('blocked storage keeps manual English selection explicit in the URL', () => {
  const { state, select } = harness({
    current: 'pt-br',
    page: 'code/',
    blocked: true,
  });

  select('en');
  assert.deepEqual(state.assignments, [
    'https://example.test/en/code/?lang=en',
  ]);
  assert.deepEqual(
    harness({ current: 'en', page: 'code/', blocked: true, suffix: '?lang=en' })
      .state.replacements,
    [],
  );
});
test('explicit query preferences are persisted and removed from the address', () => {
  const { state } = harness({ suffix: '?lang=en&source=link#details' });

  assert.equal(state.saved, 'en');
  assert.deepEqual(state.cleanups, [
    'https://example.test/?source=link#details',
  ]);
  assert.deepEqual(state.replacements, [
    'https://example.test/en/?source=link#details',
  ]);
});
test('unknown manual selections are ignored', () => {
  const { state, select } = harness({ current: 'pt-br' });

  select('unknown');
  assert.deepEqual(state.assignments, []);
  assert.deepEqual(state.writes, []);
});
