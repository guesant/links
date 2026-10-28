import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  destination,
  editorialItems,
  getSiteData,
  pagesFor,
  routeEntries,
  sectionLinks,
} from '../../src/lib/site-data.js';

const { linksForSection } = createRequire(import.meta.url)(
  './configuration.cjs',
);
const data = await getSiteData();

test('localized static routes are unique and include both interfaces', () => {
  const routes = routeEntries(data);
  assert.equal(new Set(routes).size, routes.length);
  for (const language of data.links.language_options) {
    for (const route of ['home', 'career', 'code', 'now']) {
      const standard = pagesFor(data, language.id, 'minecraft').find(
        (page) => page.id === route,
      );
      const terminal = pagesFor(data, language.id, 'terminal').find(
        (page) => page.id === route,
      );
      if (standard.fallback) {
        assert.equal(
          standard.url,
          pagesFor(data, 'en', 'minecraft').find((page) => page.id === route)
            .url,
        );
      } else {
        assert(standard.url.startsWith(`/${language.id}/`));
      }
      if (terminal.fallback) {
        assert.equal(
          terminal.url,
          pagesFor(data, 'en', 'terminal').find((page) => page.id === route)
            .url,
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
  const career = data.links.sections.find((section) => section.id === 'career');
  const resolved = linksForSection(data.links, career);
  const identifiers = resolved.map((item) => item.id);
  assert.equal(new Set(identifiers).size, identifiers.length);
  assert.deepEqual(
    resolved.map((item) => item.id),
    sectionLinks(data, career, 'pt-br').map((item) => item.id),
  );
  assert.throws(
    () =>
      linksForSection(data.links, {
        id: 'fixture',
        links: [],
        link_refs: ['unknown-link'],
      }),
    /Unknown link reference/,
  );
});

test('link filters and destinations preserve ownership and public visibility', () => {
  const section = data.links.sections.find((item) => item.id === 'career');
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
    linksForSection(fixture, fixture.sections.at(-1)).map((item) => item.id),
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
    editorialItems(fixture, 'career', 'pt-br').map((item) => item.id),
    ['visible'],
  );
});

test('section pages retain all configured links and translated routes', () => {
  for (const language of data.links.language_options) {
    const pages = pagesFor(data, language.id);
    for (const sectionID of data.links.navigation.sections) {
      const section = data.links.sections.find(
        (entry) => entry.id === sectionID,
      );
      const page = pages.find((entry) => entry.id === section.id);
      assert(page, `${language.id}: missing ${section.id}`);
      assert.equal(page.url, `/${language.id}/${section.id}/`);
      assert.deepEqual(
        page.links.map((item) => item.id),
        sectionLinks(data, section, language.id).map((item) => item.id),
      );
    }
  }
});
