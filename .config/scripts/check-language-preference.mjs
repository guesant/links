import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLanguageNavigation,
  languageStorageKey,
} from '../../website/src/lib/language-navigation.ts';
import { languageDestination } from '../../website/src/lib/language-preference.ts';

async function harness({
  current = '',
  languages = [
    'pt-BR',
    'en-US',
  ],
  saved = null,
  blocked = false,
  unavailable = [],
  prefix = '/',
  page = '',
  suffix = '',
  failure = false,
} = {}) {
  const routes = [
    'pt-br',
    'zh',
    'fr',
    'es',
    'it',
    'en',
  ].map((id) => {
    const home = `${prefix}${id}/`;

    const resolveUrl = () => {
      if (unavailable.includes(id)) {
        return '';
      }

      return `${home}${page}`;
    };

    return {
      id,
      home,
      url: resolveUrl(),
    };
  });

  const context = {
    current,
    default: 'pt-br',
    neutral: !current,
    routes,
  };

  const resolveUrl1 = () => {
    if (current) {
      return routes.find((route) => {
        return route.id === current;
      }).url;
    }

    return prefix;
  };

  let url = new URL(`https://example.test${resolveUrl1()}${suffix}`);

  const state = {
    saved,
    writes: [],
    replacements: [],
    cleanups: [],
    fallbacks: [],
  };

  const controller = createLanguageNavigation({
    page: () => {
      return {
        context,
        url,
      };
    },
    languages: () => {
      return languages;
    },
    storage: () => {
      if (blocked) {
        throw new Error('Storage blocked');
      }

      return {
        getItem: () => {
          return state.saved;
        },
        setItem: (key, value) => {
          assert.equal(key, languageStorageKey);
          state.saved = value;
          state.writes.push(value);
        },
      };
    },
    navigate: async (target) => {
      if (failure) {
        throw new Error('Navigation failed');
      }

      state.replacements.push(target.href);
      url = new URL(target);
      context.current =
        routes.find((route) => {
          return url.pathname.startsWith(route.home);
        })?.id || '';
      context.neutral = false;
    },
    replaceURL: (target) => {
      state.cleanups.push(target.href);
      url = new URL(target);
    },
    fallback: (target) => {
      state.fallbacks.push(target.href);
    },
  });

  await controller.normalize();

  return {
    state,
    controller,
  };
}

for (const [
  tag,
  expected,
] of [
  [
    'pt-PT',
    'pt-br',
  ],
  [
    'fr-CA',
    'fr',
  ],
  [
    'es-MX',
    'es',
  ],
  [
    'zh-TW',
    'zh',
  ],
  [
    'it-IT',
    'it',
  ],
  [
    'en-US',
    'en',
  ],
]) {
  test(`browser preference ${tag} resolves a supported locale`, async () => {
    const { state, controller } = await harness({
      languages: [
        tag,
      ],
    });

    assert.deepEqual(state.replacements, [
      `https://example.test/${expected}/`,
    ]);
    assert.deepEqual(state.writes, []);
    await controller.normalize();
    assert.equal(state.replacements.length, 1);
  });
}

test('unsupported and absent preferences default to Portuguese', async () => {
  for (const languages of [
    [
      'de-DE',
      'ru-RU',
    ],
    [],
  ]) {
    assert.deepEqual(
      (
        await harness({
          languages,
        })
      ).state.replacements,
      [
        'https://example.test/pt-br/',
      ],
    );
  }
});
test('ordered browser preferences skip unsupported languages', async () => {
  assert.deepEqual(
    (
      await harness({
        languages: [
          'de-DE',
          'en-US',
          'pt-BR',
        ],
      })
    ).state.replacements,
    [
      'https://example.test/en/',
    ],
  );
});
test('first visits respect explicit locale prefixes', async () => {
  for (const current of [
    'pt-br',
    'zh',
    'fr',
    'es',
    'it',
    'en',
  ]) {
    assert.deepEqual(
      (
        await harness({
          current,
        })
      ).state.replacements,
      [],
    );
  }
});
test('a manual preference overrides browser language and URL locale', async () => {
  for (const current of [
    'en',
    'fr',
  ]) {
    assert.deepEqual(
      (
        await harness({
          current,
          page: 'code/',
          languages: [
            'en-US',
          ],
          saved: 'pt-br',
        })
      ).state.replacements,
      [
        'https://example.test/pt-br/code/',
      ],
    );
  }
});
test('invalid saved preferences cannot create arbitrary redirects', async () => {
  assert.deepEqual(
    (
      await harness({
        saved: 'https://evil.test/',
        languages: [
          'en',
        ],
      })
    ).state.replacements,
    [
      'https://example.test/en/',
    ],
  );
});
test('matching locales never redirect again', async () => {
  assert.deepEqual(
    (
      await harness({
        current: 'pt-br',
        saved: 'pt-br',
      })
    ).state.replacements,
    [],
  );
});
test('automatic redirects preserve query, fragment and installation prefix', async () => {
  assert.deepEqual(
    (
      await harness({
        prefix: '/prefix/',
        suffix: '?source=link#details',
      })
    ).state.replacements,
    [
      'https://example.test/prefix/pt-br/?source=link#details',
    ],
  );
});
test('missing page translations do not redirect visitors away from their content', async () => {
  assert.deepEqual(
    (
      await harness({
        current: 'en',
        page: 'now/',
        saved: 'fr',
        unavailable: [
          'fr',
        ],
      })
    ).state.replacements,
    [],
  );
});
test('manual selection persists a locale and replaces the equivalent page', async () => {
  const { state, controller } = await harness({
    current: 'pt-br',
    page: 'code/',
    suffix: '?source=link#details',
  });

  await controller.select('fr');
  assert.equal(state.saved, 'fr');
  assert.deepEqual(state.replacements, [
    'https://example.test/fr/code/?source=link#details',
  ]);
});
test('manual fallback to a locale home drops an unavailable page fragment', async () => {
  const { state, controller } = await harness({
    current: 'pt-br',
    unavailable: [
      'fr',
    ],
    suffix: '#now-context',
  });

  await controller.select('fr');
  assert.deepEqual(state.replacements, [
    'https://example.test/fr/',
  ]);
});
test('blocked storage keeps a manual selection explicit in the URL', async () => {
  const { state, controller } = await harness({
    current: 'pt-br',
    page: 'code/',
    blocked: true,
  });

  await controller.select('en');
  assert.deepEqual(state.replacements, [
    'https://example.test/en/code/?lang=en',
  ]);
  assert.deepEqual(
    (
      await harness({
        current: 'en',
        page: 'code/',
        blocked: true,
        suffix: '?lang=en',
      })
    ).state.replacements,
    [],
  );
});
test('explicit query preferences are persisted and cleaned in the final URL', async () => {
  const { state } = await harness({
    suffix: '?lang=en&source=link#details',
  });

  assert.equal(state.saved, 'en');
  assert.deepEqual(state.cleanups, []);
  assert.deepEqual(state.replacements, [
    'https://example.test/en/?source=link#details',
  ]);
  assert.deepEqual(
    (
      await harness({
        current: 'en',
        suffix: '?lang=en&x=1',
      })
    ).state.cleanups,
    [
      'https://example.test/en/?x=1',
    ],
  );
});
test('unknown manual selections and cross-origin routes are ignored', async () => {
  const { state, controller } = await harness({
    current: 'pt-br',
  });

  await controller.select('unknown');
  assert.deepEqual(state.replacements, []);
  assert.deepEqual(state.writes, []);

  for (const path of [
    'https://evil.test/',
    '//evil.test/',
    '/\\evil.test/',
  ]) {
    assert.equal(
      languageDestination(
        {
          id: 'en',
          url: path,
          home: path,
        },
        new URL('https://example.test/'),
      ),
      null,
    );
  }
});
test('a failed SPA transition falls back only once', async () => {
  const { state, controller } = await harness({
    failure: true,
  });

  await controller.normalize();
  assert.deepEqual(state.fallbacks, [
    'https://example.test/pt-br/',
  ]);
});
