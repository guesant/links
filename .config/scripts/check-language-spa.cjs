const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolve } = require('node:path');
const { waitForLandscape } = require('./check-progressive-scene.cjs');

async function initialize(page, theme, languages = ['pt-BR']) {
  await page.setCacheEnabled(false);
  await page.evaluateOnNewDocument((languages) => {
    Object.defineProperty(navigator, 'languages', {
      get: () => {
        return languages;
      },
    });
  }, languages);
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: theme },
  ]);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const { width, height } = document
      .querySelector('.site-frame')
      .getBoundingClientRect();

    const headings = Array.from(
      document.querySelectorAll('main h2,main h3'),
      (node) => {
        return node.textContent;
      },
    );

    return { headings, width, height, history: history.length };
  });
}

async function inspectRoot(browser, baseURL, width, theme, directory) {
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await initialize(page, theme);
    await page.setViewport({ width, height: 900 });

    let holding = true;

    let documents = 0;

    const requests = [];

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documents++;
      }

      if (
        holding &&
        request.url().includes('/_app/immutable/') &&
        request.resourceType() === 'script'
      ) {
        requests.push(request);
      } else {
        void request.continue();
      }
    });
    await page.goto(new URL('/', baseURL).href, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('.category-grid article');
    await page.evaluate(() => {
      return document.fonts.ready;
    });
    await waitForLandscape(page);
    await page.evaluate(() => {
      window.__languageFrame = document.querySelector('.site-frame');
      window.__languageSettings = document.querySelector('#settings-dialog');
      window.__sceneRestarts = 0;
      new MutationObserver((records) => {
        window.__sceneRestarts += records.filter((record) => {
          return record.attributeName === 'data-landscape-ready';
        }).length;
      }).observe(document.documentElement, { attributes: true });
    });

    const initial = await snapshot(page);

    assert.equal(new URL(page.url()).pathname, '/');
    assert(initial.headings.length > 9);
    assert.equal(
      await page.$eval('meta[name="robots"]', (node) => {
        return node.content;
      }),
      'noindex, follow',
    );
    assert.equal(
      await page.$eval('link[rel="canonical"]', (node) => {
        return new URL(node.href).pathname;
      }),
      '/pt-br/',
    );
    await page.screenshot({
      path: resolve(directory, `root-${width}-${theme}.png`),
    });
    holding = false;
    await Promise.all(
      requests.map((request) => {
        return request.continue();
      }),
    );
    await page.waitForFunction(() => {
      return (
        location.pathname === '/pt-br/' &&
        document.querySelector('meta[name="robots"]').content ===
          'index, follow'
      );
    });

    const final = await page.evaluate(() => {
      return {
        frame: window.__languageFrame === document.querySelector('.site-frame'),
        settings:
          window.__languageSettings ===
          document.querySelector('#settings-dialog'),
        restarts: window.__sceneRestarts,
      };
    });

    assert.deepEqual(await snapshot(page), initial);
    assert.equal(final.frame, true);
    assert.equal(final.settings, true);
    assert.equal(final.restarts, 0);
    assert.equal(documents, 1);
    await page.screenshot({
      path: resolve(directory, `localized-${width}-${theme}.png`),
    });
  } finally {
    await context.close();
  }
}

async function inspectMenu(browser, baseURL, terminal, width, theme) {
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await initialize(page, theme);
    await page.setViewport({ width, height: 900 });

    const resolveSegment = () => {
      if (terminal) {
        return 'terminal/';
      }

      return '';
    };

    const segment = resolveSegment();

    let documents = 0;

    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documents++;
      }
    });
    await page.goto(
      new URL(`/pt-br/${segment}career/?source=language#main-content`, baseURL)
        .href,
      { waitUntil: 'networkidle0' },
    );
    await page.evaluate(() => {
      window.__languageSettings = document.querySelector('#settings-dialog');
      window.__languageDocument = document;
      window.__languageHistory = history.length;
    });
    await page.click('[data-settings-open]');

    for (const locale of ['en', 'fr', 'es', 'it', 'zh', 'pt-br']) {
      const path = `/${locale}/${segment}career/`;

      await page.focus('[data-language-switcher]');
      await page.select('[data-language-switcher]', path);
      await page.waitForFunction(
        (path) => {
          return (
            location.pathname === path && document.documentElement.lang !== ''
          );
        },
        {},
        path,
      );
      await page.waitForFunction(
        (locale) => {
          return (
            document.querySelector('[data-language-switcher]')
              .selectedOptions[0].dataset.language === locale
          );
        },
        {},
        locale,
      );

      const state = await page.evaluate(() => {
        return {
          settings:
            window.__languageSettings ===
            document.querySelector('#settings-dialog'),
          document: window.__languageDocument === document,
          open: document.querySelector('#settings-dialog').open,
          focus: document.activeElement.matches('[data-language-switcher]'),
          history: history.length === window.__languageHistory,
          query: location.search,
          hash: location.hash,
          interface: document.documentElement.dataset.interface,
          bios: document.querySelector('#bios-dialog')?.open || false,
        };
      });

      const resolveInterface = () => {
        if (terminal) {
          return 'terminal';
        }

        return 'minecraft';
      };

      assert.deepEqual(state, {
        settings: true,
        document: true,
        open: true,
        focus: true,
        history: true,
        query: '?source=language',
        hash: '#main-content',
        interface: resolveInterface(),
        bios: false,
      });
      assert.equal(documents, 1);
    }
  } finally {
    await context.close();
  }
}

async function inspectFallbacks(browser, baseURL) {
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await initialize(page, 'dark', ['en']);
    await page.goto(
      new URL('/en/now/?source=fallback#now-context', baseURL).href,
      { waitUntil: 'networkidle0' },
    );
    await page.click('[data-settings-open]');
    await page.focus('[data-language-switcher]');
    await page.select('[data-language-switcher]', '/fr/');
    await page.waitForFunction(() => {
      return location.pathname === '/fr/';
    });
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(new URL(page.url()).search, '?source=fallback');
    assert.equal(
      await page.$eval('#settings-dialog', (dialog) => {
        return dialog.open;
      }),
      true,
    );
    await page.setJavaScriptEnabled(false);
    await page.goto(new URL('/', baseURL).href, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => {
      return location.pathname === '/pt-br/';
    });
    assert(await page.$('main .category-grid'));
  } finally {
    await context.close();
  }
}

module.exports = async function checkLanguageSPA(browser, baseURL) {
  const directory = resolve(
    process.env.QA_REPORT_DIR || '.local/reports',
    'language-spa',
  );

  fs.mkdirSync(directory, { recursive: true });

  for (const theme of ['dark', 'light']) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await inspectRoot(browser, baseURL, width, theme, directory);
    }

    for (const terminal of [false, true]) {
      for (const width of [390, 1440]) {
        await inspectMenu(browser, baseURL, terminal, width, theme);
      }
    }
  }

  await inspectFallbacks(browser, baseURL);
  console.log(
    JSON.stringify({
      rootPresentations: 10,
      manualLanguageTransitions: 48,
      languageSPAFailures: [],
    }),
  );
};
