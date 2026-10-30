const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { readConfiguration } = require('./configuration.cjs');
const {
  responsiveWidths,
  useBrowserLanguages,
  withBrowser,
} = require('./browser-presentation.cjs');

const families = {
  platform: '.action-row[data-link-id]',
  experience: '[data-editorial-type="experience"] .editorial-primary',
  project: '[data-editorial-type="project"] .editorial-primary',
  repository: '.editorial-details',
  fallback: '.editorial-related',
};

async function snapshot(row) {
  return row.evaluate((element) => {
    const style = getComputedStyle(element);

    const rect = element.getBoundingClientRect();

    return {
      color: style.color,
      background: style.backgroundColor,
      outline: style.outlineStyle,
      shadow: style.boxShadow,
      padding: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
      ],
      height: rect.height,
      width: rect.width,
    };
  });
}

async function inspectStates(page, session, documentID, selector) {
  const row = await page.$(selector);

  if (!row) {
    return undefined;
  }

  const { nodeId } = await session.send('DOM.querySelector', {
    nodeId: documentID,
    selector,
  });

  const states = {};

  for (const [
    name,
    forcedPseudoClasses,
  ] of Object.entries({
    normal: [],
    hover: [
      'hover',
    ],
    focus: [
      'focus-visible',
    ],
    active: [
      'hover',
      'active',
    ],
  })) {
    await session.send('CSS.forcePseudoState', {
      nodeId,
      forcedPseudoClasses,
    });
    states[name] = await snapshot(row);
  }

  await session.send('CSS.forcePseudoState', {
    nodeId,
    forcedPseudoClasses: [],
  });
  assert.notEqual(states.hover.background, states.normal.background, selector);
  assert.notEqual(states.hover.color, states.normal.color, selector);
  assert.equal(states.focus.background, states.hover.background, selector);
  assert.equal(states.focus.color, states.hover.color, selector);
  assert.equal(states.focus.outline, 'solid', selector);
  assert.notEqual(states.active.background, states.normal.background, selector);

  for (const state of Object.values(states)) {
    assert.equal(state.width, states.normal.width, selector);
    assert.equal(state.height, states.normal.height, selector);
    assert(state.height >= 44, selector);
  }

  assert.equal(states.normal.padding[0], states.normal.padding[2]);
  assert.equal(states.normal.padding[1], states.normal.padding[3]);
  assert(
    parseFloat(states.normal.padding[1]) > parseFloat(states.normal.padding[0]),
  );

  return states;
}

async function inspectPresentation(page, session) {
  await page.mouse.move(0, 0);

  const { root } = await session.send('DOM.getDocument');

  let reference;

  let count = 0;

  for (const selector of Object.values(families)) {
    const states = await inspectStates(page, session, root.nodeId, selector);

    if (!states) {
      continue;
    }

    if (!reference) {
      reference = states;
    }

    for (const name of Object.keys(states)) {
      assert.equal(
        states[name].background,
        reference[name].background,
        selector,
      );
      assert.equal(states[name].color, reference[name].color, selector);
      assert.deepEqual(states[name].padding, reference[name].padding, selector);
    }

    count++;
  }

  assert(
    count >= 4,
    'real Home covers platforms, experience, projects and repositories',
  );
  await inspectStructure(page);

  return count;
}

async function inspectStructure(page) {
  const actual = await page.evaluate(() => {
    const lists = [
      ...document.querySelectorAll('.divided-list'),
    ];

    const borders = lists.every((list) => {
      const style = getComputedStyle(list);

      return (
        parseFloat(style.borderTopWidth) === 1 &&
        parseFloat(style.borderBottomWidth) === 1 &&
        [
          ...list.children,
        ].every((child, index) => {
          const itemStyle = getComputedStyle(child);

          return (
            parseFloat(itemStyle.borderTopWidth) === Number(index > 0) &&
            parseFloat(itemStyle.borderBottomWidth) === 0
          );
        })
      );
    });

    const rows = [
      ...document.querySelectorAll('.action-row'),
    ];

    return {
      borders,
      nested: Boolean(
        document.querySelector(
          'a a, .editorial-description a, .editorial-metadata a',
        ),
      ),
      markers: rows.every((row) => {
        return row.querySelectorAll('.external-link-icon').length <= 1;
      }),
      overflow: document.documentElement.scrollWidth > innerWidth,
      categoryActions: Boolean(
        document.querySelector(
          '.category-summary a, .terminal-directory-entry > header a',
        ),
      ),
    };
  });

  assert.deepEqual(actual, {
    borders: true,
    nested: false,
    markers: true,
    overflow: false,
    categoryActions: false,
  });
}

async function inspectClicks(page) {
  const selectors = [
    '.action-row[data-link-id]',
    '[data-editorial-type="project"] .editorial-primary',
    '.editorial-details',
  ];

  for (const selector of selectors) {
    const row = await page.$(selector);

    await row.evaluate((element) => {
      window.listingClicks = [];
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.listingClicks.push(element.href);
      });
      element.scrollIntoView({
        block: 'center',
      });
    });

    const expected = await row.evaluate((element) => {
      return element.href;
    });

    const box = await row.boundingBox();

    await page.mouse.click(box.x + 2, box.y + box.height / 2);
    await page.click(`${selector} .action-row-title`);
    await page.click(`${selector} .external-link-icon`);
    assert.deepEqual(
      await page.evaluate(() => {
        return window.listingClicks;
      }),
      [
        expected,
        expected,
        expected,
      ],
    );
    await row.focus();
    await page.keyboard.press('Enter');
    assert.equal(
      (
        await page.evaluate(() => {
          return window.listingClicks;
        })
      ).length,
      4,
    );
  }

  await page.focus('.action-row[data-link-id]');
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => {
      return (
        document.activeElement.matches('.action-row:focus-visible') &&
        getComputedStyle(document.activeElement).outlineStyle === 'solid'
      );
    }),
    true,
  );
}

async function inspectTextZoom(page) {
  await page.$eval('html', (root) => {
    root.style.fontSize = '200%';
  });

  try {
    assert.equal(
      await page.$$eval('.action-row', (rows) => {
        return rows.every((row) => {
          return row.scrollWidth <= row.clientWidth + 1;
        });
      }),
      true,
      'action rows fit with text enlarged to 200%',
    );
  } finally {
    await page.$eval('html', (root) => {
      root.style.removeProperty('font-size');
    });
  }
}

async function inspectInformativeRecord(page, language) {
  const { renderListingFixture } = await import('./listing-fixtures.mjs');

  const { resolveDestination } =
    await import('../../website/src/lib/site-data.ts');

  const config = readConfiguration();

  const interfaceName = await page.$eval('html', (root) => {
    return root.dataset.interface;
  });

  const html = await renderListingFixture('EditorialEntry.svelte', {
    item: {
      id: 'test-information',
      type: 'uses',
      source: 'lobby',
      language: language.id,
      title: 'Informational test fixture',
      summary: 'Test-only description',
      url: '',
      tags: [],
      metadata: {},
    },
    ui: {},
    thirdPartyLabel: config.locales[language.id].ui.third_party,
    locale: language.id,
    interfaceName,
    sectionID: 'uses',
    headingLevel: 3,
    destination: (item) => {
      return resolveDestination(config.site, item);
    },
  });

  await page.$eval(
    'main',
    (main, source) => {
      main.insertAdjacentHTML('beforeend', source);
    },
    html,
  );

  const element = await page.$('[data-editorial-id="test-information"]');

  assert.equal(await element.$('a'), null);
  await page.mouse.move(0, 0);

  const initial = await snapshot(element);

  await element.hover();
  assert.deepEqual(await snapshot(element), initial);
  await element.evaluate((node) => {
    node.remove();
  });
}

async function inspectPassiveCard(page) {
  const card = await page.$('.category-card');

  if (!card) {
    return;
  }

  await page.mouse.move(0, 0);

  const initial = await snapshot(card);

  await card.hover();
  assert.deepEqual(
    await snapshot(card),
    initial,
    'passive container does not react to hover',
  );
}

async function inspectFallbacks(page, baseURL, language, terminal) {
  let prefix = language.path;

  if (terminal) {
    prefix += 'terminal/';
  }

  await page.goto(new URL(`${prefix}uses/`, baseURL).href, {
    waitUntil: 'networkidle0',
  });

  if (await page.$('[data-editorial-empty="uses"]')) {
    assert.equal(
      await page.$eval('.editorial-related', (element) => {
        return new URL(element.href).pathname;
      }),
      prefix,
    );
  } else {
    assert(await page.$('[data-editorial-section="uses"] .editorial-entry'));
  }

  await page.goto(new URL(`${prefix}writing/`, baseURL).href, {
    waitUntil: 'networkidle0',
  });

  if (await page.$('[data-editorial-empty="writing"]')) {
    const href = await page.$eval('.editorial-related', (element) => {
      return element.getAttribute('href');
    });

    assert.equal(href, '#links-writing');
  }

  assert(await page.$('#links-writing'));
}

async function inspectRoute(browser, baseURL, language, terminal, directory) {
  const page = await browser.newPage();

  try {
    await useBrowserLanguages(page, [
      language.hreflang,
    ]);

    let prefix = language.path;

    if (terminal) {
      prefix += 'terminal/';
    }

    await page.goto(new URL(prefix, baseURL).href, {
      waitUntil: 'networkidle0',
    });
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    const session = await page.createCDPSession();

    await session.send('DOM.enable');
    await session.send('CSS.enable');

    let count = 0;

    for (const width of responsiveWidths) {
      await page.setViewport({
        width,
        height: 900,
      });

      for (const theme of [
        'light',
        'dark',
      ]) {
        for (const view of [
          'compact',
          'detailed',
        ]) {
          await page.evaluate(
            ({ theme, view }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.linkView = view;
            },
            {
              theme,
              view,
            },
          );
          count += await inspectPresentation(page, session);
          await inspectTextZoom(page);
        }
      }
    }

    await inspectClicks(page);
    await inspectPassiveCard(page);
    await inspectInformativeRecord(page, language);
    await page.screenshot({
      path: resolve(directory, `${language.id}-${terminal}-rows.png`),
    });
    await inspectFallbacks(page, baseURL, language, terminal);
    await page.setJavaScriptEnabled(false);
    await page.goto(new URL(`${prefix}career/`, baseURL).href, {
      waitUntil: 'networkidle0',
    });
    assert(await page.$('.action-row[data-link-id]'));
    await inspectStructure(page);

    return count;
  } finally {
    await page.close();
  }
}

async function checkListingBrowser(browser, baseURL, reportDirectory) {
  const directory = resolve(reportDirectory, 'listing-contract');

  await mkdir(directory, {
    recursive: true,
  });

  const config = readConfiguration();

  let states = 0;

  for (const language of config.language_options) {
    for (const terminal of [
      false,
      true,
    ]) {
      states += await inspectRoute(
        browser,
        baseURL,
        language,
        terminal,
        directory,
      );
    }
  }

  await writeFile(
    resolve(directory, 'checks.json'),
    JSON.stringify({
      states,
      passed: true,
    }),
  );
  console.log(
    `Listing contract: ${states} row presentations with hover, focus, press, geometry, clicks and fallback checks passed.`,
  );
}

module.exports = checkListingBrowser;

if (require.main === module) {
  withBrowser(async (browser) => {
    await checkListingBrowser(
      browser,
      process.env.QA_BASE_URL || 'http://127.0.0.1:4173/',
      process.env.QA_REPORT_DIR || '.local/reports',
    );
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
