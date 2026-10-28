const assert = require("node:assert/strict");
const fs = require("node:fs");
const { readConfiguration, pagesFor } = require("./configuration.cjs");

module.exports = async function checkLinkViewBrowser(
  browser,
  baseURL,
  reportDirectory,
) {
  const config = readConfiguration();
  const base = new URL(baseURL);
  const href = (path) => new URL(path.replace(/^\//, ""), base).href;
  const routes = config.language_options.flatMap(({ id }) =>
    pagesFor(config, id)
      .filter((page) => ["home", "links-page"].includes(page.type))
      .map((page) => ({ ...page, language: id })),
  );
  const context = await browser.createBrowserContext();
  const checks = [];
  const errors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "languages", { get: () => ["en-US"] });
    });
    await page.goto(href("/"), { waitUntil: "networkidle0" });
    assert.equal(
      await page.$eval("html", (root) => root.dataset.linkView),
      "compact",
    );
    const originalURL = page.url();
    await page.focus("#link-view-compact");
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.$eval("html", (root) => root.dataset.linkView),
      "detailed",
    );
    assert.equal(
      await page.$eval(
        "#link-view-detailed",
        (input) =>
          input === document.activeElement &&
          getComputedStyle(input.nextElementSibling).outlineStyle === "solid",
      ),
      true,
    );
    assert.equal(page.url(), originalURL);
    await page.goto(href("/en/career/"), { waitUntil: "networkidle0" });
    assert.equal(
      await page.$eval("#link-view-detailed", (input) => input.checked),
      true,
    );
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(
      await page.$eval("html", (root) => root.dataset.linkView),
      "detailed",
    );
    await page.click("[data-settings-open]");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.select(
        "[data-language-switcher]",
        new URL(href("/pt-br/career/")).pathname,
      ),
    ]);
    assert.equal(
      await page.$eval("html", (root) => root.dataset.linkView),
      "detailed",
    );
    await page.evaluate(() =>
      localStorage.removeItem("guesant-links-language"),
    );
    for (const route of routes) {
      await page.goto(href(route.url), { waitUntil: "networkidle2" });
      const labels = config.locales[route.language].ui;
      assert.equal(
        await page.$eval(".link-view-control legend", (legend) =>
          legend.textContent.trim(),
        ),
        labels.link_view_label,
      );
      const initialLinks = await page.$$eval(".link-button", (links) =>
        links.map((link) => link.href),
      );
      await page.evaluate(() => {
        window.initialViewLinks = [
          ...document.querySelectorAll(".link-button"),
        ];
      });
      for (const mode of ["compact", "detailed"]) {
        await page.click(`label[for="link-view-${mode}"]`);
        for (const theme of ["dark", "light"]) {
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          for (const width of [320, 390, 768, 1024, 1440]) {
            await page.setViewport({ width, height: 900 });
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
                ),
            );
            const actual = await page.evaluate(() => {
              const detailed =
                document.documentElement.dataset.linkView === "detailed";
              const links = [...document.querySelectorAll(".link-button")];
              const visible = (element) => element.getClientRects().length > 0;
              return {
                overflow: document.documentElement.scrollWidth > innerWidth,
                stableLinks: links.every(
                  (link, index) => link === window.initialViewLinks[index],
                ),
                checked: document.querySelector(
                  "[data-link-view-control]:checked",
                ).value,
                contentFits: links.every(
                  (link) => link.scrollWidth <= link.clientWidth + 1,
                ),
                details: [
                  ...document.querySelectorAll(
                    ".link-url,.link-description,.link-badge,.statistics,.link-visual",
                  ),
                ].every((element) => visible(element) === detailed),
                columns: [
                  ...document.querySelectorAll(".link-list,.category-preview"),
                ].every(
                  (list) =>
                    getComputedStyle(list).gridTemplateColumns.split(" ")
                      .length === 1,
                ),
                fullWidth: [
                  ...document.querySelectorAll(".category-card"),
                ].every((card) => {
                  const style = getComputedStyle(card);
                  const available =
                    card.clientWidth -
                    parseFloat(style.paddingLeft) -
                    parseFloat(style.paddingRight);
                  return (
                    getComputedStyle(card).gridTemplateColumns.split(" ")
                      .length === 1 &&
                    Math.abs(
                      card
                        .querySelector(".category-links")
                        .getBoundingClientRect().width - available,
                    ) < 1
                  );
                }),
                categoryHeaderLayout: [
                  ...document.querySelectorAll(".category-summary"),
                ].every((summary) => {
                  const icon = summary
                    .querySelector(".category-icon")
                    .getBoundingClientRect();
                  const title = summary
                    .querySelector(".category-title")
                    .getBoundingClientRect();
                  const heading = summary
                    .querySelector(".category-heading")
                    .getBoundingClientRect();
                  const copy = summary
                    .querySelector(".category-copy")
                    ?.getBoundingClientRect();
                  const rect = summary.getBoundingClientRect();
                  const style = getComputedStyle(summary);
                  const contentLeft = rect.left + parseFloat(style.paddingLeft);
                  const contentWidth =
                    summary.clientWidth -
                    parseFloat(style.paddingLeft) -
                    parseFloat(style.paddingRight);
                  return (
                    getComputedStyle(summary).gridTemplateColumns.split(" ")
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
                          summary.querySelector(".category-copy"),
                        ).textAlign === "center"))
                  );
                }),
                linksIndependent: [
                  ...document.querySelectorAll(".category-preview-link"),
                ].every(
                  (link) =>
                    link.parentElement.matches("li") &&
                    link.parentElement.closest("a") === null,
                ),
                editorialDestinations: [
                  ...document.querySelectorAll(
                    ".editorial-entry:has(.editorial-details)",
                  ),
                ].every(
                  (entry) =>
                    new URL(entry.querySelector(":is(h3,h5) a").href)
                      .hostname === "curriculum.guesant.net" &&
                    [
                      "github.com",
                      "gitlab.com",
                      "www.youtube.com",
                      "youtube.com",
                      "youtu.be",
                    ].includes(
                      new URL(entry.querySelector(".editorial-details").href)
                        .hostname,
                    ) &&
                    visible(entry.querySelector(".editorial-details")) &&
                    Boolean(
                      entry.querySelector(
                        ".editorial-details .link-third-party-badge",
                      ),
                    ),
                ),
                editorialBorders: [
                  ...document.querySelectorAll(".editorial-group-items"),
                ].every(
                  (group) =>
                    parseFloat(getComputedStyle(group).borderBottomWidth) > 0,
                ),
                editorialSummaries: [
                  ...document.querySelectorAll(
                    '.editorial-entry:is([data-editorial-type="skill"],[data-editorial-type="project"]) .editorial-description',
                  ),
                ].every(visible),
                numericFit: [...document.querySelectorAll(".statistic dd")]
                  .filter(visible)
                  .every((element) => {
                    const range = document.createRange();
                    range.selectNodeContents(element.firstChild);
                    return range.getClientRects().length === 1;
                  }),
                rails: [...document.querySelectorAll(".suspension-body")].every(
                  (body) => {
                    if (!visible(body)) return true;
                    const top = body.getBoundingClientRect().top;
                    const anchors = [
                      ...document.querySelectorAll("[data-rail-anchor]"),
                    ];
                    const gap = parseFloat(
                      getComputedStyle(
                        document.querySelector(".suspended-content"),
                      ).rowGap,
                    );
                    return [
                      ...body.querySelectorAll("[data-rail-lantern]"),
                    ].every((lamp) => {
                      const anchor = anchors[Number(lamp.dataset.railLantern)];
                      return (
                        !anchor ||
                        Math.abs(
                          parseFloat(
                            lamp.style.getPropertyValue(
                              "--rail-lantern-position",
                            ),
                          ) -
                            (anchor.getBoundingClientRect().bottom +
                              gap / 2 -
                              top),
                        ) < 1
                      );
                    });
                  },
                ),
              };
            });
            assert.equal(
              actual.overflow,
              false,
              `${route.url} ${mode} ${theme} ${width} overflow`,
            );
            assert.equal(actual.checked, mode);
            for (const key of [
              "stableLinks",
              "contentFits",
              "details",
              "columns",
              "fullWidth",
              "categoryHeaderLayout",
              "editorialBorders",
              "editorialSummaries",
              "linksIndependent",
              "editorialDestinations",
              "numericFit",
              "rails",
            ])
              assert.equal(
                actual[key],
                true,
                `${route.url} ${mode} ${theme} ${width} ${key}`,
              );
            checks.push({ path: route.url, mode, theme, width });
            if (
              route.language === "pt-br" &&
              ["home", "career", "code"].includes(route.id) &&
              [390, 1440].includes(width)
            ) {
              await page.evaluate(() => {
                document.activeElement?.blur();
                scrollTo(0, 0);
              });
              await page.screenshot({
                path: `${reportDirectory}/view-${route.id}-${mode}-${theme}-${width}.png`,
                fullPage: true,
              });
            }
          }
        }
        assert.deepEqual(
          await page.$$eval(".link-button", (links) =>
            links.map((link) => link.href),
          ),
          initialLinks,
        );
      }
    }
    await page.goto(href("/en/code/"), { waitUntil: "networkidle0" });
    for (const mode of ["compact", "detailed"]) {
      await page.click(`label[for="link-view-${mode}"]`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
        window.viewLongText = [
          ...document.querySelectorAll(".link-title,.link-description"),
        ].map((element) => [element, element.textContent]);
        for (const [element, text] of window.viewLongText)
          element.textContent = text.repeat(4);
      });
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewport({ width, height: 900 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${mode} enlarged text ${width}`,
        );
      }
      await page.evaluate(() => {
        document.documentElement.style.removeProperty("font-size");
        for (const [element, text] of window.viewLongText)
          element.textContent = text;
      });
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
  for (const blocked of [false, true]) {
    const isolated = await browser.createBrowserContext();
    try {
      const page = await isolated.newPage();
      await page.evaluateOnNewDocument((blocked) => {
        if (blocked)
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new Error("Storage blocked");
            },
          });
        else localStorage.setItem("guesant-links-view", "invalid");
      }, blocked);
      await page.goto(href("/pt-br/career/"), { waitUntil: "networkidle0" });
      assert.equal(
        await page.$eval("html", (root) => root.dataset.linkView),
        "compact",
      );
      await page.click("label[for=link-view-detailed]");
      assert.equal(
        await page.$eval("html", (root) => root.dataset.linkView),
        "detailed",
      );
    } finally {
      await isolated.close();
    }
  }
  const noJS = await browser.createBrowserContext();
  try {
    const page = await noJS.newPage();
    await page.setJavaScriptEnabled(false);
    for (const route of ["/en/", "/en/career/"]) {
      await page.goto(href(route), { waitUntil: "networkidle0" });
      assert.equal(
        await page.$eval(
          ".link-view-control",
          (control) => control.getClientRects().length,
        ),
        0,
      );
      assert.equal(
        await page.$eval("html", (root) => root.dataset.linkView),
        "compact",
      );
      assert.equal(
        await page.$eval(
          ".link-description",
          (element) => element.getClientRects().length,
        ),
        0,
      );
    }
  } finally {
    await noJS.close();
  }
  fs.writeFileSync(
    `${reportDirectory}/link-view-checks.json`,
    JSON.stringify(
      { passed: checks.length, failures: errors, checks },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ linkViewChecks: checks.length, failures: errors }),
  );
};
