const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { readConfiguration } = require('./configuration.cjs');

const widths = [320, 390, 768, 1024, 1440];

async function inspectControlReadiness(context, baseURL, minecraft) {
  const page = await context.newPage();

  try {
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (!request.url().endsWith('/assets/js/link-view.js')) {
        return request.continue();
      }
    });

    const script = page.waitForRequest((request) => {
      return request.url().endsWith('/assets/js/link-view.js');
    });

    const resolveNavigation = () => {
      if (minecraft) {
        return '';
      }

      return 'terminal/';
    };

    const navigation = page.goto(
      new URL(`pt-br/${resolveNavigation()}code/`, baseURL).href,
      { waitUntil: 'domcontentloaded' },
    );

    const request = await script;

    await page.waitForSelector('.link-view-control');
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    const initial = await page.$eval('.link-view-control', (element) => {
      return {
        box: element.getBoundingClientRect().toJSON(),
        visibility: getComputedStyle(element).visibility,
      };
    });

    assert(
      initial.box.height > 0,
      'uninitialized controls reserve their layout space',
    );
    assert.equal(initial.visibility, 'hidden');
    await request.continue();
    await navigation;
    await page.waitForFunction(() => {
      return document.documentElement.dataset.linkViewReady === 'true';
    });

    const ready = await page.$eval('.link-view-control', (element) => {
      return {
        box: element.getBoundingClientRect().toJSON(),
        visibility: getComputedStyle(element).visibility,
      };
    });

    assert.deepEqual(
      ready.box,
      initial.box,
      'enabling controls must not move content',
    );
    assert.equal(ready.visibility, 'visible');
  } finally {
    await page.close();
  }
}

async function inspectComponents(page, expected, minecraft) {
  const actual = await page.evaluate(
    ({ expected, minecraft }) => {
      const badges = [
        ...document.querySelectorAll(
          '.link-third-party-badge, .terminal-third-party-badge',
        ),
      ];

      const links = [...document.querySelectorAll('.link-button')];

      const own = (url) => {
        return expected.domains.some((domain) => {
          return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
        });
      };

      const badgesCorrect =
        badges.length > 0 &&
        badges.every((badge) => {
          return badge.textContent.trim() === expected.label;
        });

      const ownershipCorrect = links.every((link) => {
        const url = new URL(link.href);

        const thirdParty =
          /^https?:/i.test(link.getAttribute('href')) && !own(url);

        return (
          Boolean(link.querySelector('.link-third-party-badge')) === thirdParty
        );
      });

      if (!minecraft) {
        return {
          badgesCorrect,
          ownershipCorrect,
          independent: !document.querySelector(
            '.site-frame,.quick-contact-link,.profile-avatar',
          ),
        };
      }

      const avatar = document
        .querySelector('.profile-avatar')
        .textContent.trim();

      const frames = [...document.querySelectorAll('.quick-contact-link')].map(
        (link) => {
          const style = getComputedStyle(link);

          const iconStyle = getComputedStyle(
            link.querySelector('.quick-contact-icon'),
          );

          return {
            source: style.borderImageSource,
            width: parseFloat(style.borderTopWidth),
            repeat: style.borderImageRepeat,
            background: style.backgroundColor,
            innerBorder: iconStyle.borderTopWidth,
            innerBackground: iconStyle.backgroundColor,
          };
        },
      );

      const icons = [
        ...document.querySelectorAll(
          '.section-menu .site-icon, .statistic dt .site-icon',
        ),
      ]
        .filter((icon) => {
          return icon.getClientRects().length;
        })
        .map((icon) => {
          const box = icon.getBoundingClientRect();

          return {
            width: box.width,
            height: box.height,
            wrapped: icon.parentElement.classList.contains('button-icon'),
          };
        });

      const activeCheck = Boolean(
        document.querySelector(
          '.section-menu-link[aria-current="page"] .navigation-check .button-icon',
        ),
      );

      const shortcuts = document.querySelector('.quick-contacts');

      const shortcutsBox = shortcuts.getBoundingClientRect();

      const profileBox = document
        .querySelector('.profile')
        .getBoundingClientRect();

      const uptimeBox = document
        .querySelector('.profile-uptime')
        .getBoundingClientRect();

      const navigation = document.querySelector('.page-navigation');

      const homeBox = navigation
        .querySelector('.navigation-home')
        .getBoundingClientRect();

      const sectionsBox = navigation
        .querySelector('.section-switcher-trigger')
        .getBoundingClientRect();

      return {
        badgesCorrect,
        ownershipCorrect,
        avatar,
        frames,
        icons,
        activeCheck,
        shortcutsInHeader:
          shortcuts.closest('.profile') !== null &&
          shortcuts.children.length === 8 &&
          shortcutsBox.top >= uptimeBox.bottom &&
          shortcutsBox.bottom <= profileBox.bottom &&
          shortcutsBox.left >= profileBox.left &&
          shortcutsBox.right <= profileBox.right,
        navigationSeparated:
          !navigation.querySelector('.quick-contacts') &&
          !document.querySelector('.quick-access .section-toolbar') &&
          navigation.querySelectorAll(':scope > a, :scope > details').length ===
            2,
        navigationAligned:
          Math.abs(homeBox.width - sectionsBox.width) < 1 &&
          Math.abs(homeBox.top - sectionsBox.top) < 1 &&
          Math.abs(homeBox.height - sectionsBox.height) < 1,
      };
    },
    { expected, minecraft },
  );

  assert.equal(actual.badgesCorrect, true, 'translated text in every badge');
  assert.equal(actual.ownershipCorrect, true, 'badges match domain ownership');

  if (!minecraft) {
    assert.equal(
      actual.independent,
      true,
      'Terminal has no Minecraft structure',
    );

    return;
  }

  assert.equal(actual.avatar, 'GA');
  assert.equal(
    actual.shortcutsInHeader,
    true,
    'eight shortcuts below uptime inside header',
  );
  assert.equal(
    actual.navigationSeparated,
    true,
    'navigation only contains Home and Sections',
  );
  assert.equal(
    actual.navigationAligned,
    true,
    'navigation controls share equal columns and height',
  );
  assert(actual.frames.length > 0);

  for (const frame of actual.frames) {
    assert.match(frame.source, /oak-frame/);
    assert(frame.width > 0);
    assert.equal(frame.repeat, 'repeat');
    assert.equal(frame.background, 'rgba(0, 0, 0, 0)');
    assert.equal(frame.innerBorder, '0px');
    assert.equal(frame.innerBackground, 'rgba(0, 0, 0, 0)');
  }

  assert(actual.icons.length > 0);

  for (const icon of actual.icons) {
    assert.equal(icon.wrapped, true);
    assert(icon.width > 0);
    assert(Math.abs(icon.width - icon.height) < 0.5, JSON.stringify(icon));
  }

  assert.equal(actual.activeCheck, true);
}

async function setPresentation(page, theme, view) {
  await page.evaluate(
    ({ theme, view }) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.linkView = view;
      document.querySelector('.section-switcher')?.setAttribute('open', '');
    },
    { theme, view },
  );
  await page.evaluate(() => {
    return new Promise((accept) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(accept);
      });
    });
  });
}

async function captureComponents(page, directory, name, minecraft) {
  await page.evaluate(() => {
    scrollTo(0, 0);
  });
  await page.screenshot({ path: resolve(directory, `${name}-header.png`) });

  if (minecraft) {
    await page.$eval('.section-switcher', (element) => {
      element.open = false;
    });
  }

  await page.$eval('.content-link-group, .terminal-link-list', (element) => {
    element.scrollIntoView({ block: 'start' });
  });
  await page.screenshot({ path: resolve(directory, `${name}-links.png`) });
  await page.evaluate(() => {
    scrollTo(0, 0);
  });

  if (minecraft) {
    await page.$eval('.section-switcher', (element) => {
      element.open = true;
    });
  }
}

async function inspectRoute(
  page,
  baseURL,
  route,
  expected,
  directory,
  screenshots,
) {
  const response = await page.goto(new URL(route.path, baseURL).href, {
    waitUntil: 'networkidle0',
  });

  assert.equal(response.status(), 200, route.path);
  await page.evaluate(() => {
    return document.fonts.ready;
  });

  const checks = [];

  for (const width of widths) {
    await page.setViewport({ width, height: 900 });

    for (const theme of ['dark', 'light']) {
      for (const view of ['compact', 'detailed']) {
        await setPresentation(page, theme, view);
        await inspectComponents(page, expected, route.minecraft);

        const resolveName = () => {
          if (route.minecraft) {
            return 'minecraft';
          }

          return 'terminal';
        };

        const name = `${route.language}-${resolveName()}-${route.id}-${width}-${theme}-${view}`;

        if (screenshots && route.language === 'pt-br') {
          await captureComponents(page, directory, name, route.minecraft);
        }

        checks.push(name);
      }
    }
  }

  return checks;
}

async function inspectNavigation(page, baseURL, minecraft, expected) {
  const resolvePrefix = () => {
    if (minecraft) {
      return '';
    }

    return 'terminal/';
  };

  const prefix = `pt-br/${resolvePrefix()}`;

  await page.goto(new URL(prefix, baseURL).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    window.componentParityNavigation = true;
    document.querySelector('.section-switcher')?.setAttribute('open', '');
  });

  const resolveSelector = () => {
    if (minecraft) {
      return '.section-menu-link[data-navigation-page="career"]';
    }

    return '.terminal-navigation a[href$="/career/"]';
  };

  const selector = resolveSelector();

  await page.click(selector);
  await page.waitForFunction(() => {
    return document.documentElement.dataset.page === 'career';
  });
  assert.equal(
    await page.evaluate(() => {
      return window.componentParityNavigation;
    }),
    true,
    'internal navigation stays client-side',
  );
  await page.evaluate(() => {
    document.querySelector('.section-switcher')?.setAttribute('open', '');
  });
  await inspectComponents(page, expected, minecraft);
}

function componentRoutes(config) {
  return config.language_options.flatMap((language) => {
    return [true, false].flatMap((minecraft) => {
      return ['home', 'career', 'code'].map((id) => {
        const resolvePath = () => {
          if (minecraft) {
            return '';
          }

          return 'terminal/';
        };

        const resolvePath1 = () => {
          if (id === 'home') {
            return '';
          }

          return `${id}/`;
        };

        return {
          path: `${language.path.slice(1)}${resolvePath()}${resolvePath1()}`,
          language: language.id,
          minecraft,
          id,
          expected: {
            label: config.locales[language.id].ui.third_party,
            domains: config.site.first_party_domains,
          },
        };
      });
    });
  });
}

async function checkComponentParity(
  browser,
  baseURL,
  reportDirectory,
  screenshots = false,
) {
  const config = readConfiguration();

  const directory = resolve(reportDirectory, 'component-parity');

  await fs.mkdir(directory, { recursive: true });

  const context = await browser.createBrowserContext();

  const checks = [];

  try {
    for (const minecraft of [true, false]) {
      await inspectControlReadiness(context, baseURL, minecraft);
    }

    const page = await context.newPage();

    await page.setCacheEnabled(false);
    await page.emulateMediaFeatures([
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);

    for (const route of componentRoutes(config)) {
      checks.push(
        ...(await inspectRoute(
          page,
          baseURL,
          route,
          route.expected,
          directory,
          screenshots,
        )),
      );
    }

    for (const minecraft of [true, false]) {
      await inspectNavigation(page, baseURL, minecraft, {
        label: config.locales['pt-br'].ui.third_party,
        domains: config.site.first_party_domains,
      });
    }

    await page.setJavaScriptEnabled(false);

    for (const minecraft of [true, false]) {
      const resolveValue = () => {
        if (minecraft) {
          return '';
        }

        return 'terminal/';
      };

      await page.goto(new URL(`pt-br/${resolveValue()}career/`, baseURL).href, {
        waitUntil: 'networkidle0',
      });
      await page.$eval('details.section-switcher, .terminal-app', (element) => {
        element.setAttribute('open', '');
      });
      await inspectComponents(
        page,
        { label: 'Terceiros', domains: config.site.first_party_domains },
        minecraft,
      );
    }

    await fs.writeFile(
      resolve(directory, 'checks.json'),
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    console.log(
      `Component parity: ${checks.length} presentations, SPA and no-JavaScript checks passed.`,
    );
  } finally {
    await context.close();
  }
}

module.exports = checkComponentParity;

if (require.main === module) {
  const puppeteer = createRequire(
    '/usr/local/lib/node_modules/pa11y-ci/package.json',
  )('puppeteer');

  (async () => {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      await checkComponentParity(
        browser,
        process.env.QA_BASE_URL || 'http://127.0.0.1:4173/',
        process.env.QA_REPORT_DIR || '.local/reports',
        process.argv.includes('--screenshots'),
      );
    } finally {
      await browser.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
