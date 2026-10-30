const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { readConfiguration } = require('./configuration.cjs');

const viewports = [
  {
    width: 320,
    height: 568,
  },
  {
    width: 390,
    height: 844,
  },
  {
    width: 768,
    height: 900,
  },
  {
    width: 1024,
    height: 768,
  },
  {
    width: 1440,
    height: 900,
  },
  {
    width: 844,
    height: 390,
  },
];

async function bootPresentation(page, theme) {
  await page.evaluate((appearance) => {
    document.documentElement.dataset.theme = appearance;

    const dialog = document.getElementById('bios-dialog');

    if (!dialog.open) {
      dialog.showModal();
    }

    dialog.focus({
      preventScroll: true,
    });

    for (const line of dialog.querySelectorAll('[hidden]')) {
      line.hidden = false;
    }

    dialog.querySelector('[data-bios-progress]').textContent = '██████████';
  }, theme);
  await page.evaluate(() => {
    return document.fonts.ready;
  });

  return page.evaluate(() => {
    const dialog = document.getElementById('bios-dialog');

    const box = dialog.getBoundingClientRect();

    const selectors = [
      '#bios-dialog',
      '.bios-screen',
      '.bios-header',
      '#bios-title',
      '.bios-status-badge',
      '.bios-post',
      '.bios-footer',
      '[data-bios-skip]',
      '.bios-build-stamp',
    ];

    const properties = [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'color',
      'backgroundColor',
      'backgroundImage',
      'borderImageSource',
      'boxShadow',
      'textShadow',
      'cursor',
    ];

    const styles = selectors.map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));

      return Object.fromEntries(
        properties.map((property) => {
          return [
            property,
            style[property],
          ];
        }),
      );
    });

    return {
      styles,
      fullscreen:
        box.x === 0 &&
        box.y === 0 &&
        Math.abs(box.width - innerWidth) < 1 &&
        Math.abs(box.height - innerHeight) < 1,
      covered: [
        [
          1,
          1,
        ],
        [
          innerWidth - 2,
          1,
        ],
        [
          1,
          innerHeight - 2,
        ],
      ].every(
        ([
          x,
          y,
        ]) => {
          return dialog.contains(document.elementFromPoint(x, y));
        },
      ),
      backdrop: getComputedStyle(dialog, '::backdrop').backgroundColor,
      hiddenStatus:
        document.getElementById('bios-status').getBoundingClientRect().width <
        2,
      horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
    };
  });
}

function assertPresentation(actual) {
  assert(actual.fullscreen, 'boot covers the entire viewport');
  assert(actual.covered, 'the site cannot show through the boot screen');
  assert(actual.hiddenStatus);
  assert.equal(actual.horizontalOverflow, false);
  assert.equal(actual.backdrop, 'rgb(0, 0, 0)');
  assert.equal(actual.styles[0].backgroundColor, 'rgb(0, 0, 0)');

  for (const style of actual.styles) {
    assert.match(style.fontFamily, /JetBrains Mono/);
    assert.equal(style.cursor, 'default');
    assert.equal(style.borderImageSource, 'none');
    assert.equal(style.backgroundImage, 'none');
    assert.equal(style.boxShadow, 'none');
    assert.equal(style.textShadow, 'none');
  }
}

async function assertBootClosed(page) {
  const open = await page.$eval('#bios-dialog', (dialog) => {
    return dialog.open;
  });

  assert.equal(open, false);
}

async function rebootLifecycle(page, url) {
  await page.goto(url, {
    waitUntil: 'networkidle2',
  });
  await Promise.all([
    page.waitForNavigation({
      waitUntil: 'domcontentloaded',
    }),
    page.click('[data-reboot]'),
  ]);
  await page.waitForFunction(() => {
    return document.getElementById('bios-dialog').open;
  });
  assert.equal(page.url(), url);
  assertPresentation(await bootPresentation(page, 'light'));
  await page.keyboard.press('Tab');
  assert.equal(
    await page.$eval('[data-bios-skip]', (button) => {
      return button === document.activeElement;
    }),
    true,
  );
  await page.keyboard.press('Escape');
  await assertBootClosed(page);
  await page.reload({
    waitUntil: 'networkidle2',
  });
  await assertBootClosed(page);
  await page.goto(`${url.split('#')[0]}&lobby-boot=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.click('[data-bios-skip]');
  await assertBootClosed(page);
  await page.goto(`${url.split('#')[0]}&lobby-boot=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => {
      return !document.getElementById('bios-dialog').open;
    },
    {
      timeout: 5000,
    },
  );
}

function biosRoutes(baseURL) {
  return readConfiguration().language_options.flatMap((language) => {
    return [
      '',
      'terminal/',
    ].map((prefix) => {
      return {
        language: language.id,
        interfaceName: prefix.replace('/', '') || 'minecraft',
        url: new URL(`${language.path.slice(1)}${prefix}career/`, baseURL).href,
      };
    });
  });
}

async function inspectPresentations(page, route, directory, fingerprints) {
  await page.goto(route.url, {
    waitUntil: 'networkidle2',
  });

  for (const viewport of viewports) {
    await page.setViewport(viewport);

    for (const theme of [
      'light',
      'dark',
    ]) {
      const actual = await bootPresentation(page, theme);

      assertPresentation(actual);

      const key = `${route.language}-${viewport.width}`;

      if (fingerprints.has(key)) {
        assert.deepEqual(
          actual.styles,
          fingerprints.get(key),
          'boot styles do not depend on the interface or appearance',
        );
      }

      fingerprints.set(key, actual.styles);

      if (
        route.language === 'pt-br' &&
        [
          390,
          1440,
        ].includes(viewport.width)
      ) {
        await page.screenshot({
          path: resolve(
            directory,
            `${route.interfaceName}-${theme}-${viewport.width}.png`,
          ),
        });
      }
    }
  }

  return viewports.length * 2;
}

module.exports = async function checkBiosBrowser(
  browser,
  baseURL,
  reportDirectory,
) {
  const context = await browser.createBrowserContext();

  const directory = resolve(reportDirectory, 'bios');

  const fingerprints = new Map();

  let presentations = 0;

  await mkdir(directory, {
    recursive: true,
  });

  try {
    const page = await context.newPage();

    for (const route of biosRoutes(baseURL)) {
      presentations += await inspectPresentations(
        page,
        route,
        directory,
        fingerprints,
      );
    }

    for (const prefix of [
      '',
      'terminal/',
    ]) {
      await page.setViewport({
        width: 390,
        height: 844,
      });

      const url = new URL(
        `pt-br/${prefix}career/?verify=bios#main-content`,
        baseURL,
      ).href;

      await rebootLifecycle(page, url);
      await page.emulateMediaFeatures([
        {
          name: 'prefers-reduced-motion',
          value: 'reduce',
        },
      ]);
      await page.goto(`${url.split('#')[0]}&lobby-boot=1`, {
        waitUntil: 'networkidle2',
      });
      await assertBootClosed(page);
      await page.emulateMediaFeatures([]);
    }

    await page.setJavaScriptEnabled(false);
    await page.goto(new URL('pt-br/?lobby-boot=1', baseURL).href, {
      waitUntil: 'networkidle2',
    });
    await assertBootClosed(page);
    await writeFile(
      resolve(directory, 'checks.json'),
      JSON.stringify(
        {
          presentations,
          lifecycle: true,
          noJavaScript: true,
        },
        null,
        2,
      ),
    );
    console.log(
      `BIOS: ${presentations} fullscreen presentations, independent styles and Reboot lifecycle passed.`,
    );
  } finally {
    await context.close();
  }
};
