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

module.exports = {
  responsiveWidths,
  useBrowserLanguages,
  applyAppearance,
  captureFromTop,
};
