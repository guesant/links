import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  destination,
  editorialItems,
} from '../../website/src/lib/site-data.ts';
import {
  getSiteData,
  pagesFor,
  routeEntries,
  sectionLinks,
} from '../../website/src/lib/site-data.server.ts';
import { validateSiteDocuments } from '../../website/src/lib/data-validation.ts';
import { profileInitials } from '../../website/src/lib/render-utils.ts';
import { optionalProperty } from '../../website/src/lib/object-fields.ts';
import { linkNavigation } from '../../website/src/lib/link-navigation.ts';
import { websiteRoot } from './paths.cjs';
import { loadPageData } from '../../website/src/lib/page-data.server.ts';
import { languageContext } from '../../website/src/lib/language-preference.ts';

const { linksForSection } = createRequire(import.meta.url)(
  './configuration.cjs',
);

const data = await getSiteData(websiteRoot);

test('neutral home shares all localized content without duplicating its route', async () => {
  const initial = await loadPageData(
    data.links.language_preference.default,
    true,
  );

  const localized = await loadPageData(data.links.language_preference.default);

  assert.equal(initial.isLanguageEntry, true);
  assert.equal(localized.isLanguageEntry, false);
  assert.deepEqual({ ...initial, isLanguageEntry: false }, localized);
  assert.equal(initial.locale, 'pt-br');
  assert.equal(initial.page.url, '/pt-br/');
  assert.equal(languageContext(initial).neutral, true);
  assert.equal(languageContext(initial).current, '');
});

test('language destinations distinguish unavailable translations from locale homes', async () => {
  const page = await loadPageData('en/now');

  const routes = languageContext(page).routes;

  assert.equal(
    routes.find((route) => {
      return route.id === 'fr';
    }).url,
    '',
  );
  assert.equal(
    routes.find((route) => {
      return route.id === 'fr';
    }).home,
    '/fr/',
  );

  const terminal = languageContext(
    await loadPageData('en/terminal/now'),
  ).routes;

  assert.equal(
    terminal.find((route) => {
      return route.id === 'fr';
    }).home,
    '/fr/terminal/',
  );
  assert.equal(
    terminal.find((route) => {
      return route.id === 'en';
    }).url,
    '/en/terminal/now/',
  );
});

test('profile initials use the first and last name, ignoring middle names', () => {
  assert.equal(profileInitials(data.links.profile.name), 'GA');
  assert.equal(profileInitials('  Gabriel   R.  Antunes  '), 'GA');
  assert.equal(profileInitials('Gabriel'), 'G');
  assert.equal(profileInitials(''), '');
});

test('optional fields omit only undefined, preserving meaningful falsy values', () => {
  assert.deepEqual(optionalProperty('field', undefined), {});

  for (const value of [false, 0, '', null]) {
    assert.deepEqual(optionalProperty('field', value), { field: value });
  }
});

test('cross-origin navigation opens a protected new tab independently of ownership', () => {
  const origin = 'https://guesant.net';

  for (const href of [
    'https://resume.guesant.net/pt-br/',
    'https://blog.guesant.net/',
    'https://github.com/guesant',
    '//example.com/page',
    'http://guesant.net/',
  ]) {
    assert.deepEqual(linkNavigation(href, origin), {
      external: true,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  }

  for (const href of [
    '/pt-br/career/',
    '#main-content',
    '?view=compact',
    origin,
    'mailto:hello@guesant.net',
    'tel:+551100000000',
  ]) {
    assert.deepEqual(linkNavigation(href, origin), {
      external: false,
      target: '_self',
    });
  }

  assert.equal(
    linkNavigation('/pt-br/', 'http://localhost:4173').target,
    '_self',
  );
  assert.equal(
    linkNavigation('https://guesant.net/', 'http://localhost:4173').target,
    '_blank',
  );

  const owned = destination(
    { links: data.links },
    { url: 'https://resume.guesant.net/', target: '_self' },
  );

  assert.equal(owned.thirdParty, false);
  assert.equal(owned.target, '_blank');
  assert.equal(owned.rel, 'noopener noreferrer');
});

test('every locale requires a non-empty third-party label', () => {
  for (const { id } of data.links.language_options) {
    for (const value of [undefined, '', '   ']) {
      const links = structuredClone(data.links);

      if (value === undefined) {
        delete links.locales[id].ui.third_party;
      } else {
        links.locales[id].ui.third_party = value;
      }

      assert.throws(
        () => {
          return validateSiteDocuments({ ...data, links });
        },
        new RegExp(`links.locales.${id}.ui.third_party`),
      );
    }
  }
});

test('loaded editorial documents pass runtime boundary validation', () => {
  assert.doesNotThrow(() => {
    return validateSiteDocuments({
      links: data.links,
      editorial: data.editorial,
      credits: data.credits,
      statistics: data.statistics,
      federation: data.federation,
    });
  });
});

test('runtime boundary validation rejects malformed documents and feed URLs', () => {
  const valid = {
    links: data.links,
    editorial: data.editorial,
    credits: data.credits,
    statistics: data.statistics,
    federation: data.federation,
  };

  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      links: { ...data.links, sections: null },
    });
  });

  const invalidIconLinks = structuredClone(data.links);

  invalidIconLinks.sections[0].links[0].icon = false;
  assert.throws(() => {
    return validateSiteDocuments({ ...valid, links: invalidIconLinks });
  });

  const invalidLocalizedLinkLinks = structuredClone(data.links);

  invalidLocalizedLinkLinks.sections[0].links[0].labels['pt-br'].title = 42;
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      links: invalidLocalizedLinkLinks,
    });
  });

  const invalidSectionFlagLinks = structuredClone(data.links);

  invalidSectionFlagLinks.sections[0].enabled = 'yes';
  assert.throws(() => {
    return validateSiteDocuments({ ...valid, links: invalidSectionFlagLinks });
  });

  const unknownLinkLocaleLinks = structuredClone(data.links);

  unknownLinkLocaleLinks.sections[0].links[0].localized_urls = {
    'pt-br': 'https://example.com/',
    xx: 'https://example.com/',
  };
  assert.throws(() => {
    return validateSiteDocuments({ ...valid, links: unknownLinkLocaleLinks });
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      editorial: {
        ...data.editorial,
        ui: {
          ...data.editorial.ui,
          'pt-br': { ...data.editorial.ui['pt-br'], search: false },
        },
      },
    });
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      statistics: {
        ...data.statistics,
        'github-stats': {
          ...data.statistics['github-stats'],
          metrics: { ...data.statistics['github-stats'].metrics, stars: '88' },
        },
      },
    });
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      credits: {
        ...data.credits,
        entries: [
          ...data.credits.entries,
          {
            id: 'unknown-license',
            name: 'Invalid',
            authors: 'Invalid',
            license: 'missing-license',
            official_url: 'https://example.com/',
          },
        ],
      },
    });
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      editorial: {
        ...data.editorial,
        entries: {
          ...data.editorial.entries,
          interests: [
            {
              id: 'unsafe',
              url: 'javascript:alert(1)',
              labels: { 'pt-br': { title: 'Unsafe' } },
            },
          ],
        },
      },
    });
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      federation: {
        version: 1,
        items: [
          {
            id: 'invalid',
            source: 'blog',
            language: 'en',
            type: 'post',
            title: 'Invalid URL',
            summary: '',
            url: 'javascript:alert(1)',
            tags: [],
            metadata: {},
          },
        ],
      },
    });
  });

  const validItem = {
    id: 'public-item',
    source: 'blog',
    language: 'en',
    type: 'post',
    title: 'Valid title',
    summary: '',
    url: 'https://blog.guesant.net/posts/public-item/',
    tags: [],
    metadata: { categories: ['engineering'], private_value: 'discarded' },
  };

  const accepted = validateSiteDocuments({
    ...valid,
    federation: { version: 1, items: [validItem] },
  });

  assert.deepEqual(accepted.federation.items[0].metadata, {
    categories: ['engineering'],
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      federation: {
        version: 1,
        items: [validItem, { ...validItem }],
      },
    });
  });
  assert.throws(() => {
    return validateSiteDocuments({
      ...valid,
      federation: {
        version: 1,
        items: [{ ...validItem, source: 'unknown' }],
      },
    });
  });
});

test('localized static routes are unique and include both interfaces', () => {
  const routes = routeEntries(data);

  assert.equal(new Set(routes).size, routes.length);

  for (const language of data.links.language_options) {
    for (const route of ['home', 'career', 'code', 'now']) {
      const standard = pagesFor(data, language.id, 'minecraft').find((page) => {
        return page.id === route;
      });

      const terminal = pagesFor(data, language.id, 'terminal').find((page) => {
        return page.id === route;
      });

      if (standard.fallback) {
        assert.equal(
          standard.url,
          pagesFor(data, 'en', 'minecraft').find((page) => {
            return page.id === route;
          }).url,
        );
      } else {
        assert(standard.url.startsWith(`/${language.id}/`));
      }

      if (terminal.fallback) {
        assert.equal(
          terminal.url,
          pagesFor(data, 'en', 'terminal').find((page) => {
            return page.id === route;
          }).url,
        );
      } else {
        assert(terminal.url.startsWith(`/${language.id}/terminal/`));
      }

      assert(routes.includes(standard.url.slice(1, -1)));
      assert(routes.includes(terminal.url.slice(1, -1)));
    }
  }
});

test('section references resolve visible links without duplicate definitions', () => {
  const career = data.links.sections.find((section) => {
    return section.id === 'career';
  });

  const resolved = linksForSection(data.links, career);

  const identifiers = resolved.map((item) => {
    return item.id;
  });

  assert.equal(new Set(identifiers).size, identifiers.length);
  assert.deepEqual(
    resolved.map((item) => {
      return item.id;
    }),
    sectionLinks(data, career, 'pt-br').map((item) => {
      return item.id;
    }),
  );
  assert.throws(() => {
    return linksForSection(data.links, {
      id: 'fixture',
      links: [],
      link_refs: ['unknown-link'],
    });
  }, /Unknown link reference/);
});

test('link filters and destinations preserve ownership and public visibility', () => {
  const section = data.links.sections.find((item) => {
    return item.id === 'career';
  });

  const fixture = structuredClone(data.links);

  fixture.sections.push({
    ...structuredClone(section),
    id: 'fixture',
    enabled: true,
    links: [
      {
        id: 'fixture-public',
        enabled: true,
        public: true,
        url: 'https://guesant.net/',
      },
      { id: 'fixture-disabled', enabled: false, url: 'https://github.com/' },
      {
        id: 'fixture-private',
        enabled: true,
        public: false,
        url: 'https://github.com/',
      },
    ],
    link_refs: [],
  });
  assert.deepEqual(
    linksForSection(fixture, fixture.sections.at(-1)).map((item) => {
      return item.id;
    }),
    ['fixture-public'],
  );
  assert.equal(
    destination({ links: fixture }, { url: 'https://blog.guesant.net/' })
      .thirdParty,
    false,
  );
  assert.equal(
    destination({ links: fixture }, { url: 'https://github.com/guesant' })
      .thirdParty,
    true,
  );
  assert.equal(
    destination({ links: fixture }, { url: 'mailto:hello@guesant.net' })
      .external,
    true,
  );
});

test('editorial records hide private, disabled, and draft entries', () => {
  const fixture = structuredClone(data);

  fixture.federation = { version: 1, items: [] };
  fixture.editorial.entries.career = [
    {
      id: 'visible',
      enabled: true,
      public: true,
      labels: { 'pt-br': { title: 'Visible' } },
    },
    {
      id: 'disabled',
      enabled: false,
      labels: { 'pt-br': { title: 'Disabled' } },
    },
    { id: 'private', private: true, labels: { 'pt-br': { title: 'Private' } } },
    { id: 'draft', draft: true, labels: { 'pt-br': { title: 'Draft' } } },
  ];
  assert.deepEqual(
    editorialItems(fixture, 'career', 'pt-br').map((item) => {
      return item.id;
    }),
    ['visible'],
  );
});

test('section pages retain all configured links and translated routes', () => {
  for (const language of data.links.language_options) {
    const pages = pagesFor(data, language.id);

    for (const sectionID of data.links.navigation.sections) {
      const section = data.links.sections.find((entry) => {
        return entry.id === sectionID;
      });

      const page = pages.find((entry) => {
        return entry.id === section.id;
      });

      assert(page, `${language.id}: missing ${section.id}`);
      assert.equal(page.url, `/${language.id}/${section.id}/`);
      assert.deepEqual(
        page.links.map((item) => {
          return item.id;
        }),
        sectionLinks(data, section, language.id).map((item) => {
          return item.id;
        }),
      );
    }
  }
});
