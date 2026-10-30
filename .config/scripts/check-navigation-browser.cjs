const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readConfiguration, pagesFor } = require('./configuration.cjs');

async function inspectLists(page, expected, currentID, baseURL) {
  const normalize = (entry) => {
    return {
      title: entry.title,
      href: new URL(entry.url, baseURL).href,
      current: entry.id === currentID,
    };
  };

  for (const selector of [
    '.header-navigation-links a',
    '.footer-navigation-links a',
  ]) {
    assert.deepEqual(
      await page.$$eval(selector, (links) => {
        return links.map((link) => {
          return {
            title: link.textContent.trim(),
            href: link.href,
            current: link.getAttribute('aria-current') === 'page',
          };
        });
      }),
      expected.map(normalize),
    );
  }

  assert.equal(
    await page.$('.profile-navigation details, .quick-access'),
    null,
  );
  assert.equal(
    await page.$eval('.profile-navigation', (nav) => {
      return Boolean(nav.closest('.profile'));
    }),
    true,
  );
}

async function inspectGeometry(page) {
  const actual = await page.evaluate(() => {
    const header = document.querySelector('.profile').getBoundingClientRect();

    const navigation = document
      .querySelector('.profile-navigation')
      .getBoundingClientRect();

    const quick = document
      .querySelector('.quick-contacts')
      .getBoundingClientRect();

    const links = [
      ...document.querySelectorAll('.navigation-links a'),
    ];

    return {
      insideHeader:
        navigation.top >= header.top &&
        navigation.bottom <= quick.top &&
        quick.bottom <= header.bottom &&
        navigation.left >= header.left &&
        navigation.right <= header.right,
      overflow: document.documentElement.scrollWidth > innerWidth,
      linksFit: links.every((link) => {
        return (
          link.scrollWidth <= link.clientWidth + 1 &&
          link.getBoundingClientRect().height >= 44
        );
      }),
      textOnly: links.every((link) => {
        const style = getComputedStyle(link);

        return (
          style.borderImageSource === 'none' &&
          style.borderWidth === '0px' &&
          style.backgroundColor === 'rgba(0, 0, 0, 0)' &&
          style.boxShadow === 'none' &&
          style.transform === 'none'
        );
      }),
    };
  });

  assert.deepEqual(actual, {
    insideHeader: true,
    overflow: false,
    linksFit: true,
    textOnly: true,
  });
}

async function inspectKeyboardNavigation(page, baseURL) {
  await page.goto(new URL('/pt-br/', baseURL).href, {
    waitUntil: 'networkidle0',
  });
  await page.evaluate(() => {
    window.navigationTest = true;
  });
  await page.focus('.header-navigation-links a');
  await page.keyboard.press('Tab');
  assert.equal(
    await page.$eval(':focus', (link) => {
      return link.dataset.navigationPage;
    }),
    'career',
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    return document.documentElement.dataset.page === 'career';
  });
  assert.equal(
    await page.evaluate(() => {
      return window.navigationTest;
    }),
    true,
    'navigation stays client-side',
  );
  await page.setJavaScriptEnabled(false);
  await page.reload({
    waitUntil: 'networkidle0',
  });
  await page.focus('.header-navigation-links a[data-navigation-page="code"]');
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'networkidle0',
    }),
    page.keyboard.press('Enter'),
  ]);
  assert.equal(new URL(page.url()).pathname, '/pt-br/code/');
  await page.setJavaScriptEnabled(true);
}

async function checkNavigationBrowser(
  browser,
  baseURL,
  reportDirectory,
  pageIDs = [],
) {
  const config = readConfiguration();

  const context = await browser.createBrowserContext();

  const checks = [];

  const errors = [];

  fs.mkdirSync(reportDirectory, {
    recursive: true,
  });

  try {
    const page = await context.newPage();

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    for (const language of config.language_options) {
      const pages = pagesFor(config, language.id);

      const expected = pages.filter((entry) => {
        return (
          [
            'home',
            'links-page',
          ].includes(entry.type) || entry.id === 'now'
        );
      });

      const routes = pages.filter((entry) => {
        return (
          !entry.fallback && (!pageIDs.length || pageIDs.includes(entry.id))
        );
      });

      for (const route of routes) {
        await page.goto(new URL(route.url, baseURL).href, {
          waitUntil: 'networkidle0',
        });
        await page.evaluate(() => {
          return document.fonts.ready;
        });
        await inspectLists(page, expected, route.id, baseURL);

        for (const theme of [
          'dark',
          'light',
        ]) {
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);

          for (const width of [
            320,
            390,
            768,
            1024,
            1440,
          ]) {
            await page.setViewport({
              width,
              height: 900,
            });
            await inspectGeometry(page);
            checks.push({
              path: route.url,
              theme,
              width,
              passed: true,
            });
          }
        }
      }
    }

    await inspectKeyboardNavigation(page, baseURL);
    await page.goto(new URL('/pt-br/', baseURL).href, {
      waitUntil: 'networkidle0',
    });
    await page.$eval('html', (root) => {
      root.style.fontSize = '200%';
    });

    for (const width of [
      320,
      390,
      768,
      1024,
      1440,
    ]) {
      await page.setViewport({
        width,
        height: 900,
      });
      await inspectGeometry(page);
    }

    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${reportDirectory}/navigation-checks.json`,
      JSON.stringify(
        {
          passed: checks.length,
          failures: errors,
          checks,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        navigationChecks: checks.length,
        failures: errors,
      }),
    );
  } finally {
    await context.close();
  }
}

module.exports = checkNavigationBrowser;
