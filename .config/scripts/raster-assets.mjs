import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const puppeteer = createRequire(
  '/usr/local/lib/node_modules/pa11y-ci/package.json',
)('puppeteer');

const signature = Buffer.from([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
]);

export async function loadPNG(path, width, height) {
  const png = await readFile(path);

  if (
    png.length < 24 ||
    !png.subarray(0, 8).equals(signature) ||
    png.readUInt32BE(16) !== width ||
    png.readUInt32BE(20) !== height
  ) {
    throw new Error(`${path} must be a ${width}x${height} PNG`);
  }

  return png.toString('base64');
}

export async function withRasterPage(task) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    await task(await browser.newPage());
  } finally {
    await browser.close();
  }
}
