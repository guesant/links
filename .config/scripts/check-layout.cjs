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
      const typography = await page.evaluate(async () => {
        const weights = [400, 600, 700];
        const loaded = await Promise.all(
          weights.map((weight) =>
            document.fonts.load(
              `${weight} 16px "Oxanium"`,
              "Gabriel, música, aplicações, Ā, Ș",
            ),
          ),
        );
        return {
          body: getComputedStyle(document.body).fontFamily,
          control: getComputedStyle(
            document.querySelector(".section-switcher-trigger"),
          ).fontFamily,
          heading: getComputedStyle(document.querySelector("h1")).fontFamily,
          loaded: loaded.every(
            (faces) =>
              faces.length > 0 &&
              faces.every((face) => face.status === "loaded"),
          ),
        };
      });
      assert.match(typography.body, /^"?Oxanium"?,/);
      assert.match(typography.control, /^"?Oxanium"?,/);
      assert.match(
        typography.heading,
        route.id === "home" ? /press start 2p/ : /^"?Oxanium"?,/,
      );
      assert(typography.loaded, `Oxanium failed to load on ${route.url}`);
      const expectedNavigation = pagesFor(config, route.language)
        .filter((entry) => ["home", "links-page"].includes(entry.type))
        .map((entry) => ({
          title: entry.title,
          url: href(entry.url),
          current: entry.id === route.id,
          icon: entry.icon,
        }));
      const expectedLinks = (route.links || [])
        .map((entry) => href(localizedURL(entry, route.language)))
        .sort();
      for (const entry of route.links || []) represented.add(entry.id);
      if (config.navigation.links.includes(route.id)) represented.add(route.id);
      assert.deepEqual(
        await page.$$eval(".section-menu-list a", (tabs) =>
          tabs.map((tab) => ({
            title: tab.textContent.trim(),
            url: tab.href,
            current: tab.getAttribute("aria-current") === "page",
            icon: tab.querySelector("[data-platform]").dataset.platform,
          })),
        ),
        expectedNavigation,
      );
      const nowPage = pagesFor(config, route.language).find(
        (entry) => entry.id === "now",
      );
      assert.deepEqual(
        await page.$$eval("[data-now-shortcut]", (links) =>
          links.map((link) => ({
            href: link.href,
            current: link.getAttribute("aria-current") === "page",
          })),
        ),
        Array.from({ length: 2 }, () => ({
          href: href(nowPage.url),
          current: route.id === "now",
        })),
      );
      assert.equal(
        await page.$$eval(
          '.quick-contacts [data-platform="linkedin"]',
          (icons) => icons.length,
        ),
        1,
      );
      assert.deepEqual(
        await page.$$eval(".language-select option", (options) =>
          options.map((option) => ({
            href: new URL(option.value, location.href).href,
            selected: option.selected,
          })),
        ),
        config.language_options.map((language) => {
          const translated = pagesFor(config, language.id).find(
            (entry) => entry.id === route.id && !entry.fallback,
          );
          return {
            href: href(translated?.url || language.path),
            selected: language.id === route.language,
          };
        }),
      );
      assert.deepEqual(
        await page.$$eval(".link-section .link-button", (links) =>
          links.map((link) => link.href).sort(),
        ),
        expectedLinks,
      );
      assert.equal(await page.$$eval("h1", (headings) => headings.length), 1);
      if (route.id === "home") {
        const expected = config.locales[route.language].presentation;
        assert.deepEqual(
          await page.$eval(".home-introduction", (panel) => ({
            title: document
              .getElementById(panel.getAttribute("aria-labelledby"))
              .textContent.trim(),
            facts: [...panel.querySelectorAll(".about-fact")].map((fact) => ({
              icon: fact.querySelector("[data-platform]").dataset.platform,
              text: fact.textContent.trim(),
            })),
            site_title: panel
              .querySelector(".about-site-title")
              .textContent.trim(),
            topics: [...panel.querySelectorAll(".about-topics > li")].map(
              (topic) => topic.textContent.trim(),
            ),
          })),
          expected,
        );
      }
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
        if (
          route.id === "home" &&
          route.language === config.language_options[0].id
        ) {
          const materialContrast = await page.evaluate(async () => {
            const root = document.documentElement;
            const color = (name) => {
              const sample = document.createElement("span");
              sample.style.color = `var(--${name})`;
              root.append(sample);
              const result = getComputedStyle(sample)
                .color.match(/[\d.]+/g)
                .map(Number);
              sample.remove();
              return result;
            };
            const imageURL = getComputedStyle(root)
              .getPropertyValue("--texture-aged-oak")
              .match(/url\(["']?(.*?)["']?\)/)[1];
            const image = new Image();
            image.src = imageURL;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;
            const luminance = (rgb) =>
              rgb
                .slice(0, 3)
                .map((value) => {
                  value /= 255;
                  return value <= 0.04045
                    ? value / 12.92
                    : ((value + 0.055) / 1.055) ** 2.4;
                })
                .reduce(
                  (sum, value, index) =>
                    sum + value * [0.2126, 0.7152, 0.0722][index],
                  0,
                );
            const blend = (under, over) =>
              under.map(
                (value, index) =>
                  value * (1 - (over[3] ?? 1)) + over[index] * (over[3] ?? 1),
              );
            const ratio = (one, two) => {
              const a = luminance(one),
                b = luminance(two);
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            };
            const panelWash = color("color-panel-wash");
            const woodWash = color("color-wood-wash");
            const warmth = color("color-frame-warmth");
            const panelText = [
              "color-text",
              "color-text-muted",
              "color-accent-strong",
            ].map(color);
            const woodText = ["color-wood-text", "color-wood-muted"].map(color);
            let panel = Infinity,
              wood = Infinity;
            for (let index = 0; index < pixels.length; index += 4) {
              const pixel = [...pixels.slice(index, index + 3)];
              if (pixels[index + 3] !== 255)
                throw new Error("Material must be opaque");
              const panelPixel = blend(pixel, panelWash);
              const woodPixel = blend(
                blend(blend(pixel, woodWash), warmth),
                warmth,
              );
              for (const foreground of panelText)
                panel = Math.min(panel, ratio(foreground, panelPixel));
              for (const foreground of woodText)
                wood = Math.min(wood, ratio(foreground, woodPixel));
            }
            return { panel, wood };
          });
          assert(
            materialContrast.panel >= 4.5 && materialContrast.wood >= 4.5,
            JSON.stringify(materialContrast),
          );
          checks.push({
            path: route.url,
            theme,
            materialContrast,
            passed: true,
          });
        }
        for (const width of widths) {
          await page.setViewport({ width, height: 900 });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const layout = await page.evaluate(() => {
            const cards = [...document.querySelectorAll(".link-button")];
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
                const profile = document
                  .querySelector(".profile")
                  .getBoundingClientRect();
                const quickContacts = document
                  .querySelector(".quick-contacts")
                  .getBoundingClientRect();
                const suspended = document.querySelector(".suspended-content");
                const suspendedStyle = getComputedStyle(suspended);
                const insetStart = parseFloat(suspendedStyle.paddingLeft);
                const insetEnd = parseFloat(suspendedStyle.paddingRight);
                const outerAligned = [profile, footer].every(
                  (rect) =>
                    Math.abs(rect.width - shell.width) < 1 &&
                    Math.abs(rect.left - shell.left) < 1 &&
                    Math.abs(rect.right - shell.right) < 1,
                );
                const aligned =
                  outerAligned &&
                  [navigation, content].every(
                    (rect) =>
                      Math.abs(rect.left - shell.left - insetStart) < 1 &&
                      Math.abs(shell.right - rect.right - insetEnd) < 1,
                  );
                return (
                  aligned &&
                  navigation.top <= quickContacts.top &&
                  navigation.bottom >= quickContacts.bottom &&
                  navigation.bottom <= content.top &&
                  Math.abs(navigation.width - content.width) < 1 &&
                  Math.abs(footer.width - profile.width) < 1 &&
                  quickContacts.left >= navigation.left &&
                  quickContacts.right <= navigation.right &&
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
                const suspendedStyle = getComputedStyle(
                  document.querySelector(".suspended-content"),
                );
                const availableWidth =
                  shellRect.width -
                  parseFloat(suspendedStyle.paddingLeft) -
                  parseFloat(suspendedStyle.paddingRight);
                return (
                  Math.abs(rect.width - Math.min(640, availableWidth)) < 1 &&
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
              navigationCompact:
                document
                  .querySelector(".page-navigation")
                  .getBoundingClientRect().height < 220 &&
                !document.querySelector(".section-switcher").open,
              controlsFit: [
                ...document.querySelectorAll(
                  ".navigation-home,.section-switcher-trigger,.ui-button,.site-footer-content > *",
                ),
              ]
                .filter((element) => element.getClientRects().length)
                .every(
                  (element) =>
                    element.scrollWidth <= element.clientWidth &&
                    element.getBoundingClientRect().height >= 44,
                ),
              columns: [...document.querySelectorAll(".link-row")].map(
                (list) =>
                  getComputedStyle(list).gridTemplateColumns.split(" ").length,
              ),
              languageControls:
                document.querySelectorAll(".language-select").length,
              noControlMotion: [
                ...document.querySelectorAll(
                  ".link-button,.quick-contact-link,.navigation-home,.section-switcher-trigger,.toggle-button,.language-select,.site-footer-content > *",
                ),
              ].every(
                (element) =>
                  getComputedStyle(element).transform === "none" &&
                  getComputedStyle(element)
                    .transitionDuration.split(", ")
                    .every((duration) => duration === "0s"),
              ),
              railConnections: [
                ...document.querySelectorAll(".suspension-rail"),
              ].every((rail) => {
                const frame = rail.getBoundingClientRect();
                if (getComputedStyle(rail).display === "none")
                  return frame.width === 0;
                const terminals = [
                  ...rail.querySelectorAll(".suspension-terminal"),
                ];
                const body = rail
                  .querySelector(".suspension-body")
                  .getBoundingClientRect();
                const chains = [...rail.querySelectorAll(".suspension-chain")];
                const upper = chains[0].getBoundingClientRect();
                const lower = chains[1].getBoundingClientRect();
                const first = terminals[0].getBoundingClientRect();
                const last = terminals[1].getBoundingClientRect();
                const spliceAnchor = Math.min(
                  1,
                  document.querySelectorAll("[data-rail-anchor]").length - 1,
                );
                const lantern = rail
                  .querySelector(`[data-rail-lantern="${spliceAnchor}"]`)
                  .getBoundingClientRect();
                const profile = document.querySelector(".profile");
                const footer = document.querySelector(".site-footer");
                const headerRect = profile.getBoundingClientRect();
                const footerRect = footer.getBoundingClientRect();
                const headerBorder = parseFloat(
                  getComputedStyle(profile).borderBottomWidth,
                );
                const couplingSeat =
                  parseFloat(
                    getComputedStyle(rail).getPropertyValue(
                      "--rail-coupling-seat",
                    ),
                  ) *
                  parseFloat(
                    getComputedStyle(document.documentElement).fontSize,
                  );
                const footerBorder = parseFloat(
                  getComputedStyle(footer).borderTopWidth,
                );
                const atStart = rail.classList.contains(
                  "suspension-rail-start",
                );
                const center = frame.left + frame.width / 2;
                const headerJoint = atStart
                  ? headerRect.left + headerBorder / 2
                  : headerRect.right - headerBorder / 2;
                const footerJoint = atStart
                  ? footerRect.left + footerBorder / 2
                  : footerRect.right - footerBorder / 2;
                return (
                  Math.abs(
                    frame.top +
                      couplingSeat -
                      (headerRect.bottom - headerBorder / 2),
                  ) < 1 &&
                  Math.abs(
                    frame.bottom -
                      couplingSeat -
                      (footerRect.top + footerBorder / 2),
                  ) < 1 &&
                  Math.abs(center - headerJoint) < 1 &&
                  Math.abs(center - footerJoint) < 1 &&
                  headerJoint >= first.left &&
                  headerJoint <= first.right &&
                  footerJoint >= last.left &&
                  footerJoint <= last.right &&
                  terminals.length === 2 &&
                  terminals[0].src === terminals[1].src &&
                  getComputedStyle(terminals[0]).transform === "none" &&
                  getComputedStyle(terminals[1]).transform ===
                    "matrix(1, 0, 0, -1, 0, 0)" &&
                  Math.abs(first.top - frame.top) < 1 &&
                  Math.abs(first.bottom - body.top) < 1 &&
                  Math.abs(body.bottom - last.top) < 1 &&
                  Math.abs(last.bottom - frame.bottom) < 1 &&
                  Math.abs(upper.top - body.top) < 1 &&
                  Math.abs(upper.bottom - lower.top) < 1 &&
                  Math.abs(lower.bottom - body.bottom) < 1 &&
                  lantern.top < upper.bottom &&
                  lantern.bottom > lower.top &&
                  chains.every((chain) =>
                    getComputedStyle(chain).backgroundSize.endsWith("auto"),
                  ) &&
                  [...rail.querySelectorAll("img")].every((image) => {
                    const rect = image.getBoundingClientRect();
                    const expected =
                      Number(image.getAttribute("width")) /
                      Number(image.getAttribute("height"));
                    return (
                      rect.top >= frame.top - 1 &&
                      rect.bottom <= frame.bottom + 1 &&
                      Math.abs(rect.width / rect.height - expected) < 0.01
                    );
                  })
                );
              }),
              railContentClearance: (() => {
                const suspended = document.querySelector(".suspended-content");
                const style = getComputedStyle(suspended);
                const rails = [
                  ...suspended.querySelectorAll(".suspension-rail"),
                ];
                if (
                  rails.every(
                    (rail) => getComputedStyle(rail).display === "none",
                  )
                )
                  return (
                    parseFloat(style.paddingLeft) === 0 &&
                    parseFloat(style.paddingRight) === 0
                  );
                const gap =
                  parseFloat(style.paddingLeft) -
                  (rails[0].getBoundingClientRect().right -
                    suspended.getBoundingClientRect().left);
                const start = rails[0].getBoundingClientRect();
                const end = rails[1].getBoundingClientRect();
                return (
                  gap > 0 &&
                  [...suspended.children]
                    .filter(
                      (element) =>
                        !element.classList.contains("suspension-rail"),
                    )
                    .every((element) => {
                      const rect = element.getBoundingClientRect();
                      return (
                        rect.left - start.right >= gap - 1 &&
                        end.left - rect.right >= gap - 1
                      );
                    })
                );
              })(),
              anchoredLanterns: (() => {
                const anchors = [
                  ...document.querySelectorAll("[data-rail-anchor]"),
                ];
                if (!anchors.length) return true;
                const content = document.querySelector(".suspended-content");
                const gap = parseFloat(getComputedStyle(content).rowGap);
                return [...content.querySelectorAll(".suspension-body")].every(
                  (body) => {
                    if (!body.getClientRects().length) return true;
                    const frame = body.getBoundingClientRect();
                    const lanterns = [
                      ...body.querySelectorAll("[data-rail-lantern]"),
                    ];
                    return (
                      lanterns.length === anchors.length &&
                      lanterns.every((lantern, index) => {
                        const expected =
                          anchors[index].getBoundingClientRect().bottom +
                          gap / 2 -
                          frame.top;
                        const actual = parseFloat(
                          lantern.style.getPropertyValue(
                            "--rail-lantern-position",
                          ),
                        );
                        const image = lantern.getBoundingClientRect();
                        return (
                          Math.abs(expected - actual) < 1 &&
                          Math.abs(
                            image.left +
                              image.width / 2 -
                              frame.left -
                              frame.width / 2,
                          ) < 1
                        );
                      })
                    );
                  },
                );
              })(),
              repeatingFrames: [
                ...document.querySelectorAll(
                  ".profile,.quick-contact-link,.presentation,.category-card,.link-sections,.site-footer,.presentation-eyebrow,.section-label,.presentation-art,.app-dialog",
                ),
              ].every(
                (element) =>
                  getComputedStyle(element).borderImageRepeat === "repeat",
              ),
              iconBoxes: [
                ...document.querySelectorAll(
                  ".button-icon,.link-icon,.quick-contact-icon,.category-icon,.external-link-icon",
                ),
              ]
                .filter((icon) => icon.getClientRects().length)
                .every((icon) => {
                  const rect = icon.getBoundingClientRect();
                  const image = icon.querySelector(".site-icon");
                  const glyph = image?.getBoundingClientRect();
                  return (
                    Math.abs(rect.width - rect.height) < 1 &&
                    image &&
                    glyph.width <= rect.width &&
                    glyph.height <= rect.height &&
                    Math.abs(
                      rect.left +
                        rect.width / 2 -
                        (glyph.left + glyph.width / 2),
                    ) < 1 &&
                    Math.abs(
                      rect.top +
                        rect.height / 2 -
                        (glyph.top + glyph.height / 2),
                    ) < 1
                  );
                }),
              coloredIcons: (() => {
                const icons = [...document.querySelectorAll(".site-icon")];
                return (
                  icons.length > 0 &&
                  icons.every(
                    (icon) =>
                      !getComputedStyle(icon).filter.includes("grayscale"),
                  )
                );
              })(),
              beveledIcons: [...document.querySelectorAll(".site-icon")].every(
                (icon) => {
                  const face = icon.querySelector(".site-icon-face");
                  return (
                    icon.dataset.finish === "beveled" &&
                    face &&
                    (
                      getComputedStyle(icon).filter.match(/drop-shadow\(/g) ||
                      []
                    ).length === 2 &&
                    getComputedStyle(face).maskImage !== "none" &&
                    getComputedStyle(
                      face,
                      "::before",
                    ).backgroundImage.startsWith("linear-gradient(")
                  );
                },
              ),
              localIcons: [...document.querySelectorAll(".site-icon")].every(
                (icon) => {
                  const style = getComputedStyle(
                    icon.querySelector(".site-icon-face"),
                  );
                  const source =
                    style.maskImage !== "none"
                      ? style.maskImage
                      : style.backgroundImage;
                  return (
                    new URL(source.slice(5, -2), location.href).origin ===
                    location.origin
                  );
                },
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
                  (link.classList.contains("quick-contact-link")
                    ? !link.querySelector(".external-link-icon")
                    : Boolean(link.querySelector(".external-link-icon"))),
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
              numericValuesFit: [...document.querySelectorAll(".statistic dd")]
                .filter((value) => value.getClientRects().length)
                .every((value) => {
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
              rusticGeometry: (() => {
                const sections = [
                  ...document.querySelectorAll(".category-card"),
                ];
                return sections.every((card) => {
                  const style = getComputedStyle(card);
                  const summary = card.querySelector(".category-summary");
                  const links = card.querySelector(".category-links");
                  const summaryRect = summary.getBoundingClientRect();
                  const listRect = links.getBoundingClientRect();
                  const linkStyle = getComputedStyle(links);
                  const icon = card
                    .querySelector(".category-icon")
                    .getBoundingClientRect();
                  return (
                    style.gridTemplateColumns.split(" ").length === 1 &&
                    Math.abs(icon.width - icon.height) < 1 &&
                    summaryRect.bottom <= listRect.top &&
                    Math.abs(summaryRect.width - listRect.width) < 1 &&
                    parseFloat(linkStyle.borderInlineStartWidth) === 0
                  );
                });
              })(),
              contiguousLists: [
                ...document.querySelectorAll(".category-preview"),
              ].every((list) => {
                const style = getComputedStyle(list);
                const items = [...list.children];
                return (
                  style.rowGap === "0px" &&
                  style.borderRadius === "0px" &&
                  parseFloat(style.borderLeftWidth) === 0 &&
                  parseFloat(style.borderRightWidth) === 0 &&
                  parseFloat(style.borderTopWidth) +
                    parseFloat(
                      getComputedStyle(list.previousElementSibling)
                        .borderBottomWidth,
                    ) ===
                    1 &&
                  parseFloat(style.borderBottomWidth) === 1 &&
                  style.boxShadow === "none" &&
                  items.every((item, index) => {
                    const link = item.querySelector("a");
                    const row = link.getBoundingClientRect();
                    const rowStyle = getComputedStyle(link);
                    const itemStyle = getComputedStyle(item);
                    return (
                      row.height >=
                        (document.querySelector(".page-content").clientWidth >=
                          448 && !matchMedia("(pointer: coarse)").matches
                          ? 32
                          : 44) &&
                      getComputedStyle(
                        link.querySelector(".link-summary"),
                      ).gridTemplateColumns.split(" ").length === 3 &&
                      rowStyle.borderRadius === "0px" &&
                      parseFloat(rowStyle.paddingTop) > 0 &&
                      parseFloat(rowStyle.paddingLeft) >
                        parseFloat(rowStyle.paddingTop) &&
                      rowStyle.paddingLeft === rowStyle.paddingRight &&
                      parseFloat(itemStyle.borderTopWidth) ===
                        (index ? 1 : 0) &&
                      (!index ||
                        Math.abs(
                          item.getBoundingClientRect().top -
                            items[index - 1].getBoundingClientRect().bottom,
                        ) < 1)
                    );
                  })
                );
              }),
              squareQuickAccess: (() => {
                const grid = document.querySelector(".quick-contacts");
                const buttons = [...grid.children];
                const columns =
                  getComputedStyle(grid).gridTemplateColumns.split(" ").length;
                return (
                  buttons.length === 8 &&
                  columns ===
                    (document.querySelector(".site-shell").clientWidth >= 576
                      ? 8
                      : 4) &&
                  buttons.every((button) => {
                    const rect = button.getBoundingClientRect();
                    return (
                      Math.abs(rect.width - rect.height) < 1 &&
                      rect.width >=
                        parseFloat(getComputedStyle(button).minHeight) - 1 &&
                      Math.abs(
                        rect.width - buttons[0].getBoundingClientRect().width,
                      ) < 1
                    );
                  })
                );
              })(),
              layeredBackground: (() => {
                const world = document.querySelector(".world-scene");
                const landscape = getComputedStyle(
                  document.querySelector(".world-landscape"),
                );
                const dim = document
                  .querySelector(".world-dim")
                  .getBoundingClientRect();
                return (
                  getComputedStyle(world).position === "fixed" &&
                  landscape.filter.includes("blur(8px)") &&
                  dim.top === 0 &&
                  dim.left === 0 &&
                  dim.height === innerHeight &&
                  getComputedStyle(document.querySelector(".site-shell"))
                    .filter === "none"
                );
              })(),
              minimalContext: (() => {
                const introduction =
                  document.querySelector(".home-introduction");
                if (!introduction) return true;
                const grid = introduction.querySelector(".about-context-grid");
                const site = introduction.querySelector(".about-site");
                const siteStyle = getComputedStyle(site);
                const wide =
                  document.querySelector(".site-shell").clientWidth >= 448;
                const rect = introduction.getBoundingClientRect();
                const navigation = document.querySelector(".footer-navigation");
                return (
                  introduction.querySelectorAll(".about-fact").length === 3 &&
                  introduction.querySelectorAll(".about-topics > li").length ===
                    5 &&
                  !introduction.querySelector(
                    "a,button,details,.presentation-title,.presentation-intro,.presentation-focus",
                  ) &&
                  getComputedStyle(grid).gridTemplateColumns.split(" ")
                    .length === (wide ? 2 : 1) &&
                  (wide
                    ? parseFloat(siteStyle.borderInlineStartWidth) === 1 &&
                      parseFloat(siteStyle.borderBlockStartWidth) === 0 &&
                      rect.height < rect.width
                    : parseFloat(siteStyle.borderBlockStartWidth) === 1 &&
                      parseFloat(siteStyle.borderInlineStartWidth) === 0) &&
                  [
                    ...introduction.querySelectorAll(
                      ".about-fact-icon,.about-topic-check",
                    ),
                  ].every((icon) => {
                    const box = icon.getBoundingClientRect();
                    return Math.abs(box.width - box.height) < 1;
                  }) &&
                  navigation.closest(".site-footer") !== null &&
                  navigation.getBoundingClientRect().top >=
                    document
                      .querySelector(".home-updates")
                      .getBoundingClientRect().bottom &&
                  navigation.querySelectorAll(".footer-navigation-links a")
                    .length === 15
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
                  !card.querySelector(".category-main-link") &&
                  !card.querySelector(".category-title a") &&
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
                return (
                  getComputedStyle(link).position === "relative" &&
                  link.parentElement.matches("li") &&
                  link.parentElement.closest("a") === null
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
            "navigationCompact",
            "controlsFit",
            "noControlMotion",
            "iconBoxes",
            "repeatingFrames",
            "railConnections",
            "railContentClearance",
            "anchoredLanterns",
            "coloredIcons",
            "beveledIcons",
            "localIcons",
            "externalLinks",
            "footerDisclaimer",
            "calendarUptime",
            "uniformMedia",
            "galleryAligned",
            "categoryPreviewColumns",
            "rusticGeometry",
            "contiguousLists",
            "squareQuickAccess",
            "layeredBackground",
            "minimalContext",
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
            previews: [...card.querySelectorAll("[data-preview-id]")].map(
              (link) => ({ id: link.dataset.previewId, href: link.href }),
            ),
          })),
        );
        const expectedCategories = pagesFor(config, route.language)
          .filter((entry) => entry.type === "links-page")
          .map((entry) => ({
            id: entry.id,
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
        assert.deepEqual(
          await page.$$eval(
            '[data-home-update="now"] [data-preview-id]',
            (links) =>
              links.map((link) => ({
                id: link.dataset.previewId,
                href: link.href,
              })),
          ),
          (config.now[route.language] || config.now.en).sections.map(
            (section) => ({
              id: `now-${section.id}`,
              href: `${href(nowPage.url)}#now-${section.id}`,
            }),
          ),
        );
        if (route.language === config.language_options[0].id) {
          await page.evaluate(() => {
            window.linkClicks = [];
            document.addEventListener("click", (event) => {
              const anchor = event.target.closest("a");
              if (!anchor) return;
              event.preventDefault();
              window.linkClicks.push(anchor.href);
            });
          });
          for (const anchor of await page.$$(".category-preview-link")) {
            const expected = await anchor.evaluate((link) => link.href);
            await anchor.click();
            assert.equal(
              await page.evaluate(() => window.linkClicks.at(-1)),
              expected,
            );
          }
          for (const card of await page.$$(".category-card")) {
            await card.evaluate((element) =>
              element.scrollIntoView({ block: "center", behavior: "instant" }),
            );
            const previousClickCount = await page.evaluate(
              () => window.linkClicks.length,
            );
            const rect = await card.boundingBox();
            await page.mouse.click(rect.x + 12, rect.y + 12);
            assert.equal(
              await page.evaluate(() => window.linkClicks.length),
              previousClickCount,
            );
          }
          await page.focus(".category-preview-link");
          assert.equal(
            await page.$eval(":focus", (link) =>
              link.classList.contains("category-preview-link"),
            ),
            true,
          );
          const expected = await page.$eval(":focus", (link) => link.href);
          await page.keyboard.press("Enter");
          assert.equal(
            await page.evaluate(() => window.linkClicks.at(-1)),
            expected,
          );
          await page.reload({ waitUntil: "networkidle2" });
        }
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
        ["home", ...config.navigation.sections, "now"].includes(route.id)
      ) {
        const original = await page.evaluate(() =>
          [
            ".category-title a",
            ".category-description",
            ".category-preview-link .link-title",
            ".link-title",
            ".link-url-text",
          ].flatMap((selector) => {
            const element = document.querySelector(selector);
            if (!element) return [];
            const text = element.textContent;
            element.textContent = text.repeat(6);
            return [{ selector, text }];
          }),
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
        await page.evaluate(
          () => (document.documentElement.style.fontSize = "200%"),
        );
        for (const width of widths) {
          await page.setViewport({ width, height: 900 });
          const enlarged = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            contentFits: [
              ...document.querySelectorAll(
                ".category-summary,.category-preview-link,.link-button,.presentation-copy,.presentation-focus",
              ),
            ].every(
              (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
          }));
          assert.equal(
            enlarged.overflow,
            false,
            `${route.url} text enlarged at ${width}`,
          );
          assert.equal(
            enlarged.contentFits,
            true,
            `${route.url} enlarged content fit at ${width}`,
          );
          checks.push({
            path: route.url,
            width,
            enlargedText: true,
            passed: true,
          });
        }
        await page.evaluate(() =>
          document.documentElement.style.removeProperty("font-size"),
        );
      }
      const control =
        (await page.$(".link-button")) ||
        (await page.$(".section-switcher-trigger"));
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
      console.log(JSON.stringify({ path: route.url, layout: "passed" }));
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
      await page.focus(".section-switcher-trigger");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.$eval(".section-switcher", (details) => details.open),
        true,
      );
      assert.equal(
        await page.$eval(
          ".section-menu-link",
          (tab) => tab.getBoundingClientRect().height >= 44,
        ),
        true,
      );
      const destination = pagesFor(config, route.language).find(
        (entry) =>
          entry.id !== route.id && ["home", "links-page"].includes(entry.type),
      );
      await page.focus(
        `.section-menu-link[href="${new URL(href(destination.url)).pathname}"]`,
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
    for (const language of config.language_options) {
      for (const id of ["start-here", "networks", "personal"]) {
        for (const suffix of ["/", ""]) {
          const response = await fetch(href(`${language.path}${id}${suffix}`), {
            redirect: "manual",
          });
          assert.equal(
            response.status,
            404,
            `${language.path}${id}${suffix} must return 404`,
          );
        }
      }
    }
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
    await require("./check-navigation-browser.cjs")(
      browser,
      base.href,
      reportDirectory,
    );
    await require("./check-language-browser.cjs")(browser, base.href);
    await require("./check-link-view-browser.cjs")(
      browser,
      base.href,
      reportDirectory,
    );
    await require("./check-compact-controls.cjs")(
      browser,
      base.href,
      reportDirectory,
    );
    await require("./check-terminal-browser.cjs")(
      browser,
      base.href,
      reportDirectory,
    );
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
