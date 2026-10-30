const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readConfiguration, pagesFor } = require('./configuration.cjs');
const {
  responsiveWidths,
  applyAppearance,
  captureFromTop,
} = require('./browser-presentation.cjs');

module.exports = async function checkLinkViewBrowser(
  browser,
  baseURL,
  reportDirectory,
) {
  const config = readConfiguration();

  const base = new URL(baseURL);

  const href = (path) => {
    return new URL(path.replace(/^\//, ''), base).href;
  };

  const routes = config.language_options.flatMap(({ id }) => {
    return pagesFor(config, id)
      .filter((page) => {
        return [
          'home',
          'links-page',
        ].includes(page.type);
      })
      .map((page) => {
        return {
          ...page,
          language: id,
        };
      });
  });

  const context = await browser.createBrowserContext();

  const checks = [];

  const errors = [];

  try {
    const page = await context.newPage();

    page.on('pageerror', (error) => {
      return errors.push(error.message);
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => {
          return [
            'en-US',
          ];
        },
      });
    });
    await page.goto(href('/'), {
      waitUntil: 'networkidle0',
    });
    assert.equal(
      await page.$eval('html', (root) => {
        return root.dataset.linkView;
      }),
      'compact',
    );

    const originalURL = page.url();

    await page.focus('#link-view-compact');
    await page.keyboard.press('ArrowRight');
    assert.equal(
      await page.$eval('html', (root) => {
        return root.dataset.linkView;
      }),
      'detailed',
    );
    assert.equal(
      await page.$eval('#link-view-detailed', (input) => {
        return (
          input === document.activeElement &&
          getComputedStyle(input.nextElementSibling).outlineStyle === 'solid'
        );
      }),
      true,
    );
    assert.equal(page.url(), originalURL);
    await page.goto(href('/en/career/'), {
      waitUntil: 'networkidle0',
    });
    assert.equal(
      await page.$eval('#link-view-detailed', (input) => {
        return input.checked;
      }),
      true,
    );
    await page.reload({
      waitUntil: 'networkidle0',
    });
    assert.equal(
      await page.$eval('html', (root) => {
        return root.dataset.linkView;
      }),
      'detailed',
    );
    await page.click('[data-settings-open]');
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0',
      }),
      page.select(
        '[data-language-switcher]',
        new URL(href('/pt-br/career/')).pathname,
      ),
    ]);
    assert.equal(
      await page.$eval('html', (root) => {
        return root.dataset.linkView;
      }),
      'detailed',
    );
    await page.evaluate(() => {
      return localStorage.removeItem('guesant-links-language');
    });

    for (const route of routes) {
      await page.goto(href(route.url), {
        waitUntil: 'networkidle2',
      });

      const labels = config.locales[route.language].ui;

      assert.equal(
        await page.$eval('.link-view-control legend', (legend) => {
          return legend.textContent.trim();
        }),
        labels.link_view_label,
      );

      const initialLinks = await page.$$eval('.link-button', (links) => {
        return links.map((link) => {
          return link.href;
        });
      });

      await page.evaluate(() => {
        window.initialViewLinks = [
          ...document.querySelectorAll('.link-button'),
        ];
      });

      for (const mode of [
        'compact',
        'detailed',
      ]) {
        await page.click(`label[for="link-view-${mode}"]`);

        for (const theme of [
          'dark',
          'light',
        ]) {
          await applyAppearance(page, theme);

          for (const width of responsiveWidths) {
            await page.setViewport({
              width,
              height: 900,
            });
            await page.evaluate(() => {
              return new Promise((resolve) => {
                return requestAnimationFrame(() => {
                  return requestAnimationFrame(() => {
                    return requestAnimationFrame(resolve);
                  });
                });
              });
            });

            const actual = await page.evaluate(() => {
              const detailed =
                document.documentElement.dataset.linkView === 'detailed';

              const links = [
                ...document.querySelectorAll('.link-button'),
              ];

              const visible = (element) => {
                return element.getClientRects().length > 0;
              };

              return {
                overflow: document.documentElement.scrollWidth > innerWidth,
                stableLinks: links.every((link, index) => {
                  return link === window.initialViewLinks[index];
                }),
                checked: document.querySelector(
                  '[data-link-view-control]:checked',
                ).value,
                contentFits: links.every((link) => {
                  return link.scrollWidth <= link.clientWidth + 1;
                }),
                details: [
                  ...document.querySelectorAll(
                    '.link-url,.link-description,.link-badge,.statistics,.link-visual',
                  ),
                ].every((element) => {
                  return visible(element) === detailed;
                }),
                columns: [
                  ...document.querySelectorAll('.link-list,.category-preview'),
                ].every((list) => {
                  return (
                    getComputedStyle(list).gridTemplateColumns.split(' ')
                      .length === 1
                  );
                }),
                fullWidth: [
                  ...document.querySelectorAll('.category-card'),
                ].every((card) => {
                  const style = getComputedStyle(card);

                  const available =
                    card.clientWidth -
                    parseFloat(style.paddingLeft) -
                    parseFloat(style.paddingRight);

                  return (
                    getComputedStyle(card).gridTemplateColumns.split(' ')
                      .length === 1 &&
                    Math.abs(
                      card
                        .querySelector('.category-links')
                        .getBoundingClientRect().width - available,
                    ) < 1
                  );
                }),
                categoryHeaderLayout: [
                  ...document.querySelectorAll('.category-summary'),
                ].every((summary) => {
                  const icon = summary
                    .querySelector('.category-icon')
                    .getBoundingClientRect();

                  const title = summary
                    .querySelector('.category-title')
                    .getBoundingClientRect();

                  const heading = summary
                    .querySelector('.category-heading')
                    .getBoundingClientRect();

                  const copy = summary
                    .querySelector('.category-copy')
                    ?.getBoundingClientRect();

                  const rect = summary.getBoundingClientRect();

                  const style = getComputedStyle(summary);

                  const contentLeft = rect.left + parseFloat(style.paddingLeft);

                  const contentWidth =
                    summary.clientWidth -
                    parseFloat(style.paddingLeft) -
                    parseFloat(style.paddingRight);

                  return (
                    getComputedStyle(summary).gridTemplateColumns.split(' ')
                      .length === 1 &&
                    Math.abs(
                      heading.left +
                        heading.width / 2 -
                        contentLeft -
                        contentWidth / 2,
                    ) < 1 &&
                    icon.bottom <= title.top &&
                    Math.abs(
                      icon.left + icon.width / 2 - title.left - title.width / 2,
                    ) < 1 &&
                    (!copy ||
                      (heading.bottom <= copy.top &&
                        Math.abs(copy.width - contentWidth) < 1 &&
                        getComputedStyle(
                          summary.querySelector('.category-copy'),
                        ).textAlign === 'center'))
                  );
                }),
                linksIndependent: [
                  ...document.querySelectorAll('.category-preview-link'),
                ].every((link) => {
                  return (
                    link.parentElement.matches('li') &&
                    link.parentElement.closest('a') === null
                  );
                }),
                editorialDestinations: [
                  ...document.querySelectorAll(
                    '.editorial-entry:has(.editorial-details)',
                  ),
                ].every((entry) => {
                  return (
                    new URL(entry.querySelector(':is(h3,h5) a').href)
                      .hostname === 'curriculum.guesant.net' &&
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
                    visible(entry.querySelector('.editorial-details')) &&
                    Boolean(
                      entry.querySelector(
                        '.editorial-details .link-third-party-badge',
                      ),
                    )
                  );
                }),
                editorialBorders: [
                  ...document.querySelectorAll('.editorial-group-items'),
                ].every((group) => {
                  return (
                    parseFloat(getComputedStyle(group).borderBottomWidth) > 0
                  );
                }),
                editorialSummaries: [
                  ...document.querySelectorAll(
                    '.editorial-entry:is([data-editorial-type="skill"],[data-editorial-type="project"]) .editorial-description',
                  ),
                ].every(visible),
                numericFit: [
                  ...document.querySelectorAll('.statistic dd'),
                ]
                  .filter(visible)
                  .every((element) => {
                    const range = document.createRange();

                    range.selectNodeContents(element.firstChild);

                    return range.getClientRects().length === 1;
                  }),
                rails: [
                  ...document.querySelectorAll('.suspension-body'),
                ].every((body) => {
                  if (!visible(body)) {
                    return true;
                  }

                  const top = body.getBoundingClientRect().top;

                  const anchors = [
                    ...document.querySelectorAll('[data-rail-anchor]'),
                  ];

                  const gap = parseFloat(
                    getComputedStyle(
                      document.querySelector('.suspended-content'),
                    ).rowGap,
                  );

                  return [
                    ...body.querySelectorAll('[data-rail-lantern]'),
                  ].every((lamp) => {
                    const anchor = anchors[Number(lamp.dataset.railLantern)];

                    return (
                      !anchor ||
                      Math.abs(
                        parseFloat(
                          lamp.style.getPropertyValue(
                            '--rail-lantern-position',
                          ),
                        ) -
                          (anchor.getBoundingClientRect().bottom +
                            gap / 2 -
                            top),
                      ) < 1
                    );
                  });
                }),
              };
            });

            assert.equal(
              actual.overflow,
              false,
              `${route.url} ${mode} ${theme} ${width} overflow`,
            );
            assert.equal(actual.checked, mode);

            for (const key of [
              'stableLinks',
              'contentFits',
              'details',
              'columns',
              'fullWidth',
              'categoryHeaderLayout',
              'editorialBorders',
              'editorialSummaries',
              'linksIndependent',
              'editorialDestinations',
              'numericFit',
              'rails',
            ]) {
              assert.equal(
                actual[key],
                true,
                `${route.url} ${mode} ${theme} ${width} ${key}`,
              );
            }

            checks.push({
              path: route.url,
              mode,
              theme,
              width,
            });

            if (
              route.language === 'pt-br' &&
              [
                'home',
                'career',
                'code',
              ].includes(route.id) &&
              [
                390,
                1440,
              ].includes(width)
            ) {
              await captureFromTop(
                page,
                `${reportDirectory}/view-${route.id}-${mode}-${theme}-${width}.png`,
              );
            }
          }
        }

        assert.deepEqual(
          await page.$$eval('.link-button', (links) => {
            return links.map((link) => {
              return link.href;
            });
          }),
          initialLinks,
        );
      }
    }

    await page.goto(href('/en/code/'), {
      waitUntil: 'networkidle0',
    });

    for (const mode of [
      'compact',
      'detailed',
    ]) {
      await page.click(`label[for="link-view-${mode}"]`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
        window.viewLongText = [
          ...document.querySelectorAll('.link-title,.link-description'),
        ].map((element) => {
          return [
            element,
            element.textContent,
          ];
        });

        for (const [
          element,
          text,
        ] of window.viewLongText) {
          element.textContent = text.repeat(4);
        }
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
        assert.equal(
          await page.evaluate(() => {
            return document.documentElement.scrollWidth > innerWidth;
          }),
          false,
          `${mode} enlarged text ${width}`,
        );
      }

      await page.evaluate(() => {
        document.documentElement.style.removeProperty('font-size');

        for (const [
          element,
          text,
        ] of window.viewLongText) {
          element.textContent = text;
        }
      });
    }

    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }

  for (const blocked of [
    false,
    true,
  ]) {
    const isolated = await browser.createBrowserContext();

    try {
      const page = await isolated.newPage();

      await page.evaluateOnNewDocument((blocked) => {
        if (blocked) {
          Object.defineProperty(window, 'localStorage', {
            get() {
              throw new Error('Storage blocked');
            },
          });
        } else {
          localStorage.setItem('guesant-links-view', 'invalid');
        }
      }, blocked);
      await page.goto(href('/pt-br/career/'), {
        waitUntil: 'networkidle0',
      });
      assert.equal(
        await page.$eval('html', (root) => {
          return root.dataset.linkView;
        }),
        'compact',
      );
      await page.click('label[for=link-view-detailed]');
      assert.equal(
        await page.$eval('html', (root) => {
          return root.dataset.linkView;
        }),
        'detailed',
      );
    } finally {
      await isolated.close();
    }
  }

  const noJS = await browser.createBrowserContext();

  try {
    const page = await noJS.newPage();

    await page.setJavaScriptEnabled(false);

    for (const route of [
      '/en/',
      '/en/career/',
    ]) {
      await page.goto(href(route), {
        waitUntil: 'networkidle0',
      });
      assert.equal(
        await page.$eval('.link-view-control', (control) => {
          return control.getClientRects().length;
        }),
        0,
      );
      assert.equal(
        await page.$eval('html', (root) => {
          return root.dataset.linkView;
        }),
        'compact',
      );
      assert.equal(
        await page.$eval('.link-description', (element) => {
          return element.getClientRects().length;
        }),
        0,
      );
    }
  } finally {
    await noJS.close();
  }

  fs.writeFileSync(
    `${reportDirectory}/link-view-checks.json`,
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
      linkViewChecks: checks.length,
      failures: errors,
    }),
  );
};
