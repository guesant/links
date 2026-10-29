const assert = require('node:assert/strict');
const checkLanguageSPA = require('./check-language-spa.cjs');
const checkLanguageContinuity = require('./check-language-continuity.cjs');
const withBrowserErrors = require('./check-browser-errors.cjs');

async function checkLanguageBrowser(browser, baseURL) {
  const origin = new URL(baseURL);

  const href = (path) => {
    return new URL(path.replace(/^\//, ''), origin).href;
  };

  const key = 'guesant-links-language';

  let passed = 0;

  for (const scenario of [
    { from: '/', to: '/pt-br/', languages: ['pt-PT', 'en-US'] },
    { from: '/', to: '/en/', languages: ['en-US'] },
    { from: '/', to: '/fr/', languages: ['en-US'], saved: 'fr' },
    {
      from: '/?source=link#details',
      to: '/pt-br/?source=link#details',
      languages: ['de-DE'],
    },
    { from: '/', to: '/es/', languages: ['de-DE', 'es-MX'] },
    {
      from: '/?lang=es&source=query#main-content',
      to: '/es/?source=query#main-content',
      languages: ['fr'],
      saved: 'it',
      expectedSaved: 'es',
    },
    {
      from: '/fr/code/?lang=en',
      to: '/en/code/',
      languages: ['pt-BR'],
      expectedSaved: 'en',
    },
    {
      from: '/en/code/?lang=en&source=query',
      to: '/en/code/?source=query',
      languages: ['fr'],
      expectedSaved: 'en',
    },
    { from: '/en/code/', to: '/en/code/', languages: ['pt-BR'] },
    { from: '/fr/code/', to: '/fr/code/', languages: ['pt-BR'] },
    {
      from: '/fr/code/',
      to: '/pt-br/code/',
      languages: ['en-US'],
      saved: 'pt-br',
    },
    { from: '/en/now/', to: '/en/now/', languages: ['fr'], saved: 'fr' },
  ]) {
    const context = await browser.createBrowserContext();

    try {
      const page = await context.newPage();

      await page.evaluateOnNewDocument(
        ({ languages, saved, key }) => {
          Object.defineProperty(navigator, 'languages', {
            get: () => {
              return languages;
            },
          });

          if (saved) {
            localStorage.setItem(key, saved);
          }
        },
        { ...scenario, key },
      );

      let navigations = 0;

      page.on('request', (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          navigations++;
        }
      });
      await page.goto(href(scenario.from), { waitUntil: 'networkidle0' });
      await page.waitForFunction(
        (expected) => {
          return location.href === expected;
        },
        {},
        href(scenario.to),
      );
      assert.equal(
        navigations,
        1,
        'language resolution must stay in the initial document',
      );
      assert.equal(
        await page.evaluate((key) => {
          return localStorage.getItem(key);
        }, key),
        scenario.expectedSaved || scenario.saved || null,
      );
      passed++;
    } finally {
      await context.close();
    }
  }

  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => {
          return ['en-US'];
        },
      });
    });
    await page.goto(href('/en/code/?source=link#details'), {
      waitUntil: 'networkidle0',
    });
    await page.click('[data-settings-open]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.select(
        '[data-language-switcher]',
        new URL(href('/pt-br/code/')).pathname,
      ),
    ]);
    assert.equal(page.url(), href('/pt-br/code/?source=link#details'));
    assert.equal(
      await page.$eval('#settings-dialog', (dialog) => {
        return dialog.open;
      }),
      true,
    );
    assert.equal(
      await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, key),
      'pt-br',
    );
    await page.goto(href('/en/writing/'), { waitUntil: 'networkidle0' });
    assert.equal(page.url(), href('/pt-br/writing/'));
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(page.url(), href('/pt-br/writing/'));
    passed++;
  } finally {
    await context.close();
  }

  console.log(
    JSON.stringify({ languageBrowserScenarios: passed, failures: [] }),
  );
  await checkLanguageSPA(browser, baseURL);
  await checkLanguageContinuity(browser, baseURL);
}

module.exports = async (browser, baseURL) => {
  await withBrowserErrors(browser, async () => {
    await checkLanguageBrowser(browser, baseURL);
  });
};
