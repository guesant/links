const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readConfiguration, pagesFor } = require('./configuration.cjs');

async function checkNavigationBrowser(browser, baseURL, reportDirectory) {
  const config = readConfiguration();

  const base = new URL(baseURL);

  const href = (path) => {
    return new URL(path.replace(/^\//, ''), base).href;
  };

  const context = await browser.createBrowserContext();

  const checks = [];

  const errors = [];

  fs.mkdirSync(reportDirectory, { recursive: true });

  try {
    const page = await context.newPage();

    page.on('pageerror', (error) => {
      return errors.push(error.message);
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => {
          return ['en-US'];
        },
      });
    });

    for (const language of config.language_options) {
      const pages = pagesFor(config, language.id);

      const expected = pages.filter((entry) => {
        return ['home', 'links-page'].includes(entry.type);
      });

      const now = pages.find((entry) => {
        return entry.id === 'now';
      });

      for (const route of pages.filter((entry) => {
        return !entry.fallback;
      })) {
        await page.goto(href(route.url), { waitUntil: 'networkidle0' });
        await page.evaluate(() => {
          return document.fonts.ready;
        });

        const normalize = (entry) => {
          return {
            title: entry.title,
            href: href(entry.url),
            current: entry.id === route.id,
          };
        };

        for (const [selector, entries] of [
          ['.section-menu-list a', expected],
          ['.footer-navigation-links a', [...expected, now]],
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
            entries.map(normalize),
          );
        }

        assert.deepEqual(
          await page.$$eval('[data-now-shortcut]', (links) => {
            return links.map((link) => {
              return {
                href: link.href,
                current: link.getAttribute('aria-current') === 'page',
              };
            });
          }),
          Array.from({ length: 2 }, () => {
            return {
              href: href(now.url),
              current: route.id === 'now',
            };
          }),
        );
        assert.equal(
          await page.$eval('.footer-navigation-title', (title) => {
            return title.textContent.trim();
          }),
          config.locales[language.id].ui.navigation_label,
        );
        assert.equal(
          await page.$eval('.section-switcher-trigger', (trigger) => {
            return trigger.textContent.trim();
          }),
          config.locales[language.id].ui.navigation_sections,
        );
        assert.equal(await page.$('.navigation-current'), null);
        assert.equal(
          await page.$eval('.quick-contacts', (group) => {
            return Boolean(group.closest('.profile'));
          }),
          true,
        );
        assert.equal(await page.$('.page-navigation .quick-contacts'), null);
        assert.equal(await page.$('.quick-access .section-toolbar'), null);

        for (const theme of ['dark', 'light']) {
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
          }, theme);

          for (const width of [320, 390, 768, 1024, 1440]) {
            await page.setViewport({ width, height: 900 });
            await page.$eval('.page-navigation', (bar) => {
              return bar.scrollIntoView({
                block: 'center',
                behavior: 'instant',
              });
            });

            const before = await page.$eval('.page-content', (content) => {
              return content.getBoundingClientRect().top;
            });

            await page.focus('.section-switcher-trigger');
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => {
              return (
                document.querySelector('.section-switcher').open &&
                document
                  .querySelector('.section-switcher')
                  .style.getPropertyValue('--navigation-available-height')
              );
            });
            await page.evaluate(() => {
              return new Promise((done) => {
                return requestAnimationFrame(() => {
                  return requestAnimationFrame(done);
                });
              });
            });

            const actual = await page.evaluate(() => {
              const bar = document.querySelector('.page-navigation');

              const panel = document.querySelector('.section-menu');

              const rect = panel.getBoundingClientRect();

              const links = [...panel.querySelectorAll('a')];

              const footer = document.querySelector('.footer-navigation');

              return {
                fits:
                  rect.left >= 0 &&
                  rect.right <= innerWidth &&
                  rect.top >= 0 &&
                  rect.bottom <= innerHeight,
                overflow: document.documentElement.scrollWidth > innerWidth,
                panelContentFits: panel.scrollWidth <= panel.clientWidth + 1,
                linksFit: links.every((link) => {
                  return (
                    link.scrollWidth <= link.clientWidth + 1 &&
                    link.getBoundingClientRect().height >= 44
                  );
                }),
                footerFits: [...footer.querySelectorAll('a')].every((link) => {
                  return (
                    link.scrollWidth <= link.clientWidth + 1 &&
                    link.getBoundingClientRect().height >= 44
                  );
                }),
                sameWidth:
                  Math.abs(
                    bar.getBoundingClientRect().width -
                      document
                        .querySelector('.page-content')
                        .getBoundingClientRect().width,
                  ) < 1,
                layered: (() => {
                  const x = rect.left + rect.width / 2;

                  const y = rect.top + Math.min(rect.height / 2, 100);

                  return panel.contains(document.elementFromPoint(x, y));
                })(),
                contentTop: document
                  .querySelector('.page-content')
                  .getBoundingClientRect().top,
                noMotion: links.every((link) => {
                  return (
                    getComputedStyle(link).transform === 'none' &&
                    getComputedStyle(link).transitionDuration === '0s'
                  );
                }),
              };
            });

            assert.equal(
              actual.overflow,
              false,
              `${route.url} ${width} ${theme}`,
            );

            for (const key of [
              'fits',
              'panelContentFits',
              'linksFit',
              'footerFits',
              'sameWidth',
              'layered',
              'noMotion',
            ]) {
              assert(
                actual[key],
                `${route.url} ${width} ${theme} ${key}: ${JSON.stringify(actual)}`,
              );
            }

            assert(
              Math.abs(before - actual.contentTop) < 1,
              'Opening navigation must not move content',
            );
            await page.focus('.section-menu [data-now-shortcut]');
            assert(
              await page.$eval('.section-menu [data-now-shortcut]', (link) => {
                const rect = link.getBoundingClientRect();

                const panel = link
                  .closest('.section-menu')
                  .getBoundingClientRect();

                return rect.top >= panel.top && rect.bottom <= panel.bottom;
              }),
              'Last menu link must scroll into view',
            );
            await page.keyboard.press('Escape');
            assert(
              await page.$eval('.section-switcher-trigger', (trigger) => {
                return (
                  document.activeElement === trigger &&
                  !trigger.parentElement.open
                );
              }),
            );

            const screenshot =
              language.id === 'pt-br' &&
              ['home', 'career'].includes(route.id) &&
              [390, 1440].includes(width);

            if (screenshot) {
              await page.evaluate(() => {
                document.activeElement?.blur();
                scrollTo(0, 0);
              });

              const prefix = `${reportDirectory}/navigation-${route.id}-${theme}-${width}`;

              await page.screenshot({ path: `${prefix}.png`, fullPage: true });
              await page.$eval('.page-navigation', (bar) => {
                return bar.scrollIntoView({
                  block: 'start',
                  behavior: 'instant',
                });
              });
              await page.click('.section-switcher-trigger');
              await page.evaluate(() => {
                return new Promise((done) => {
                  return requestAnimationFrame(() => {
                    return requestAnimationFrame(done);
                  });
                });
              });
              await page.screenshot({ path: `${prefix}-open.png` });
              await page.keyboard.press('Escape');
            }

            checks.push({ path: route.url, theme, width, passed: true });
          }
        }
      }
    }

    await page.goto(href('/pt-br/career/'), { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 390, height: 640 });
    await page.focus('.section-switcher-trigger');
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    assert(
      await page.$eval('.section-menu-list a', (link) => {
        return link === document.activeElement;
      }),
    );
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal(
      await page.$eval('.section-switcher', (details) => {
        return details.open;
      }),
      false,
      'Leaving the menu closes it',
    );
    await page.click('.section-switcher-trigger');
    await page.mouse.click(1, 1);
    assert.equal(
      await page.$eval('.section-switcher', (details) => {
        return details.open;
      }),
      false,
      'Outside pointerdown closes menu',
    );
    await page.click('.section-switcher-trigger');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.section-menu-link[data-navigation-page="code"]'),
    ]);
    assert.equal(page.url(), href('/pt-br/code/'));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('.footer-navigation a[data-navigation-page="reading"]'),
    ]);
    assert.equal(page.url(), href('/pt-br/reading/'));
    await page.$eval('html', (root) => {
      root.style.fontSize = '200%';
    });

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 900 });
      await page.click('.section-switcher-trigger');
      assert.equal(
        await page.evaluate(() => {
          return document.documentElement.scrollWidth > innerWidth;
        }),
        false,
        `Navigation at 200% text: ${width}`,
      );
      await page.keyboard.press('Escape');
    }

    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${reportDirectory}/navigation-checks.json`,
      JSON.stringify(
        { passed: checks.length, failures: errors, checks },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({ navigationChecks: checks.length, failures: errors }),
    );
  } finally {
    await context.close();
  }
}

module.exports = checkNavigationBrowser;

if (require.main === module) {
  const { createRequire } = require('node:module');

  const puppeteer = createRequire(
    '/usr/local/lib/node_modules/pa11y-ci/package.json',
  )('puppeteer');

  (async () => {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      await checkNavigationBrowser(
        browser,
        process.env.QA_BASE_URL || 'http://localhost:4173/',
        process.env.QA_REPORT_DIR || '.local/reports',
      );
    } finally {
      await browser.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
