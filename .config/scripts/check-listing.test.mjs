import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyActionFor } from '../../website/src/lib/listing-presentation.ts';
import { destinationFor } from '../../website/src/lib/render-utils.ts';
import { getSiteData } from '../../website/src/lib/site-data.server.ts';
import { websiteRoot } from './paths.cjs';
import { renderListingFixture } from './listing-fixtures.mjs';

const data = await getSiteData(websiteRoot);

const destination = (item) => {
  return destinationFor(data.links, item, 'pt-br', 'minecraft');
};

const baseItem = {
  id: 'test-record',
  type: 'project',
  source: 'resume',
  language: 'pt-br',
  title: 'Long published title '.repeat(8),
  summary: 'Published summary',
  url: 'https://curriculum.guesant.net/pt-BR/#project-record',
  tags: [],
  metadata: {},
};

function props(item) {
  return {
    item,
    ui: data.editorial.ui['pt-br'],
    thirdPartyLabel: data.links.locales['pt-br'].ui.third_party,
    locale: 'pt-br',
    interfaceName: 'minecraft',
    sectionID: 'code',
    destination,
    headingLevel: 4,
  };
}

test('one action includes its title and external indicator inside the anchor', async () => {
  const html = await renderListingFixture(
    'EditorialEntry.svelte',
    props(baseItem),
  );

  assert.equal((html.match(/<a\s/g) || []).length, 1);
  assert.match(
    html,
    /<a\s[^>]*target="_blank"[^>]*>[\s\S]*Long published title[\s\S]*external-link-icon[\s\S]*<\/a>/,
  );
  assert.doesNotMatch(html, /<a\s[^>]*>[\s\S]*Published summary[\s\S]*<\/a>/);
  assert.match(html, /<h4>/);
});

test('projects retain two independent destinations and a localized third-party badge', async () => {
  const html = await renderListingFixture(
    'EditorialEntry.svelte',
    props({
      ...baseItem,
      details_url: 'https://github.com/example/project',
      details_label: 'Ver no GitHub',
    }),
  );

  assert.equal((html.match(/<a\s/g) || []).length, 2);
  assert.match(html, /href="https:\/\/curriculum\.guesant\.net/);
  assert.match(html, /href="https:\/\/github\.com\/example\/project"/);
  assert.match(html, /link-third-party-badge[^>]*>Terceiros/);
  assert.doesNotMatch(html, /<a\s[^>]*>[^]*?<a\s[^>]*>[^]*?<\/a>[^]*?<\/a>/);
});

test('records without URL remain informative and do not receive an action row', async () => {
  const html = await renderListingFixture(
    'EditorialEntry.svelte',
    props({
      ...baseItem,
      url: '',
    }),
  );

  assert.doesNotMatch(html, /<a\s/);
  assert.doesNotMatch(html, /class="action-row /);
  assert.match(html, /editorial-information/);
  assert.match(html, /Published summary/);
});

test('affiliations remain in the primary action in every available locale', async () => {
  for (const { id } of data.links.language_options) {
    const title = 'Institution · Confirmed affiliation';

    const html = await renderListingFixture('EditorialEntry.svelte', {
      ...props({
        ...baseItem,
        type: 'experience',
        title,
      }),
      locale: id,
    });

    assert(html.includes(title));
  }
});

test('empty actions target real link anchors or locale homes, never empty self routes', () => {
  for (const language of data.links.language_options) {
    const ui = data.editorial.ui[language.id];

    assert(ui.return_home.trim());

    for (const prefix of [
      '',
      'terminal/',
    ]) {
      const context = {
        home: false,
        pageURL: `${language.path}${prefix}uses/`,
        homeURL: `${language.path}${prefix}`,
        sectionID: 'uses',
        linksCount: 0,
        ui,
      };

      assert.deepEqual(emptyActionFor(context), {
        href: context.homeURL,
        label: ui.return_home,
      });
      assert.equal(
        emptyActionFor({
          ...context,
          home: true,
        }),
        undefined,
      );
      assert.equal(
        emptyActionFor({
          ...context,
          linksCount: 1,
        }).href,
        '#links-uses',
      );
      assert.equal(
        emptyActionFor({
          ...context,
          home: true,
          linksCount: 1,
        }).href,
        `${context.pageURL}#links-uses`,
      );
    }
  }
});

test('Terminal actions preserve already-localized routes, query and anchors', () => {
  for (const url of [
    '/pt-br/terminal/',
    '/pt-br/terminal/career/?query=1#links-career',
  ]) {
    assert.equal(
      destinationFor(
        data.links,
        {
          url,
        },
        'pt-br',
        'terminal',
      ).href,
      url,
    );
  }

  assert.equal(
    destinationFor(
      data.links,
      {
        url: '/pt-br/career/#links-career',
      },
      'pt-br',
      'terminal',
    ).href,
    '/pt-br/terminal/career/#links-career',
  );
});

test('platform descriptions and statistics are rendered outside the primary action', async () => {
  const item = {
    id: 'platform',
    title: 'Profile',
    url: 'https://example.com/profile',
    icon: 'code',
    language: 'pt-br',
    description: 'Profile description',
    stats: {},
  };

  const html = await renderListingFixture('LinkCard.svelte', {
    item,
    thirdPartyLabel: 'Terceiros',
    destination,
  });

  assert.equal((html.match(/<a\s/g) || []).length, 1);
  assert.doesNotMatch(html, /<a\s[^>]*>[\s\S]*Profile description[\s\S]*<\/a>/);
  assert.match(html, /class="statistics"/);
});
