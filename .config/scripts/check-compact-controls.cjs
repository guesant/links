const assert = require("node:assert/strict");
const fs = require("node:fs");
const { readConfiguration } = require("./configuration.cjs");

module.exports = async function checkCompactControls(
  browser,
  baseURL,
  reportDirectory,
) {
  const config = readConfiguration();
  const context = await browser.createBrowserContext();
  const checks = [];
  try {
    const page = await context.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "languages", { get: () => ["en-US"] });
    });
    for (const language of config.language_options) {
      for (const suffix of ["", "career/"]) {
        const url = new URL(
          `${language.path}${suffix}`.replace(/^\//, ""),
          baseURL,
        ).href;
        await page.goto(url, { waitUntil: "networkidle2" });
        for (const theme of ["dark", "light"]) {
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          for (const width of [320, 390, 768, 1024, 1440]) {
            await page.setViewport({ width, height: 900 });
            const actual = await page.evaluate(() => {
              const footer = document
                .querySelector(".site-footer")
                .getBoundingClientRect();
              const group = document
                .querySelector(".site-footer-content")
                .getBoundingClientRect();
              const buttons = [
                ...document.querySelectorAll(".site-footer-content > *"),
              ];
              const toolbar = document
                .querySelector(".link-view-toolbar")
                .getBoundingClientRect();
              const options = document
                .querySelector(".link-view-options")
                .getBoundingClientRect();
              const controls = [...document.querySelectorAll(".icon-control")];
              const size =
                parseFloat(
                  getComputedStyle(document.documentElement).getPropertyValue(
                    "--control-min-height",
                  ),
                ) *
                parseFloat(getComputedStyle(document.documentElement).fontSize);
              return {
                count: buttons.length,
                centered:
                  Math.abs(
                    footer.left +
                      footer.width / 2 -
                      group.left -
                      group.width / 2,
                  ) < 1,
                rightAligned: Math.abs(options.right - toolbar.right) < 1,
                intrinsicGroup: group.width < footer.width,
                squareTargets: controls.every(
                  (control) =>
                    Math.abs(control.offsetWidth - size) < 1 &&
                    Math.abs(control.offsetHeight - size) < 1,
                ),
                iconOnly: controls.every((control) =>
                  [...control.childNodes]
                    .filter((node) => node.nodeType === Node.TEXT_NODE)
                    .every((node) => !node.textContent.trim()),
                ),
                metadataSeparate:
                  !document.querySelector(
                    ".site-footer-content .site-footer-commit,.site-footer-content .site-footer-build",
                  ) &&
                  Boolean(
                    document.querySelector(
                      ".site-footer-meta .site-footer-commit",
                    ),
                  ) &&
                  Boolean(
                    document.querySelector(
                      ".site-footer-meta a.site-footer-build",
                    ),
                  ),
                named:
                  buttons.every((button) =>
                    Boolean(button.getAttribute("aria-label")),
                  ) &&
                  [
                    ...document.querySelectorAll(".link-view-options label"),
                  ].every((label) =>
                    Boolean(
                      label
                        .querySelector(".visually-hidden")
                        .textContent.trim(),
                    ),
                  ),
                overflow: document.documentElement.scrollWidth > innerWidth,
                compactHeight: toolbar.height < size * 1.5,
              };
            });
            assert.equal(actual.count, 5);
            assert.equal(
              actual.overflow,
              false,
              `${url} ${theme} ${width} overflow`,
            );
            for (const [key, value] of Object.entries(actual)) {
              if (!["count", "overflow"].includes(key))
                assert.equal(value, true, `${url} ${theme} ${width} ${key}`);
            }
            checks.push({ language: language.id, suffix, theme, width });
          }
        }
        await page.setViewport({ width: 320, height: 900 });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        for (const selector of [
          "label[for=link-view-compact]",
          "label[for=link-view-detailed]",
          ".site-footer-repository",
          "[data-credits-open]",
          "[data-settings-open]",
        ]) {
          await page.hover(selector);
          assert.equal(
            await page.$eval(`${selector} .control-tooltip`, (element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.left >= 0 &&
                rect.right <= innerWidth &&
                element.scrollWidth <= element.clientWidth
              );
            }),
            true,
            `${language.id} ${selector} enlarged tooltip`,
          );
        }
        await page.evaluate(() => {
          document.documentElement.style.removeProperty("font-size");
        });
      }
    }
    await page.goto(new URL("pt-br/", baseURL).href, {
      waitUntil: "networkidle2",
    });
    for (const width of [320, 1024]) {
      await page.setViewport({ width, height: 900 });
      for (const selector of [
        "label[for=link-view-compact]",
        "label[for=link-view-detailed]",
        ".site-footer-repository",
        "[data-credits-open]",
        "[data-settings-open]",
      ]) {
        await page.hover(selector);
        const tooltip = `${selector} .control-tooltip`;
        assert.equal(
          await page.$eval(
            tooltip,
            (element) => getComputedStyle(element).visibility,
          ),
          "visible",
        );
        const rect = await page.$eval(tooltip, (element) => {
          const r = element.getBoundingClientRect();
          return { left: r.left, right: r.right };
        });
        assert(
          rect.left >= 0 && rect.right <= width,
          `${selector} tooltip at ${width}`,
        );
        await page.hover(tooltip);
        assert.equal(
          await page.$eval(
            tooltip,
            (element) => getComputedStyle(element).visibility,
          ),
          "visible",
        );
        await page.keyboard.press("Escape");
        assert.equal(
          await page.$eval(
            tooltip,
            (element) => getComputedStyle(element).visibility,
          ),
          "hidden",
        );
        await page.mouse.move(0, 0);
        const focus = selector.startsWith("label")
          ? `#${selector.includes("detailed") ? "link-view-detailed" : "link-view-compact"}`
          : selector;
        await page.focus(focus);
        await page.keyboard.press("Tab");
        await page.keyboard.down("Shift");
        await page.keyboard.press("Tab");
        await page.keyboard.up("Shift");
        if (!selector.startsWith("label"))
          assert.equal(
            await page.$eval(
              tooltip,
              (element) => getComputedStyle(element).visibility,
            ),
            "visible",
          );
      }
      await page.click("[data-credits-open]");
      assert.equal(
        await page.$eval("#credits-dialog", (dialog) => dialog.open),
        true,
      );
      await page.keyboard.press("Escape");
      await page.click("[data-settings-open]");
      assert.equal(
        await page.$eval("#settings-dialog", (dialog) => dialog.open),
        true,
      );
      await page.keyboard.press("Escape");
      await page.focus("#link-view-compact");
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.$eval(
          "label[for=link-view-detailed] .control-tooltip",
          (element) => getComputedStyle(element).visibility,
        ),
        "visible",
      );
      assert.equal(
        await page.$eval("#link-view-detailed", (input) => input.checked),
        true,
      );
      await page.keyboard.press("ArrowLeft");
      assert.equal(
        await page.$eval("#link-view-compact", (input) => input.checked),
        true,
      );
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
      await page.mouse.move(0, 0);
      await page.$eval("body", (element) => {
        element.tabIndex = -1;
        element.focus();
      });
      for (const selector of [".link-view-control", ".site-footer"]) {
        const element = await page.$(selector);
        await element.screenshot({
          path: `${reportDirectory}/compact-${selector.slice(1)}-${width}.png`,
        });
      }
    }
    fs.writeFileSync(
      `${reportDirectory}/compact-controls.json`,
      JSON.stringify({ passed: checks.length, checks }, null, 2),
    );
    console.log(
      JSON.stringify({ compactControlsChecks: checks.length, failures: [] }),
    );
  } finally {
    await context.close();
  }
};
