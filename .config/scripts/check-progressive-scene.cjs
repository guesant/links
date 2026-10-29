const assert = require('node:assert/strict');

async function waitForLandscape(page, previewFailed = false) {
  await page.evaluate(() => {
    return new Promise((accept) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(accept);
      });
    });
  });

  try {
    await page.waitForFunction(
      (previewFailed) => {
        const root = document.documentElement;

        const landscape = document.querySelector('.world-landscape');

        const preview = document.querySelector('.world-landscape-preview');

        if (!landscape || !preview) {
          return false;
        }

        const expected = getComputedStyle(root)
          .getPropertyValue('--landscape-image')
          .match(/url\(["']?(.*?)["']?\)/)?.[1];

        const finalStyle = getComputedStyle(landscape);

        const resolveReady = () => {
          if (previewFailed) {
            return root.dataset.landscapePreviewFailed;
          }

          return root.dataset.landscapeReady;
        };

        const ready = resolveReady();

        return (
          ready === 'true' &&
          expected &&
          finalStyle.backgroundImage.includes(
            new URL(expected, location.href).href,
          ) &&
          Number(finalStyle.opacity) === 1 &&
          Number(getComputedStyle(preview).opacity) === 0
        );
      },
      { timeout: 10000 },
      previewFailed,
    );
  } catch (error) {
    const state = await page.evaluate(() => {
      const final = document.querySelector('.world-landscape');

      const preview = document.querySelector('.world-landscape-preview');

      return {
        url: location.href,
        width: innerWidth,
        state: { ...document.documentElement.dataset },
        expected: getComputedStyle(document.documentElement).getPropertyValue(
          '--landscape-image',
        ),
        final: final && {
          inline: final.style.backgroundImage,
          image: getComputedStyle(final).backgroundImage,
          opacity: getComputedStyle(final).opacity,
        },
        preview: preview && {
          image: getComputedStyle(preview).backgroundImage,
          opacity: getComputedStyle(preview).opacity,
        },
      };
    });

    throw new Error(`Scene did not settle: ${JSON.stringify(state)}`, {
      cause: error,
    });
  }
}

async function createScenePage(
  context,
  baseURL,
  { failure, hold = false, reduced = false, javascript = true } = {},
) {
  const page = await context.newPage();

  await page.setCacheEnabled(false);

  const requests = [];

  let holding = hold;

  const resolveHeld = () => {
    if (hold) {
      return page.waitForRequest(
        (request) => {
          return request.url().endsWith('/night-mobile.webp');
        },
        { timeout: 10000 },
      );
    }

    return Promise.resolve();
  };

  const held = resolveHeld();

  await page.setViewport({ width: 390, height: 900 });

  const resolveValue = () => {
    if (reduced) {
      return 'reduce';
    }

    return 'no-preference';
  };

  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'dark' },
    {
      name: 'prefers-reduced-motion',
      value: resolveValue(),
    },
  ]);
  await page.setJavaScriptEnabled(javascript);
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;

    if (failure && path.endsWith(failure)) {
      return request.abort();
    }

    if (holding && path.endsWith('/night-mobile.webp')) {
      requests.push(request);

      return;
    }

    return request.continue();
  });
  await page.goto(new URL('pt-br/', baseURL).href, {
    waitUntil: 'domcontentloaded',
  });

  return {
    page,
    held,
    release: async () => {
      holding = false;
      await Promise.all(
        requests.splice(0).map((request) => {
          return request.continue();
        }),
      );
    },
  };
}

async function profileBounds(page) {
  return page.$eval('.profile', (element) => {
    const bounds = element.getBoundingClientRect();

    return {
      width: bounds.width,
      height: bounds.height,
      top: bounds.top,
      left: bounds.left,
    };
  });
}

async function previewBounds(page) {
  await page.waitForFunction(() => {
    const preview = document.querySelector('.world-landscape-preview');

    const final = document.querySelector('.world-landscape');

    return (
      getComputedStyle(preview).opacity === '1' &&
      getComputedStyle(final).backgroundImage === 'none'
    );
  });

  return profileBounds(page);
}

async function checkTransition(context, baseURL) {
  const { page, release, held } = await createScenePage(context, baseURL, {
    hold: true,
  });

  try {
    await held;
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    const before = await previewBounds(page);

    await release();
    await waitForLandscape(page);

    const after = await profileBounds(page);

    assert.deepEqual(after, before, 'progressive images do not shift content');
    await page.setViewport({ width: 1024, height: 900 });
    await waitForLandscape(page);
    assert.match(
      await page.$eval('.world-landscape', (element) => {
        return getComputedStyle(element).backgroundImage;
      }),
      /night-desktop\.webp/,
    );
  } finally {
    await page.close();
  }
}

async function checkThemeRace(context, baseURL) {
  const { page, release, held } = await createScenePage(context, baseURL, {
    hold: true,
  });

  try {
    await held;
    await previewBounds(page);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
    await waitForLandscape(page);
    await release();
    await page.waitForNetworkIdle({ idleTime: 100 });
    await waitForLandscape(page);
    assert.match(
      await page.$eval('.world-landscape', (element) => {
        return getComputedStyle(element).backgroundImage;
      }),
      /day-mobile\.webp/,
    );
  } finally {
    await page.close();
  }
}

async function checkFailure(context, baseURL, previewFails) {
  const resolveFailure = () => {
    if (previewFails) {
      return '/night-mobile-preview.webp';
    }

    return '/night-mobile.webp';
  };

  const failure = resolveFailure();

  const { page } = await createScenePage(context, baseURL, { failure });

  try {
    await page.waitForNetworkIdle({ idleTime: 100 });

    if (previewFails) {
      await waitForLandscape(page, true);
      await page.evaluate(async () => {
        const image = new Image();

        image.src = '/assets/generated/night-mobile.webp';
        await image.decode();
      });
    } else {
      await previewBounds(page);
      assert.equal(
        await page.$eval('html', (element) => {
          return element.hasAttribute('data-landscape-ready');
        }),
        false,
        'failed full image keeps the preview visible',
      );
    }
  } finally {
    await page.close();
  }
}

async function checkFallbacks(context, baseURL) {
  const reduced = await createScenePage(context, baseURL, { reduced: true });

  try {
    await waitForLandscape(reduced.page);
    assert.equal(
      await reduced.page.$eval('.world-landscape', (element) => {
        return getComputedStyle(element).transitionDuration;
      }),
      '0s',
    );
  } finally {
    await reduced.page.close();
  }

  const native = await createScenePage(context, baseURL, { javascript: false });

  try {
    await native.page.waitForNetworkIdle({ idleTime: 100 });

    const state = await native.page.$eval('.world-landscape', (element) => {
      return {
        image: getComputedStyle(element).backgroundImage,
        opacity: getComputedStyle(element).opacity,
      };
    });

    assert.match(state.image, /night-mobile\.webp/);
    assert.equal(state.opacity, '1');
  } finally {
    await native.page.close();
  }
}

async function checkProgressiveScene(browser, baseURL) {
  const context = await browser.createBrowserContext();

  try {
    await checkTransition(context, baseURL);
    await checkThemeRace(context, baseURL);
    await checkFailure(context, baseURL, true);
    await checkFailure(context, baseURL, false);
    await checkFallbacks(context, baseURL);
    console.log(
      'Progressive scenery: transition, resize, theme race, failures, reduced motion and no-JavaScript fallback passed.',
    );
  } finally {
    await context.close();
  }
}

module.exports = { waitForLandscape, checkProgressiveScene };
