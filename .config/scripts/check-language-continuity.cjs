const assert = require('node:assert/strict');

async function blockedStorage(browser, baseURL) {
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('Storage blocked');
        },
      });
    });
    await page.goto(
      new URL('/pt-br/career/?source=blocked#main-content', baseURL).href,
      {
        waitUntil: 'networkidle0',
      },
    );
    await page.click('[data-settings-open]');
    await page.select('[data-language-switcher]', '/en/career/');
    await page.waitForFunction(() => {
      return (
        location.pathname === '/en/career/' &&
        new URL(location.href).searchParams.get('lang') === 'en'
      );
    });

    const url = new URL(page.url());

    assert.equal(url.searchParams.get('source'), 'blocked');
    assert.equal(url.hash, '#main-content');
    assert(
      await page.$eval('#settings-dialog', (dialog) => {
        return dialog.open;
      }),
    );
    await page.reload({
      waitUntil: 'networkidle0',
    });
    assert.equal(page.url(), url.href);
    await page.click('[data-settings-open]');
    await page.evaluate(() => {
      const select = document.querySelector('[data-language-switcher]');

      for (const path of [
        '/fr/career/',
        '/es/career/',
      ]) {
        select.value = path;
        select.dispatchEvent(
          new Event('change', {
            bubbles: true,
          }),
        );
      }
    });
    await page.waitForFunction(() => {
      return (
        location.pathname === '/es/career/' &&
        new URL(location.href).searchParams.get('lang') === 'es'
      );
    });
  } finally {
    await context.close();
  }
}

async function searchAndHistory(browser, baseURL) {
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await page.setCacheEnabled(false);

    const indexes = [];

    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;

      if (path.startsWith('/search/')) {
        indexes.push(path);
      }
    });
    await page.goto(new URL('/pt-br/', baseURL).href, {
      waitUntil: 'networkidle0',
    });
    await page.goto(new URL('/pt-br/career/', baseURL).href, {
      waitUntil: 'networkidle0',
    });
    await page.click('[data-search-open]');
    await page.waitForFunction(() => {
      return (
        document.querySelector('#search-results').getAttribute('aria-busy') ===
        'false'
      );
    });
    await page.keyboard.press('Escape');
    await page.click('[data-settings-open]');
    await page.focus('[data-language-switcher]');
    await page.evaluate(() => {
      window.scrollTo(0, 200);
    });
    await page.select('[data-language-switcher]', '/en/career/');
    await page.waitForFunction(() => {
      return location.pathname === '/en/career/';
    });
    assert.equal(
      await page.evaluate(() => {
        return scrollY;
      }),
      200,
    );
    await page.keyboard.press('Escape');

    const loaded = page.waitForResponse((response) => {
      return response.url().endsWith('/search/en-minecraft.json');
    });

    await page.click('[data-search-open]');
    await loaded;
    await page.waitForFunction(() => {
      return (
        document.querySelector('#search-results').getAttribute('aria-busy') ===
        'false'
      );
    });
    assert.deepEqual(indexes, [
      '/search/pt-br-minecraft.json',
      '/search/en-minecraft.json',
    ]);
    await page.keyboard.press('Escape');
    await page.goBack({
      waitUntil: 'networkidle0',
    });
    assert.match(new URL(page.url()).pathname, /^\/(pt-br|en)\/$/);
  } finally {
    await context.close();
  }
}

async function nativeFallback(browser, baseURL) {
  const context = await browser.createBrowserContext();

  try {
    const page = await context.newPage();

    await page.setCacheEnabled(false);

    let documents = 0;

    let failure = false;

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documents++;
      }

      if (new URL(request.url()).pathname === '/en/career/__data.json') {
        failure = true;
        void request.abort();
      } else {
        void request.continue();
      }
    });
    await page.goto(new URL('/pt-br/career/', baseURL).href, {
      waitUntil: 'networkidle0',
    });
    await page.click('[data-settings-open]');
    await page.evaluate(() => {
      window.__languageFallbackDocument = document;
    });
    await page.select('[data-language-switcher]', '/en/career/');
    await page.waitForFunction(() => {
      return (
        location.pathname === '/en/career/' &&
        window.__languageFallbackDocument !== document &&
        document.readyState === 'complete' &&
        document.querySelector('.site-frame') !== null
      );
    });
    assert.equal(failure, true);
    assert.equal(documents, 2);
  } finally {
    await context.close();
  }
}

module.exports = async function checkLanguageContinuity(browser, baseURL) {
  console.log('Language continuity: blocked storage and rapid choices');
  await blockedStorage(browser, baseURL);
  console.log('Language continuity: search, focus, scroll and history');
  await searchAndHistory(browser, baseURL);
  console.log('Language continuity: native fallback');
  await nativeFallback(browser, baseURL);
  console.log(
    JSON.stringify({
      languageContinuityScenarios: 3,
      failures: [],
    }),
  );
};
