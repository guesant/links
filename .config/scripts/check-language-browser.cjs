const assert = require("node:assert/strict");

module.exports = async function checkLanguageBrowser(browser, baseURL) {
  const origin = new URL(baseURL);
  const href = (path) => new URL(path.replace(/^\//, ""), origin).href;
  const key = "guesant-links-language";
  let passed = 0;
  for (const scenario of [
    { from: "/", to: "/pt-br/", languages: ["pt-PT", "en-US"] },
    {
      from: "/code/?source=link#details",
      to: "/pt-br/code/?source=link#details",
      languages: ["de-DE"],
    },
    { from: "/code/", to: "/es/code/", languages: ["de-DE", "es-MX"] },
    { from: "/fr/code/", to: "/fr/code/", languages: ["pt-BR"] },
    {
      from: "/fr/code/",
      to: "/pt-br/code/",
      languages: ["en-US"],
      saved: "pt-br",
    },
    { from: "/now/", to: "/now/", languages: ["fr"], saved: "fr" },
  ]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.evaluateOnNewDocument(
        ({ languages, saved, key }) => {
          Object.defineProperty(navigator, "languages", {
            get: () => languages,
          });
          if (saved) localStorage.setItem(key, saved);
        },
        { ...scenario, key },
      );
      let navigations = 0;
      page.on("request", (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        )
          navigations++;
      });
      await page.goto(href(scenario.from), { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (expected) => location.href === expected,
        {},
        href(scenario.to),
      );
      assert(navigations <= 2, "language redirect loop");
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), key),
        scenario.saved || null,
      );
      passed++;
    } finally {
      await context.close();
    }
  }
  const context = await browser.createBrowserContext();
  try {
    const page = await context.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "languages", { get: () => ["en-US"] });
    });
    await page.goto(href("/code/?source=link#details"), {
      waitUntil: "networkidle0",
    });
    await page.click("[data-settings-open]");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.select(
        "[data-language-switcher]",
        new URL(href("/pt-br/code/")).pathname,
      ),
    ]);
    assert.equal(page.url(), href("/pt-br/code/?source=link#details"));
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), key),
      "pt-br",
    );
    await page.goto(href("/writing/"), { waitUntil: "networkidle0" });
    assert.equal(page.url(), href("/pt-br/writing/"));
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(page.url(), href("/pt-br/writing/"));
    passed++;
  } finally {
    await context.close();
  }
  console.log(
    JSON.stringify({ languageBrowserScenarios: passed, failures: [] }),
  );
};
