import { createRequire } from 'node:module';

const puppeteer = createRequire(
  '/usr/local/lib/node_modules/pa11y-ci/package.json',
)('puppeteer');

export default async function accessibilityViewports(audits, defaults) {
  const browser = await puppeteer.launch(defaults.chromeLaunchConfig);

  const heights = new Map();

  try {
    const page = await browser.newPage();

    await page.setViewport(defaults.viewport);

    for (const audit of audits) {
      const resolveView = () => {
        if (
          audit.actions?.includes(
            'click element label[for="link-view-detailed"]',
          )
        ) {
          return 'detailed';
        }

        return 'compact';
      };

      const view = resolveView();

      const key = `${audit.url}:${view}`;

      if (!heights.has(key)) {
        await page.goto(audit.url, { waitUntil: 'networkidle2' });
        await page.evaluate((view) => {
          document.documentElement.dataset.linkView = view;
        }, view);
        await page.evaluate(() => {
          return document.fonts.ready;
        });
        heights.set(
          key,
          await page.evaluate(() => {
            return document.documentElement.scrollHeight;
          }),
        );
      }

      audit.viewport = {
        ...defaults.viewport,
        height: Math.max(defaults.viewport.height, heights.get(key)),
      };
    }
  } finally {
    await browser.close();
  }
}
