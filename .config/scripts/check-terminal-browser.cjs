const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { readConfiguration, pagesFor } = require('./configuration.cjs');

const pa11y = createRequire(
  '/usr/local/lib/node_modules/pa11y-ci/package.json',
)('pa11y');

module.exports = async function checkTerminalBrowser(
  browser,
  baseURL,
  reportDirectory,
) {
  const config = readConfiguration();

  const context = await browser.createBrowserContext();

  const checks = [];

  const errors = [];

  const accessibility = [];

  const url = (path) => {
    return new URL(path.replace(/^\//, ''), baseURL).href;
  };

  try {
    const page = await context.newPage();

    page.on('pageerror', (error) => {
      return errors.push(error.message);
    });

    for (const language of config.language_options) {
      for (const route of pagesFor(config, language.id).filter((entry) => {
        return !entry.fallback;
      })) {
        const resolvePath = () => {
          if (route.id === 'home') {
            return '';
          }

          return `${route.id}/`;
        };

        const path = `${language.path}terminal/${resolvePath()}`;

        assert.equal(
          (await page.goto(url(path), { waitUntil: 'networkidle2' })).status(),
          200,
          path,
        );
        await page.evaluate(() => {
          return document.fonts.ready;
        });
        assert.equal(
          await page.$eval('html', (root) => {
            return root.dataset.interface;
          }),
          'terminal',
        );
        assert.equal(
          await page.$(
            '.site-frame,.suspension-rails,.quick-access,.world-scene',
          ),
          null,
        );
        assert.equal(
          await page.$$eval('h1', (elements) => {
            return elements.length;
          }),
          1,
        );
        assert.deepEqual(
          await page.$$eval('.language-select option', (options) => {
            return options.map((option) => {
              return new URL(option.value, location.href).pathname;
            });
          }),
          config.language_options.map((option) => {
            const resolveValue = () => {
              if (
                route.id === 'home' ||
                (route.id === 'now' && !config.now[option.id])
              ) {
                return '';
              }

              return `${route.id}/`;
            };

            return `${option.path}terminal/${resolveValue()}`;
          }),
        );
        assert.equal(
          await page.$eval('#bios-dialog', (dialog) => {
            return dialog.open;
          }),
          false,
        );

        const styles = await page.$$eval('link[rel="stylesheet"]', (links) => {
          return links.map((link) => {
            return link.href;
          });
        });

        assert(
          styles.some((href) => {
            return href.endsWith('/assets/css/terminal.css');
          }),
        );

        const initial = await page.$$eval(
          '[data-link-id],[data-editorial-id]',
          (items) => {
            return items.map((item) => {
              return item.dataset.linkId || item.dataset.editorialId;
            });
          },
        );

        assert.equal(
          await page.$$eval(
            '.editorial-entry:has(.editorial-details)',
            (entries) => {
              return entries.every((entry) => {
                return (
                  new URL(entry.querySelector('h3 a').href).hostname ===
                    'curriculum.guesant.net' &&
                  [
                    'github.com',
                    'gitlab.com',
                    'www.youtube.com',
                    'youtube.com',
                    'youtu.be',
                  ].includes(
                    new URL(entry.querySelector('.editorial-details').href)
                      .hostname,
                  ) &&
                  Boolean(
                    entry.querySelector(
                      '.editorial-details .link-third-party-badge',
                    ),
                  )
                );
              });
            },
          ),
          true,
          `${path} curriculum and platform destinations`,
        );

        for (const mode of ['compact', 'detailed']) {
          if (route.type !== 'now') {
            await page.click(`label[for="link-view-${mode}"]`);
          }

          for (const theme of ['light', 'dark']) {
            await page.evaluate((value) => {
              document.documentElement.dataset.theme = value;
            }, theme);

            for (const width of [320, 390, 768, 1024, 1440]) {
              await page.setViewport({ width, height: 900 });
              await page.evaluate(() => {
                return new Promise((resolve) => {
                  return requestAnimationFrame(() => {
                    return requestAnimationFrame(resolve);
                  });
                });
              });

              const actual = await page.evaluate(() => {
                return {
                  overflow: document.documentElement.scrollWidth > innerWidth,
                  font: getComputedStyle(document.body).fontFamily,
                  skipHidden:
                    document.querySelector('.skip-link').getBoundingClientRect()
                      .bottom <= 0,
                  nestedLinks: Boolean(document.querySelector('a a')),
                  thirdPartyBadges: [
                    ...document.querySelectorAll(
                      '.terminal-third-party-badge,.link-third-party-badge',
                    ),
                  ].every((badge) => {
                    return (
                      parseFloat(getComputedStyle(badge).fontSize) >= 12 &&
                      getComputedStyle(badge).whiteSpace === 'nowrap'
                    );
                  }),
                  ids: [
                    ...document.querySelectorAll(
                      '[data-link-id],[data-editorial-id]',
                    ),
                  ].map((item) => {
                    return item.dataset.linkId || item.dataset.editorialId;
                  }),
                };
              });

              assert.equal(
                actual.overflow,
                false,
                `${path} ${width}/${theme}/${mode} overflow`,
              );
              assert.match(actual.font, /JetBrains Mono/);
              assert(
                actual.skipHidden,
                `${path} skip link remains visible without focus`,
              );
              assert.equal(actual.nestedLinks, false);
              assert.equal(actual.thirdPartyBadges, true);
              assert.deepEqual(actual.ids, initial);
              checks.push({ path, width, theme, mode });
            }
          }
        }

        if (route.id === 'home' && language.id === 'pt-br') {
          for (const mode of ['compact', 'detailed']) {
            await page.click(`label[for="link-view-${mode}"]`);

            for (const theme of ['light', 'dark']) {
              await page.evaluate((value) => {
                document.documentElement.dataset.theme = value;
              }, theme);

              for (const width of [390, 1440]) {
                await page.setViewport({ width, height: 900 });
                await page.evaluate(() => {
                  return scrollTo(0, 0);
                });
                await page.screenshot({
                  path: `${reportDirectory}/terminal-${mode}-${theme}-${width}.png`,
                });
              }
            }
          }
        }

        if (['home', 'career', 'code', 'now'].includes(route.id)) {
          for (const theme of ['light', 'dark']) {
            await page.evaluate((value) => {
              document.documentElement.dataset.theme = value;
            }, theme);

            const result = await pa11y(url(path), {
              browser,
              page,
              ignoreUrl: true,
              runners: ['axe', 'htmlcs'],
              standard: 'WCAG2AA',
              levelCapWhenNeedsReview: 'warning',
              viewport: {
                width: 1440,
                height: await page.evaluate(() => {
                  return Math.max(900, document.documentElement.scrollHeight);
                }),
              },
            });

            const issues = result.issues.filter((issue) => {
              return issue.type === 'error';
            });

            accessibility.push({ path, theme, issues });
            fs.writeFileSync(
              `${reportDirectory}/terminal-accessibility.json`,
              JSON.stringify(accessibility, null, 2),
            );
            assert.deepEqual(issues, [], `${path} ${theme} accessibility`);
          }
        }
      }
    }

    await page.goto(url('pt-br/career/?verify=terminal#main-content'), {
      waitUntil: 'networkidle2',
    });
    await page.click('[data-settings-open]');
    await page.click('label[for="theme-light"]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('label[for="interface-terminal"]'),
    ]);
    assert.equal(new URL(page.url()).pathname, '/pt-br/terminal/career/');
    assert.equal(new URL(page.url()).search, '?verify=terminal');
    assert.equal(new URL(page.url()).hash, '#main-content');
    assert.equal(
      await page.$eval('html', (root) => {
        return root.dataset.theme;
      }),
      'light',
    );
    await page.keyboard.press('Escape');
    assert.equal(
      await page.$eval('#bios-dialog', (dialog) => {
        return dialog.open;
      }),
      false,
    );
    await page.reload({ waitUntil: 'networkidle2' });
    assert.equal(
      await page.$eval('#bios-dialog', (dialog) => {
        return dialog.open;
      }),
      false,
    );
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click('[data-reboot]'),
    ]);
    assert.equal(
      await page.$eval('#bios-dialog', (dialog) => {
        return dialog.open;
      }),
      true,
    );
    assert.equal(new URL(page.url()).search, '?verify=terminal');
    assert.equal(new URL(page.url()).hash, '#main-content');
    await page.keyboard.press('Escape');
    await page.emulateMediaFeatures([
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await page.goto(url('pt-br/terminal/?lobby-boot=1'), {
      waitUntil: 'networkidle2',
    });
    assert.equal(
      await page.$eval('#bios-dialog', (dialog) => {
        return dialog.open;
      }),
      false,
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await page.$eval('.skip-link', (link) => {
        return (
          link === document.activeElement &&
          link.getBoundingClientRect().top >= 0
        );
      }),
      true,
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${reportDirectory}/terminal-checks.json`,
      JSON.stringify({ checks, errors }, null, 2),
    );
    console.log(
      `Terminal: ${checks.length} responsive checks and interface/BIOS lifecycle passed`,
    );
  } finally {
    await context.close();
  }
};
