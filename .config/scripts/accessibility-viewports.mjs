import { createRequire } from "node:module";

const puppeteer = createRequire(
  "/usr/local/lib/node_modules/pa11y-ci/package.json",
)("puppeteer");

export default async function accessibilityViewports(audits, defaults) {
  const browser = await puppeteer.launch(defaults.chromeLaunchConfig);
  const heights = new Map();
  try {
    const page = await browser.newPage();
    await page.setViewport(defaults.viewport);
    for (const audit of audits) {
      if (!heights.has(audit.url)) {
        await page.goto(audit.url, { waitUntil: "networkidle2" });
        await page.evaluate(() => document.fonts.ready);
        heights.set(
          audit.url,
          await page.evaluate(() => document.documentElement.scrollHeight),
        );
      }
      audit.viewport = {
        ...defaults.viewport,
        height: Math.max(defaults.viewport.height, heights.get(audit.url)),
      };
    }
  } finally {
    await browser.close();
  }
}
