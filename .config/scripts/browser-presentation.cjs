const { createRequire } = require('node:module');

const responsiveWidths = [
  320,
  390,
  768,
  1024,
  1440,
];

async function useBrowserLanguages(
  page,
  languages = [
    'en-US',
  ],
) {
  await page.evaluateOnNewDocument((values) => {
    Object.defineProperty(navigator, 'languages', {
      get: () => {
        return values;
      },
    });
  }, languages);
}

async function applyAppearance(page, appearance) {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, appearance);
}

async function captureFromTop(page, path) {
  await page.evaluate(() => {
    document.activeElement?.blur();
    scrollTo(0, 0);
  });
  await page.screenshot({
    path,
    fullPage: true,
  });
}

function editorialDestinations(entries) {
  return entries.every((entry) => {
    const primary = entry.querySelector('.editorial-primary');

    const repository = entry.querySelector('.editorial-details');

    return (
      new URL(primary.href).hostname === 'curriculum.guesant.net' &&
      [
        'github.com',
        'gitlab.com',
        'www.youtube.com',
        'youtube.com',
        'youtu.be',
      ].includes(new URL(repository.href).hostname) &&
      repository.getClientRects().length > 0 &&
      Boolean(repository.querySelector('.link-third-party-badge'))
    );
  });
}

async function withBrowser(task) {
  const puppeteer = createRequire(
    '/usr/local/lib/node_modules/pa11y-ci/package.json',
  )('puppeteer');

  const launchOptions = {
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  };

  const browser = await puppeteer.launch(launchOptions);

  try {
    return await task(browser);
  } finally {
    await browser.close();
  }
}

module.exports = {
  editorialDestinations,
  withBrowser,
  responsiveWidths,
  useBrowserLanguages,
  applyAppearance,
  captureFromTop,
};
