const assert = require("node:assert/strict");
const fs = require("node:fs");
const { resolve } = require("node:path");
const { createRequire } = require("node:module");
const {
  readConfiguration,
  visibleLinks,
  localizedURL,
  pagesFor,
} = require("./configuration.cjs");
const puppeteer = createRequire(
  "/usr/local/lib/node_modules/pa11y-ci/package.json",
)("puppeteer");
const config = readConfiguration(
  process.env.QA_LINKS_CONFIG ||
    resolve(__dirname, "../../src/data/links.yaml"),
);
const snapshots = require("yaml").parse(
  fs.readFileSync(resolve(__dirname, "../../src/data/statistics.yaml"), "utf8"),
);
const reportDirectory = process.env.QA_REPORT_DIR || resolve(".local/reports");
const base = new URL(
  (process.env.QA_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "") + "/",
);
const href = (path) =>
  /^(https?:|mailto:|tel:)/.test(path)
    ? new URL(path).href
    : new URL(path.replace(/^\/+/, ""), base).href;
const widths = [320, 390, 768, 1024, 1440];
const routes = config.language_options.flatMap(({ id }) =>
  pagesFor(config, id)
    .filter((page) => !page.fallback)
    .map((page) => ({ ...page, language: id })),
);
const checks = [];

(async () => {
  fs.mkdirSync(reportDirectory, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(base.origin) && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  const represented = new Set();
  try {
    for (const route of routes) {
      const response = await page.goto(href(route.url), {
        waitUntil: "networkidle2",
      });
      assert.equal(response.status(), 200, route.url);
      await page.evaluate(() => document.fonts.ready);
      const expectedNavigation = pagesFor(config, route.language).map(
        (entry) => ({
          title: entry.title,
          url: href(entry.url),
          current: entry.id === route.id,
          icon: entry.icon,
        }),
      );
      const expectedLinks = (route.links || [])
        .map((entry) => href(localizedURL(entry, route.language)))
        .sort();
      for (const entry of route.links || []) represented.add(entry.id);
      if (config.navigation.links.includes(route.id)) represented.add(route.id);
      assert.deepEqual(
        await page.$$eval(".page-tab", (tabs) =>
          tabs.map((tab) => ({
            title: tab.textContent.trim(),
            url: tab.href,
            current: tab.getAttribute("aria-current") === "page",
            icon: tab.querySelector("[data-platform]").dataset.platform,
          })),
        ),
        expectedNavigation,
      );
      assert.deepEqual(
        await page.$$eval(".link-button", (links) =>
          links.map((link) => link.href).sort(),
        ),
        expectedLinks,
      );
      assert.equal(await page.$$eval("h1", (headings) => headings.length), 1);
      const expectedCanonical = new URL(route.url.replace(/^\/+/, ""), base)
        .href;
      assert.equal(
        await page.$eval('link[rel="canonical"]', (link) => link.href),
        expectedCanonical,
      );
      assert.equal(
        await page.$eval("html", (element) => element.lang),
        config.locales[route.language].ui.html_lang,
      );
      for (const theme of ["dark", "light"]) {
        await page.click("[data-settings-open]");
        await page.$eval(`#theme-${theme}`, (option) => option.click());
        await page.click("#settings-dialog [data-dialog-close]");
        for (const width of widths) {
          await page.setViewport({ width, height: 900 });
          const layout = await page.evaluate(() => {
            const cards = [...document.querySelectorAll(".link-button")];
            const tabs = [...document.querySelectorAll(".page-tab")];
            const rowAligned = (elements) =>
              elements.every((element) => {
                const rect = element.getBoundingClientRect();
                return elements.every((other) => {
                  const otherRect = other.getBoundingClientRect();
                  return (
                    Math.abs(rect.top - otherRect.top) > 1 ||
                    (Math.abs(rect.height - otherRect.height) < 1 &&
                      Math.abs(rect.width - otherRect.width) < 1)
                  );
                });
              });
            return {
              regionsAligned: (() => {
                const shell = document
                  .querySelector(".site-shell")
                  .getBoundingClientRect();
                const navigation = document
                  .querySelector(".page-navigation")
                  .getBoundingClientRect();
                const content = document
                  .querySelector(".page-content")
                  .getBoundingClientRect();
                const footer = document
                  .querySelector(".site-footer")
                  .getBoundingClientRect();
                const quickContacts = document
                  .querySelector(".quick-contacts")
                  .getBoundingClientRect();
                return (
                  Math.abs(navigation.width - content.width) < 1 &&
                  Math.abs(footer.width - content.width) < 1 &&
                  Math.abs(quickContacts.width - content.width) < 1 &&
                  Math.abs(
                    navigation.left +
                      navigation.width / 2 -
                      (content.left + content.width / 2),
                  ) < 1 &&
                  Math.abs(
                    footer.left +
                      footer.width / 2 -
                      (content.left + content.width / 2),
                  ) < 1 &&
                  Math.abs(
                    quickContacts.left +
                      quickContacts.width / 2 -
                      (content.left + content.width / 2),
                  ) < 1 &&
                  Math.abs(
                    content.left +
                      content.width / 2 -
                      (shell.left + shell.width / 2),
                  ) < 1
                );
              })(),
              overflow: document.documentElement.scrollWidth > innerWidth,
              mainContentGeometry: (() => {
                const main = document.querySelector("#main-content");
                const shell = document.querySelector(".site-shell");
                const rect = main.getBoundingClientRect();
                const shellRect = shell.getBoundingClientRect();
                return (
                  Math.abs(rect.width - Math.min(640, shellRect.width)) < 1 &&
                  Math.abs(
                    rect.left +
                      rect.width / 2 -
                      (shellRect.left + shellRect.width / 2),
                  ) < 1
                );
              })(),
              cardsAligned: rowAligned(cards),
              statisticsAligned: [
                ...document.querySelectorAll(".link-row"),
              ].every((row) => {
                const statistics = [...row.querySelectorAll(".statistics")];
                return (
                  innerWidth < 896 ||
                  statistics.every((entry) =>
                    statistics.every((other) => {
                      const rect = entry.getBoundingClientRect();
                      const compared = other.getBoundingClientRect();
                      return (
                        Math.abs(rect.top - compared.top) < 1 &&
                        Math.abs(rect.bottom - compared.bottom) < 1
                      );
                    }),
                  )
                );
              }),
              tabsAligned: rowAligned(tabs),
              controlsFit: [
                ...document.querySelectorAll(
                  ".page-tab,.ui-button,.site-footer-content > *",
                ),
              ].every(
                (element) =>
                  element.scrollWidth <= element.clientWidth &&
                  element.getBoundingClientRect().height >= 44,
              ),
              columns: [...document.querySelectorAll(".link-row")].map(
                (list) =>
                  getComputedStyle(list).gridTemplateColumns.split(" ").length,
              ),
              tabsColumns: getComputedStyle(
                document.querySelector(".page-tabs"),
              ).gridTemplateColumns.split(" ").length,
              languageControls:
                document.querySelectorAll(".language-select").length,
              noControlMotion: [
                ...document.querySelectorAll(
                  ".link-button,.quick-contact-link,.page-tab,.toggle-button,.language-select,.site-footer-content > *",
                ),
              ].every(
                (element) =>
                  getComputedStyle(element).transform === "none" &&
                  getComputedStyle(element)
                    .transitionDuration.split(", ")
                    .every((duration) => duration === "0s"),
              ),
              iconBoxes: [
                ...document.querySelectorAll(
                  ".button-icon,.link-icon,.quick-contact-icon,.category-icon,.external-link-icon",
                ),
              ].every((icon) => {
                const rect = icon.getBoundingClientRect();
                const svg = icon.querySelector("svg");
                const glyph = svg?.getBoundingClientRect();
                return (
                  Math.abs(rect.width - rect.height) < 1 &&
                  svg?.querySelector("use") &&
                  glyph.width <= rect.width &&
                  glyph.height <= rect.height &&
                  Math.abs(
                    rect.left + rect.width / 2 - (glyph.left + glyph.width / 2),
                  ) < 1 &&
                  Math.abs(
                    rect.top + rect.height / 2 - (glyph.top + glyph.height / 2),
                  ) < 1
                );
              }),
              coloredIcons: (() => {
                const icons = [
                  ...document.querySelectorAll(".link-icon-symbol-svg"),
                ];
                return (
                  icons.length > 0 &&
                  icons.every(
                    (icon) =>
                      !getComputedStyle(icon).filter.includes("grayscale"),
                  )
                );
              })(),
              localIcons: [...document.querySelectorAll("svg use")].every(
                (icon) =>
                  new URL(icon.getAttribute("href"), location.href).origin ===
                  location.origin,
              ),
              externalLinks: [
                ...document.querySelectorAll(
                  '.link-button[href^="http"],.quick-contact-link[href^="http"]',
                ),
              ].every(
                (link) =>
                  link.target === "_blank" &&
                  link.relList.contains("noopener") &&
                  link.relList.contains("noreferrer") &&
                  link.querySelector(".external-link-icon"),
              ),
              footerDisclaimer:
                document.querySelectorAll(".brand-disclaimer").length === 1 &&
                Boolean(document.querySelector("footer .brand-disclaimer")),
              calendarUptime: [
                ...document.querySelectorAll("[data-uptime]"),
              ].every(
                (element) => element.textContent.split(", ").length === 3,
              ),
              statisticsImages:
                document.querySelectorAll(".statistics img").length,
              numericValuesFit: [
                ...document.querySelectorAll(".statistic dd"),
              ].every((value) => {
                const range = document.createRange();
                range.selectNodeContents(value.firstChild);
                return range.getClientRects().length === 1;
              }),
              brokenImages: [...document.images].filter(
                (image) =>
                  image.src.startsWith(location.origin) &&
                  image.complete &&
                  !image.naturalWidth,
              ).length,
              uniformMedia: [
                ...document.querySelectorAll(".link-visual img"),
              ].every(
                (image) =>
                  getComputedStyle(image).objectFit === "contain" &&
                  image.hasAttribute("width") &&
                  image.hasAttribute("height") &&
                  image.loading === "lazy",
              ),
              galleryColumns: document.querySelector(".category-grid")
                ? getComputedStyle(
                    document.querySelector(".category-grid"),
                  ).gridTemplateColumns.split(" ").length
                : 0,
              categoryPreviewColumns: [
                ...document.querySelectorAll(".category-preview"),
              ].every(
                (preview) =>
                  getComputedStyle(preview).gridTemplateColumns.split(" ")
                    .length === 1,
              ),
              homeIntroductionColumns: (() => {
                const introduction =
                  document.querySelector(".home-introduction");
                return (
                  !introduction ||
                  getComputedStyle(introduction).gridTemplateColumns.split(" ")
                    .length === 1
                );
              })(),
              galleryAligned: [
                ...document.querySelectorAll(".category-card"),
              ].every((card, _, cards) => {
                const rect = card.getBoundingClientRect();
                const grid = document
                  .querySelector(".category-grid")
                  .getBoundingClientRect();
                return (
                  Math.abs(rect.left - grid.left) < 1 &&
                  Math.abs(rect.width - grid.width) < 1 &&
                  card
                    .querySelector(".category-main-link")
                    ?.getAttribute("href") &&
                  cards.every(
                    (other) =>
                      Math.abs(other.getBoundingClientRect().left - grid.left) <
                      1,
                  )
                );
              }),
              galleryLinksAccessible: [
                ...document.querySelectorAll(".category-preview-link"),
              ].every((link) => {
                const mainLink = link
                  .closest(".category-card")
                  .querySelector(".category-main-link");
                return (
                  getComputedStyle(link).position === "relative" &&
                  Number(getComputedStyle(link).zIndex) >
                    Number(getComputedStyle(mainLink, "::after").zIndex)
                );
              }),
              footerAligned: rowAligned([
                ...document.querySelectorAll(".site-footer-content > *"),
              ]),
              settingsClosed: !document.querySelector("#settings-dialog").open,
              isolatedPreferences: [
                ...document.querySelectorAll(".toggle-group"),
              ].every((group) => group.closest("#settings-dialog")),
            };
          });
          assert.equal(
            layout.overflow,
            false,
            `${route.url} overflow at ${width}`,
          );
          for (const key of [
            "cardsAligned",
            "regionsAligned",
            "mainContentGeometry",
            "statisticsAligned",
            "numericValuesFit",
            "tabsAligned",
            "controlsFit",
            "noControlMotion",
            "iconBoxes",
            "coloredIcons",
            "localIcons",
            "externalLinks",
            "footerDisclaimer",
            "calendarUptime",
            "uniformMedia",
            "galleryAligned",
            "categoryPreviewColumns",
            "homeIntroductionColumns",
            "galleryLinksAccessible",
            "footerAligned",
            "settingsClosed",
            "isolatedPreferences",
          ])
            assert.equal(
              Boolean(layout[key]),
              true,
              `${route.url} ${key} at ${width}/${theme}`,
            );
          assert(layout.columns.every((columns) => columns === 1));
          assert.equal(layout.tabsColumns, 2);
          assert.equal(layout.languageControls, 1);
          if (route.id === "home") {
            assert.equal(layout.galleryColumns, 1);
          }
          assert.equal(layout.statisticsImages, 0);
          assert.equal(layout.brokenImages, 0);
          checks.push({ path: route.url, theme, width, passed: true });
          if (
            route.language === config.language_options[0].id &&
            [390, 1440].includes(width)
          ) {
            await page.evaluate(() => {
              document.activeElement?.blur();
              scrollTo(0, 0);
            });
            await page.screenshot({
              path: `${reportDirectory}/${route.id}-${theme}-${width}.png`,
              fullPage: true,
            });
          }
        }
      }
      if (route.id === "home") {
        const categories = await page.$$eval("[data-category]", (cards) =>
          cards.map((card) => ({
            id: card.dataset.category,
            href: card.querySelector(".category-main-link").href,
            previews: [...card.querySelectorAll("[data-preview-id]")].map(
              (link) => ({ id: link.dataset.previewId, href: link.href }),
            ),
          })),
        );
        const expectedCategories = pagesFor(config, route.language)
          .filter((entry) => entry.id !== "home")
          .map((entry) => ({
            id: entry.id,
            href: href(entry.url),
            previews:
              entry.type === "links-page"
                ? entry.links.map((link) => ({
                    id: link.id,
                    href: href(localizedURL(link, route.language)),
                  }))
                : (config.now[route.language] || config.now.en).sections.map(
                    (section) => ({
                      id: `now-${section.id}`,
                      href: `${href(entry.url)}#now-${section.id}`,
                    }),
                  ),
          }));
        assert.deepEqual(categories, expectedCategories);
      }
      for (const entry of route.links || []) {
        if (!entry.stats) continue;
        const snapshot = snapshots[entry.id];
        assert(
          snapshot?.profile_url === entry.url &&
            snapshot.provider === entry.stats.provider,
        );
        const actual = await page.$$eval(
          `[data-statistics="${entry.id}"] .statistic`,
          (statistics) =>
            statistics.map((statistic) => ({
              label: statistic.querySelector("dt").textContent.trim(),
              value: statistic
                .querySelector("dd")
                .firstChild.textContent.trim(),
            })),
        );
        assert.deepEqual(
          actual,
          entry.stats.metrics.map((metric) => ({
            label: config.statistics.metrics[metric].labels[route.language],
            value: String(snapshot.metrics[metric]),
          })),
        );
      }
      if (
        route.language === config.language_options[0].id &&
        ["home", config.navigation.sections[0]].includes(route.id)
      ) {
        const original = await page.evaluate(() =>
          [".category-title a", ".link-title", ".link-url-text"].flatMap(
            (selector) => {
              const element = document.querySelector(selector);
              if (!element) return [];
              const text = element.textContent;
              element.textContent = text.repeat(6);
              return [{ selector, text }];
            },
          ),
        );
        for (const width of widths) {
          await page.setViewport({ width, height: 900 });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          checks.push({
            path: route.url,
            width,
            longContent: true,
            passed: true,
          });
        }
        await page.evaluate((original) => {
          for (const { selector, text } of original)
            document.querySelector(selector).textContent = text;
        }, original);
      }
      const control =
        (await page.$(".link-button")) ||
        (await page.$(".page-tab:not([aria-current])"));
      await control.evaluate((element) =>
        element.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      const before = await control.boundingBox();
      await control.hover();
      const hovered = await control.boundingBox();
      assert.deepEqual(hovered, before, "hover must not displace controls");
      await page.mouse.down();
      assert.equal(
        await control.evaluate(
          (element) => getComputedStyle(element).transform,
        ),
        "none",
      );
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.setViewport({ width: 320, height: 640 });
      const headerBefore = await page.$eval(".profile", (element) => {
        const { left, width } = element.getBoundingClientRect();
        return { left, width };
      });
      await page.click("[data-settings-open]");
      const settings = await page.$eval("#settings-dialog", (dialog) => {
        const rect = dialog.getBoundingClientRect();
        const languages = [...dialog.querySelectorAll(".language-select")];
        return {
          open: dialog.open,
          fits:
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= innerHeight,
          singleLanguageControl: languages.length === 1,
          noOverflow: dialog.scrollWidth <= dialog.clientWidth,
          controlsFit: [
            ...dialog.querySelectorAll(".toggle-button,.language-select"),
          ].every(
            (control) =>
              control.scrollWidth <= control.clientWidth &&
              control.getBoundingClientRect().height >= 44,
          ),
        };
      });
      assert(
        settings.open &&
          settings.fits &&
          settings.singleLanguageControl &&
          settings.noOverflow &&
          settings.controlsFit,
        JSON.stringify({ path: route.url, ...settings }),
      );
      assert.deepEqual(
        await page.$eval(".profile", (element) => {
          const { left, width } = element.getBoundingClientRect();
          return { left, width };
        }),
        headerBefore,
        "Opening settings must not move the identity panel",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.$eval(":focus", (element) =>
          element.hasAttribute("data-settings-open"),
        ),
        true,
      );
      await page.click("[data-credits-open]");
      const dialog = await page.$eval("#credits-dialog", (dialog) => ({
        open: dialog.open,
        top: dialog.getBoundingClientRect().top,
        bottom: dialog.getBoundingClientRect().bottom,
        height: innerHeight,
        scrolls:
          getComputedStyle(dialog.querySelector(".credits-dialog-content"))
            .overflowY === "auto",
      }));
      assert(
        dialog.open &&
          dialog.top >= 0 &&
          dialog.bottom <= dialog.height &&
          dialog.scrolls,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.$eval("#credits-dialog", (dialog) => dialog.open),
        false,
      );
    }
    assert.deepEqual(
      [...represented].sort(),
      visibleLinks(config)
        .map((entry) => entry.id)
        .sort(),
      "Every public entry must have a page or tab",
    );
    await page.setJavaScriptEnabled(false);
    for (const route of routes) {
      await page.goto(href(route.url), { waitUntil: "networkidle2" });
      const destination = pagesFor(config, route.language).find(
        (entry) => entry.id !== route.id && !entry.fallback,
      );
      await page.focus(
        `.page-tab[href="${new URL(href(destination.url)).pathname}"]`,
      );
      assert.equal(
        await page.$eval(
          ":focus",
          (element) => getComputedStyle(element).outlineStyle,
        ),
        "solid",
      );
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        page.keyboard.press("Enter"),
      ]);
      assert.equal(page.url(), href(destination.url));
      checks.push({
        path: route.url,
        navigationWithoutJavaScript: true,
        passed: true,
      });
    }
    await page.setJavaScriptEnabled(true);
    await page.goto(href(config.language_options[0].path), {
      waitUntil: "networkidle2",
    });
    await page.click("[data-settings-open]");
    await page.$eval("#motion-off", (option) => option.click());
    await page.reload({ waitUntil: "networkidle2" });
    assert.equal(
      await page.$eval("html", (root) => root.dataset.motion),
      "off",
    );
    await page.click("[data-settings-open]");
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await page.$eval("#motion-on", (option) => option.click());
    assert.equal(
      await page.$eval("html", (root) => root.dataset.motion),
      "off",
    );
    await page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "light" },
    ]);
    await page.$eval("#theme-system", (option) => option.click());
    assert.equal(
      await page.$eval("html", (root) => getComputedStyle(root).colorScheme),
      "light",
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${reportDirectory}/layout-checks.json`,
      JSON.stringify(
        {
          passed: checks.length,
          pages: routes.length,
          widths,
          failures: errors,
          checks,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        passed: checks.length,
        pages: routes.length,
        widths,
        failures: errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
