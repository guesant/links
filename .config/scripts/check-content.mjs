import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import configuration from "./configuration.cjs";

const { parse, stringify } = createRequire(import.meta.url)("yaml");
const source = parse(await readFile("src/data/links.yaml", "utf8"));
const collectHTML = async (directory, extension = ".html") => {
  let html = "";
  for (const file of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, file.name);
    if (file.isDirectory()) html += await collectHTML(path, extension);
    else if (file.name.endsWith(extension))
      html += await readFile(path, "utf8");
  }
  return html;
};
async function fixture(
  mutate,
  inspect,
  environment = {},
  editorialFixture,
  federationFixture,
  layoutFixture,
) {
  const directory = await mkdtemp(join(tmpdir(), "links-content-"));
  try {
    const data = join(directory, "data");
    const output = join(directory, "public");
    await mkdir(data);
    const config = structuredClone(source);
    mutate(config);
    await writeFile(join(data, "links.yaml"), stringify(config));
    await copyFile("src/data/credits.yaml", join(data, "credits.yaml"));
    await copyFile("src/data/statistics.yaml", join(data, "statistics.yaml"));
    if (editorialFixture) {
      await writeFile(
        join(data, "editorial.yaml"),
        stringify(editorialFixture),
      );
    } else {
      await copyFile("src/data/editorial.yaml", join(data, "editorial.yaml"));
    }
    const configPath = join(directory, "hugo.toml");
    let federationMount = "";
    let layoutMount = "";
    if (layoutFixture) {
      const layouts = join(directory, "layouts");
      for (const [name, content] of Object.entries(layoutFixture)) {
        const path = join(layouts, name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
      }
      layoutMount = `\n[[module.mounts]]\nsource = ${JSON.stringify(layouts)}\ntarget = "layouts"\n[[module.mounts]]\nsource = ${JSON.stringify(resolve("src/layouts"))}\ntarget = "layouts"\n`;
    }
    if (federationFixture) {
      const assets = join(directory, "assets");
      await mkdir(assets);
      await writeFile(
        join(assets, "federation.json"),
        JSON.stringify(federationFixture),
      );
      federationMount = `\n[[module.mounts]]\nsource = ${JSON.stringify(assets)}\ntarget = "assets"\n`;
    }
    await writeFile(
      configPath,
      (await readFile(".config/hugo.toml", "utf8")).replace(
        /\[\[module\.mounts\]\]\nsource = '\.\.\/\.cache\/federation\/assets'\ntarget = 'assets'\n/,
        "",
      ) +
        `\n[[module.mounts]]\nsource = ${JSON.stringify(data)}\ntarget = "data"\n` +
        federationMount +
        layoutMount,
    );
    const result = spawnSync(
      "hugo",
      [
        "--source",
        resolve("src"),
        "--config",
        configPath,
        "--destination",
        output,
        "--baseURL",
        "https://example.invalid/prefix/",
        "--minify",
      ],
      { encoding: "utf8", env: { ...process.env, ...environment } },
    );
    await inspect(result, output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test("third-party badges distinguish owned hosts, external platforms and contact links", async () => {
  const cases = [
    ["https://guesant.net/", false],
    ["https://blog.guesant.net/", false],
    ["https://one.two.guesant.net/", false],
    ["https://GUESANT.NET.:443/", false],
    ["https://github.com/guesant", true],
    ["https://guesant.net.evil.test/", true],
    ["https://notguesant.net/", true],
    ["mailto:hello@guesant.net", false],
    ["tel:+5511999999999", false],
    ["/pt-br/career/", false],
  ];
  await fixture(
    (config) => {
      const section = config.sections.find(
        (section) => section.id === "career",
      );
      const original = section.links[0];
      for (const [index, [url]] of cases.entries()) {
        const entry = structuredClone(original);
        entry.id = `party-fixture-${index}`;
        entry.url = url;
        delete entry.localized_urls;
        delete entry.visual;
        delete entry.stats;
        section.links.push(entry);
      }
    },
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        for (const path of ["index.html", "career/index.html"]) {
          const html = await readFile(
            join(output, language.path, path),
            "utf8",
          );
          for (const [index, [url, thirdParty]] of cases.entries()) {
            const card = html.match(
              new RegExp(
                `<a\\b[^>]*\\bdata-link-id=["']?party-fixture-${index}["' >][\\s\\S]*?<\\/a>`,
              ),
            );
            assert(card, url);
            assert.equal(
              card[0].includes("link-third-party-badge"),
              thirdParty,
              url,
            );
            if (thirdParty)
              assert(
                card[0].includes(source.locales[language.id].ui.third_party),
              );
          }
        }
      }
    },
  );
});
test("footer icons keep build metadata in a separate localized text paragraph", async () => {
  const commit = "1234567890abcdef1234567890abcdef12345678";
  const run = "123456";
  const date = "2026-10-27T12:34:00Z";
  const dateLabel = "2026-10-27 12:34 UTC";
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        const nav = html.match(
          /<nav class=site-footer-content\b[^>]*>([\s\S]*?)<\/nav>/,
        )[1];
        const metadata = html.match(
          /<p class=site-footer-meta>([\s\S]*?)<\/p>/,
        )[1];
        assert.equal((nav.match(/data-tooltip/g) || []).length, 5);
        assert.equal((nav.match(/aria-label=/g) || []).length, 5);
        assert.doesNotMatch(nav, /site-footer-(?:commit|build)/);
        assert.doesNotMatch(metadata, /button|button-icon|icon-control/);
        assert(metadata.includes(`/commit/${commit}`));
        assert(metadata.includes(`/actions/runs/${run}`));
        assert(
          metadata.includes(
            `${source.locales[language.id].ui.footer_version} ${commit.slice(0, 7)}`,
          ),
        );
        assert(
          metadata.includes(source.locales[language.id].ui.footer_workflow),
        );
        assert(metadata.includes(date));
        assert(metadata.includes(dateLabel));
      }
    },
    {
      HUGO_GITHUB_SHA: commit,
      HUGO_GITHUB_RUN_ID: run,
      HUGO_BUILD_DATE: date,
      HUGO_BUILD_DATE_LABEL: dateLabel,
    },
  );
});
test("Hugo excludes disabled and private editorial data", async () => {
  await fixture(
    (config) => {
      const section = config.sections.find(
        (entry) => entry.id === config.navigation.sections[0],
      );
      section.public = false;
      for (const labels of Object.values(section.labels))
        labels.title = "private-section-fixture";
      for (const link of section.links) {
        link.url = "https://example.invalid/private-link-fixture";
        delete link.localized_urls;
      }
      const disabled = config.sections.find(
        (entry) => entry.id === config.navigation.sections[1],
      ).links[0];
      disabled.enabled = false;
      disabled.url = "https://example.invalid/disabled-link-fixture";
      config.profile.same_as_links.push(disabled.id, section.links[0].id);
      for (const labels of Object.values(disabled.labels))
        labels.title = "disabled-link-fixture";
    },
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      const html = await collectHTML(output);
      assert.doesNotMatch(html, /<svg\b|\.svg\b|image\/svg/i);
      for (const value of [
        "private-section-fixture",
        "private-link-fixture",
        "disabled-link-fixture",
      ])
        assert(!html.includes(value));
      assert(html.includes("/prefix/pt-br/"));
      assert(html.includes("/prefix/pt-br/learning/"));
    },
  );
});
const expectedSections = {
  career: ["curriculum", "linkedin", "lattes", "orcid"],
  code: ["github-repositories", "github-stats", "gitlab", "youtube"],
  writing: ["blog", "dev-community", "medium"],
  learning: ["atlas", "leetcode", "hyperskill"],
  reading: ["open-library"],
  music: ["lastfm", "spotify"],
  games: ["playstation", "steam", "xbox", "minecraft"],
  profiles: ["instagram", "personal-youtube"],
  contact: ["email", "linkedin"],
};
test("Hugo emits prefixed language routing data for each page", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "code/index.html"),
          "utf8",
        );
        assert.match(html, /data-language-config=/);
        assert(html.includes('"neutral":false'));
        assert.match(html, /data-language=pt-br|data-language="pt-br"/);
        assert(html.includes("/prefix/pt-br/code/"));
        assert(!html.includes("/prefix/prefix/"));
      }
    },
  );
});
test("all content routes are localized and the root only selects a language", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      const root = await readFile(join(output, "index.html"), "utf8");
      assert(root.includes('"neutral":true'));
      assert(root.includes('"current":""'));
      assert(root.includes("/prefix/en/"));
      assert.match(
        root,
        /<noscript><meta http-equiv=refresh content="0; url=\/prefix\/pt-br\/">/,
      );
      assert.doesNotMatch(root, /<main\b|class=site-shell/);
      const xml = await collectHTML(output, ".xml");
      for (const language of source.language_options) {
        assert.equal(language.path, `/${language.id}/`);
        for (const page of configuration
          .pagesFor(source, language.id)
          .filter((page) => !page.fallback)) {
          assert(page.url.startsWith(language.path));
          const html = await readFile(
            join(output, page.url, "index.html"),
            "utf8",
          );
          assert(
            html.includes(`href=https://example.invalid/prefix${page.url}`),
          );
          assert(html.includes('"neutral":false'));
          assert(xml.includes(`https://example.invalid/prefix${page.url}`));
        }
      }
      for (const path of [...source.navigation.sections, "now", "agora"]) {
        await assert.rejects(readFile(join(output, path, "index.html")), {
          code: "ENOENT",
        });
        assert(
          !xml.includes(`<loc>https://example.invalid/prefix/${path}/</loc>`),
        );
      }
      assert(!xml.includes("<loc>https://example.invalid/prefix/</loc>"));
    },
  );
});
test("Hugo rejects an unknown default language preference", async () => {
  await fixture(
    (config) => {
      config.language_preference.default = "unknown";
    },
    async (result) => {
      assert.notEqual(result.status, 0);
      assert(
        result.stderr.includes(
          "language_preference.default must reference a known language",
        ),
        result.stderr,
      );
    },
  );
});
test("link display shares one renderer and localized controls", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const labels = source.locales[language.id].ui;
        for (const page of ["index.html", "career/index.html"]) {
          const html = await readFile(
            join(output, language.path, page),
            "utf8",
          );
          assert.match(html, /data-link-view=["']?compact/);
          assert.equal(
            (html.match(/\bclass=["']?link-view-control["' >]/g) || []).length,
            1,
          );
          for (const name of [
            "link_view_label",
            "link_view_compact",
            "link_view_detailed",
          ])
            assert(html.includes(labels[name]));
          const ids = [...html.matchAll(/\bdata-link-id=["']?([^"' >]+)/g)].map(
            (entry) => entry[1],
          );
          assert.equal(ids.filter((id) => id === "curriculum").length, 1);
          assert(html.includes("link-description"));
          assert(html.includes("link-badge"));
        }
      }
      assert.doesNotMatch(
        await readFile(join(output, "en/now/index.html"), "utf8"),
        /<fieldset\b[^>]*\bclass=["']?link-view-control/,
      );
    },
  );
});
test("thematic pages preserve link order and use one canonical LinkedIn entry", () => {
  assert.deepEqual(source.navigation.sections, [
    ...Object.keys(expectedSections),
    "interests",
    "uses",
    "library",
    "curiosities",
  ]);
  assert.equal(
    configuration
      .visibleLinks(source)
      .filter((entry) => entry.id === "linkedin").length,
    1,
  );
  for (const language of source.language_options) {
    const pages = configuration.pagesFor(source, language.id);
    assert.deepEqual(
      pages.filter((page) => page.type === "links-page").map((page) => page.id),
      [
        ...Object.keys(expectedSections),
        "interests",
        "uses",
        "library",
        "curiosities",
      ],
    );
    for (const [id, expected] of Object.entries(expectedSections)) {
      const page = pages.find((page) => page.id === id);
      assert.equal(page.url, `${language.path}${id}/`);
      assert.deepEqual(
        page.links.map((link) => link.id),
        expected,
      );
    }
  }
});
for (const mode of [
  "unknown",
  "duplicate",
  "private",
  "disabled",
  "private-owner",
  "disabled-owner",
]) {
  test(`section references handle ${mode} targets in Hugo and JavaScript`, async () => {
    let fixtureConfiguration;
    await fixture(
      (config) => {
        fixtureConfiguration = config;
        const career = config.sections.find(
          (section) => section.id === "career",
        );
        const contact = config.sections.find(
          (section) => section.id === "contact",
        );
        const linkedin = career.links.find((link) => link.id === "linkedin");
        if (mode === "unknown")
          contact.link_refs = ["unknown-reference-fixture"];
        else if (mode === "duplicate") contact.link_refs.push("linkedin");
        else if (mode === "private") linkedin.public = false;
        else if (mode === "disabled") linkedin.enabled = false;
        else if (mode === "private-owner") career.public = false;
        else career.enabled = false;
      },
      async (result, output) => {
        const config = fixtureConfiguration;
        const contact = config.sections.find(
          (section) => section.id === "contact",
        );
        if (["unknown", "duplicate"].includes(mode)) {
          assert.notEqual(result.status, 0);
          assert.match(
            result.stderr,
            /unknown link reference|duplicate section link/,
          );
          assert.throws(() => configuration.linksForSection(config, contact));
        } else {
          assert.equal(result.status, 0, result.stderr);
          assert.deepEqual(
            configuration
              .linksForSection(config, contact)
              .map((link) => link.id),
            ["email"],
          );
          const html = await collectHTML(output);
          assert(
            !html.includes("https://www.linkedin.com/in/gabrielrodantunes/"),
          );
        }
      },
    );
  });
}
test("Hugo publishes thematic pages without legacy routes or aliases", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      const xml = await collectHTML(output, ".xml");
      for (const language of source.language_options) {
        const terminalHomePath = `${language.path}terminal/index.html`;
        const terminalHome = await readFile(
          join(output, terminalHomePath),
          "utf8",
        );
        assert.match(terminalHome, /data-interface=terminal/);
        assert.match(terminalHome, /class=terminal-app/);
        assert.match(terminalHome, /\/css\/terminal\.min\./);
        assert.doesNotMatch(terminalHome, /\/css\/minecraft\.min\./);
        assert.doesNotMatch(
          terminalHome,
          /world-scene|suspended-content|suspension-rails/,
        );
        assert.match(
          terminalHome,
          new RegExp(`${language.path}terminal/career/`),
        );
        const home = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        assert.match(home, /\/css\/minecraft\.min\./);
        assert.match(home, /home-introduction/);
        assert.doesNotMatch(home, /\/css\/terminal\.min\./);
        assert.doesNotMatch(
          home,
          /terminal-command|terminal-navigation-command/,
        );
        assert.doesNotMatch(home, /class=category-main-link/);
        assert.doesNotMatch(home, /class=category-title[^>]*>\s*<a/);
        for (const old of ["start-here", "networks", "personal"]) {
          const path = `${language.path}${old}/`;
          await assert.rejects(readFile(join(output, path, "index.html")), {
            code: "ENOENT",
          });
          assert(!xml.includes(path));
        }
        for (const id of source.navigation.sections) {
          const path = `${language.path}${id}/`;
          const html = await readFile(join(output, path, "index.html"), "utf8");
          assert(html.includes(path));
          assert(xml.includes(path));
          assert.doesNotMatch(html, /http-equiv=["']?refresh/i);
          assert.match(html, /page-introduction/);
          assert.doesNotMatch(html, /home-introduction|about-context-grid/);
          const terminalPath = `${language.path}terminal/${id}/index.html`;
          const terminalHTML = await readFile(
            join(output, terminalPath),
            "utf8",
          );
          assert.match(terminalHTML, /data-interface=terminal/);
          assert.match(terminalHTML, /\/css\/terminal\.min\./);
          assert.doesNotMatch(terminalHTML, /\/css\/minecraft\.min\./);
          assert.match(terminalHTML, new RegExp(`cd ~/${id}/`));
          assert.doesNotMatch(
            terminalHTML,
            /world-scene|suspended-content|suspension-rails/,
          );
          assert.match(
            terminalHTML,
            new RegExp(`${language.path}terminal/${id}/`),
          );
        }
        if (language.id === "en" || language.id === "pt-br") {
          const terminalNow = await readFile(
            join(output, `${language.path}terminal/now/index.html`),
            "utf8",
          );
          assert.match(terminalNow, /data-interface=terminal/);
          assert.match(terminalNow, /now-current-focus/);
        }
      }
      for (const path of ["en/now/index.html", "pt-br/agora/index.html"]) {
        const html = await readFile(join(output, path), "utf8");
        assert(html.includes("now-current-focus"));
        assert.match(html, /page-introduction/);
        assert.doesNotMatch(html, /home-introduction|about-context-grid/);
      }
    },
  );
});
test("quick contacts omit external markers without changing other link markers", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        const quickContacts = html.match(
          /<div\b[^>]*\bclass=["']?quick-contacts\b[^>]*>[\s\S]*?<\/div>/,
        )?.[0];
        assert(quickContacts);
        assert.doesNotMatch(quickContacts, /\bexternal-link-icon\b/);
        assert.equal(
          (quickContacts.match(/\bclass=["']?quick-contact-link\b/g) || [])
            .length,
          source.quick_contacts.length,
        );
        const previews = html.match(
          /<ul\b[^>]*\bclass=["']?category-preview\b[^>]*>[\s\S]*?<\/ul>/,
        )?.[0];
        assert(previews);
        assert.match(previews, /\bexternal-link-icon\b/);
      }
    },
  );
});
test("Hugo rejects unsafe enabled URLs", async () => {
  await fixture(
    (config) => {
      config.sections[0].links[0].url = "javascript:alert(1)";
    },
    async (result) => {
      assert.notEqual(result.status, 0);
      assert(result.stderr.includes("unsupported URL protocol"));
    },
  );
});
test("Now child links resolve an installation prefix only once", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        const article = html.match(
          /<article\b[^>]*\bdata-home-update=["']?now\b[^>]*>[\s\S]*?<\/article>/,
        )?.[0];
        assert(article);
        const actual = [...article.matchAll(/\bhref=["']?([^"' >]+)/g)].map(
          (match) => match[1],
        );
        const nowPage = configuration
          .pagesFor(source, language.id)
          .find((page) => page.id === "now");
        const sections = (source.now[language.id] || source.now.en).sections;
        const prefix = `/prefix${nowPage.url}`;
        assert.deepEqual(actual, [
          ...sections.map((section) => `${prefix}#now-${section.id}`),
        ]);
      }
    },
  );
});
test("section cards tolerate missing icons and optional section descriptions", async () => {
  await fixture(
    (config) => {
      for (const section of config.sections) {
        delete section.icon;
        for (const labels of Object.values(section.labels))
          delete labels.description;
        for (const link of section.links) delete link.icon;
      }
      config.home.illustration_enabled = false;
    },
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        assert.equal(
          (html.match(/\bclass=["']?category-summary\b/g) || []).length,
          source.navigation.sections.length + 1,
        );
        assert.match(html, /\bdata-platform=["']?link\b/);
        assert(!html.includes("<nil>"));
        assert.doesNotMatch(html, /\bclass=["']?presentation-art\b/);
      }
    },
  );
});
test("compact navigation and textual footer share localized public destinations", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const pages = configuration.pagesFor(source, language.id);
        const expected = pages.filter((page) =>
          ["home", "links-page"].includes(page.type),
        );
        for (const page of pages.filter((entry) => !entry.fallback)) {
          const html = await readFile(
            join(output, page.url, "index.html"),
            "utf8",
          );
          const menu = html.match(
            /<ul class=["']?section-menu-list\b[^>]*>([\s\S]*?)<\/ul>/,
          )?.[1];
          const footer = html.match(
            /<ul class=["']?footer-navigation-links\b[^>]*>([\s\S]*?)<\/ul>/,
          )?.[1];
          assert(menu && footer);
          for (const [content, entries] of [
            [menu, expected],
            [
              footer,
              [...expected, ...pages.filter((entry) => entry.id === "now")],
            ],
          ]) {
            assert.deepEqual(
              [
                ...content.matchAll(/\bdata-navigation-page=["']?([^"' >]+)/g),
              ].map((match) => match[1]),
              entries.map((entry) => entry.id),
            );
            for (const entry of entries)
              assert(content.includes(`/prefix${entry.url}`));
            assert.equal(
              (content.match(/aria-current=["']?page\b/g) || []).length,
              entries.some((entry) => entry.id === page.id) ? 1 : 0,
            );
          }
          assert.doesNotMatch(footer, /site-icon|<img\b|<button\b/);
          assert.doesNotMatch(
            html,
            /\bclass=["']?(?:page-tabs|page-updates|context-navigation)\b/,
          );
          assert(html.indexOf("page-navigation") < html.indexOf("<main"));
          assert(
            html.indexOf("page-navigation") < html.indexOf("quick-contacts"),
          );
          assert(html.indexOf("footer-navigation") > html.indexOf("</main>"));
          const ui = source.locales[language.id].ui;
          for (const key of ["navigation_label", "navigation_sections"])
            assert(html.includes(ui[key]));
        }
      }
    },
  );
});
test("minimal About uses localized facts and topics without embedded controls", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        const content = source.locales[language.id].presentation;
        assert.equal(
          (
            html.match(
              /\bclass=(?:"about-fact"|'about-fact'|about-fact(?=[ >]))/g,
            ) || []
          ).length,
          3,
        );
        assert.equal(
          (
            html.match(
              /\bclass=(?:"about-topic-check"|'about-topic-check'|about-topic-check(?=[ >]))/g,
            ) || []
          ).length,
          5,
        );
        for (const fact of content.facts) assert(html.includes(fact.text));
        for (const topic of content.topics) assert(html.includes(topic));
        const panel = html.match(
          /<section\b[^>]*class="presentation home-introduction"[^>]*>([\s\S]*?)<\/section>/,
        );
        assert(panel);
        assert.doesNotMatch(
          panel[1],
          /<(?:a|button|details)\b|presentation-(?:intro|actions|focus)/,
        );
        assert(
          html.indexOf("footer-navigation") > html.indexOf("home-updates"),
        );
      }
    },
  );
});
for (const [name, mutate, message] of [
  [
    "title",
    (content) => {
      content.title = "";
    },
    "presentation.title is required",
  ],
  [
    "facts",
    (content) => {
      content.facts = [];
    },
    "presentation.facts needs items",
  ],
  [
    "fact text",
    (content) => {
      content.facts[0].text = "";
    },
    "presentation fact needs text",
  ],
  [
    "fact icon",
    (content) => {
      content.facts[0].icon = "missing-icon";
    },
    "presentation fact needs a known PNG icon",
  ],
  [
    "site title",
    (content) => {
      content.site_title = "";
    },
    "presentation.site_title is required",
  ],
  [
    "topics",
    (content) => {
      content.topics = [];
    },
    "presentation.topics needs items",
  ],
  [
    "topic text",
    (content) => {
      content.topics[0] = "";
    },
    "presentation topic needs text",
  ],
]) {
  test(`minimal About rejects missing ${name}`, async () => {
    await fixture(
      (config) => mutate(config.locales.en.presentation),
      async (result) => {
        assert.notEqual(result.status, 0);
        assert(result.stderr.includes(message), result.stderr);
      },
    );
  });
}
test("editorial pages expose localized empty states without invented records", async () => {
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      const editorial = parse(
        await readFile("src/data/editorial.yaml", "utf8"),
      );
      for (const language of source.language_options) {
        for (const id of ["interests", "uses", "library", "curiosities"]) {
          const html = await readFile(
            join(output, language.path, id, "index.html"),
            "utf8",
          );
          assert(html.includes(editorial.ui[language.id][`empty_${id}`]));
          assert(html.includes("editorial-related"));
          assert(html.includes("search-dialog"));
          assert(html.includes("bios-dialog"));
        }
      }
    },
  );
});
test("empty imported lists keep specific messages alongside traditional links", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const home = await readFile(
          join(output, language.path, "index.html"),
          "utf8",
        );
        for (const [section, kinds] of [
          ["career", ["skill", "experience", "education"]],
          ["code", ["project", "case"]],
          ["writing", ["post", "case"]],
        ]) {
          const html = await readFile(
            join(output, language.path, section, "index.html"),
            "utf8",
          );
          for (const kind of kinds) {
            assert(html.includes(editorial.ui[language.id][`empty_${kind}`]));
            assert(home.includes(editorial.ui[language.id][`empty_${kind}`]));
          }
          assert(html.includes("data-link-id"));
          assert(html.includes("editorial-related"));
        }
        assert(home.includes(editorial.ui[language.id].search_retry));
        assert(home.includes(editorial.ui[language.id].search_loading));
      }
    },
  );
});
test("a populated case list does not hide the empty post state", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  const feed = {
    version: 1,
    items: [
      {
        id: "case-fixture",
        source: "resume",
        language: "en",
        type: "case",
        title: "Published Case Fixture",
        summary: "Case summary",
        url: "https://curriculum.guesant.net/en/#case-fixture",
        tags: [],
        metadata: {},
      },
    ],
  };
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        for (const path of ["index.html", "writing/index.html"]) {
          const html = await readFile(
            join(output, language.path, path),
            "utf8",
          );
          assert(html.includes("Published Case Fixture"));
          assert(html.includes(editorial.ui[language.id].empty_post));
          if (path !== "index.html")
            assert(!html.includes("data-empty-kind=case"));
        }
      }
    },
    {},
    undefined,
    feed,
  );
});
test("platform project labels preserve public destinations and curriculum details", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  const examples = [
    [
      "github",
      "ava-pro",
      "https://github.com/guesant/ava-pro",
      "GitHub - guesant/ava-pro",
    ],
    [
      "gitlab",
      "Project",
      "https://gitlab.com/guesant/project",
      "GitLab - guesant/project",
    ],
    [
      "youtube",
      "Project Demonstration",
      "https://www.youtube.com/watch?v=public-video",
      "YouTube - Project Demonstration",
    ],
    ["unqualified", "Published Project", "", "Published Project"],
  ];
  const feed = {
    version: 1,
    items: examples.map(([id, title, url]) => ({
      id: `project-${id}`,
      source: "resume",
      language: "en",
      type: "project",
      title,
      summary: "Public project description",
      url: `https://curriculum.guesant.net/en/#project-${id}`,
      tags: [],
      metadata: url ? { content_url: url } : {},
    })),
  };
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      const indices = await readdir(join(output, "search"));
      for (const language of source.language_options) {
        for (const name of ["minecraft", "terminal"]) {
          const prefix = name === "terminal" ? "terminal/" : "";
          for (const page of ["index.html", "code/index.html"]) {
            const html = await readFile(
              join(output, language.path, prefix, page),
              "utf8",
            );
            for (const [id, , url, title] of examples) {
              const article = html.match(
                new RegExp(
                  `<article\\b[^>]*\\bdata-editorial-id=["']?project-${id}["' >][\\s\\S]*?<\\/article>`,
                ),
              );
              assert(article, `${language.id}/${name}/${id}`);
              assert(article[0].includes(title));
              if (url) {
                assert(
                  article[0].includes(`href=${url}`) ||
                    article[0].includes(`href="${url}"`),
                );
                assert(article[0].includes("editorial-details"));
                assert(
                  article[0].includes(
                    editorial.ui[language.id].curriculum_details,
                  ),
                );
                assert(
                  article[0].includes(
                    `https://curriculum.guesant.net/en/#project-${id}`,
                  ),
                );
                assert(article[0].includes("link-third-party-badge"));
              } else {
                assert(!article[0].includes("editorial-details"));
              }
              assert(!article[0].includes("content_url"));
            }
            assert(html.includes("YouTube - JipaCoding"));
          }
          const indexFile = indices.find((file) =>
            file.startsWith(`${language.id}-${name}.`),
          );
          const entries = JSON.parse(
            await readFile(join(output, "search", indexFile), "utf8"),
          );
          for (const [id, , url, title] of examples) {
            const entry = entries.find(
              (item) => item.id === `code-resume-project-${id}`,
            );
            assert.equal(entry.title, title);
            assert.equal(
              entry.url,
              url || `https://curriculum.guesant.net/en/#project-${id}`,
            );
            assert.equal(
              entry.details_url,
              url ? `https://curriculum.guesant.net/en/#project-${id}` : "",
            );
          }
        }
      }
    },
    {},
    undefined,
    feed,
  );
});
test("experience titles retain the published engagement in previews, pages and search", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  const positions = {
    "pt-br": "Desenvolvedor Contratado (Terceirizado)",
    en: "Contracted (Outsourced) Developer",
  };
  const feed = {
    version: 1,
    items: [
      ...Object.entries(positions).map(([language, position]) => ({
        id: "experience-contract",
        source: "resume",
        language,
        type: "experience",
        title: "Employer Fixture",
        summary: "Published experience summary",
        url: `https://curriculum.guesant.net/${language}/#experience-contract`,
        tags: [],
        metadata: { position },
      })),
      {
        id: "experience-unspecified",
        source: "resume",
        language: "en",
        type: "experience",
        title: "Other Employer Fixture",
        summary: "Published experience without engagement metadata",
        url: "https://curriculum.guesant.net/en/#experience-unspecified",
        tags: [],
        metadata: {},
      },
    ],
  };
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      const indices = await readdir(join(output, "search"));
      for (const language of source.language_options) {
        const position = positions[language.id] || positions.en;
        const title = `Employer Fixture · ${position}`;
        for (const name of ["minecraft", "terminal"]) {
          const prefix = name === "terminal" ? "terminal/" : "";
          for (const page of ["index.html", "career/index.html"]) {
            const html = await readFile(
              join(output, language.path, prefix, page),
              "utf8",
            );
            const headings = [...html.matchAll(/<h3\b[^>]*>[\s\S]*?<\/h3>/g)];
            assert(headings.some(([heading]) => heading.includes(title)));
            if (language.id !== "pt-br")
              assert(
                headings.some(([heading]) =>
                  heading.includes(
                    `Other Employer Fixture · ${editorial.ui[language.id].affiliation_unspecified}`,
                  ),
                ),
              );
          }
          const indexFile = indices.find((file) =>
            file.startsWith(`${language.id}-${name}.`),
          );
          const items = JSON.parse(
            await readFile(join(output, "search", indexFile), "utf8"),
          );
          const experience = items.find(
            (item) => item.id === "career-resume-experience-contract",
          );
          assert.equal(experience.title, title);
          assert.equal(experience.metadata.position, position);
        }
      }
    },
    {},
    undefined,
    feed,
  );
});
test("all Home sections preserve the complete page lists in both interfaces", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  for (const section of ["interests", "uses", "library", "curiosities"]) {
    editorial.entries[section] = [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `${section}-${index}`,
        labels: { en: { title: `Published ${section} ${index}` } },
      })),
      ...[
        { private: true },
        { public: false },
        { enabled: false },
        { draft: true },
      ].map((flag, index) => ({
        id: `hidden-${section}-${index}`,
        ...flag,
        labels: { en: { title: "Excluded list fixture" } },
      })),
    ];
  }
  const feed = {
    version: 1,
    items: [
      "skill",
      "experience",
      "education",
      "project",
      "case",
      "post",
    ].flatMap((type) =>
      Array.from({ length: 6 }, (_, index) => ({
        id: `${type}-${index}`,
        source: type === "post" ? "blog" : "resume",
        language: "en",
        type,
        title: `Published ${type} ${index}`,
        summary: `Published summary ${index}`,
        url: `https://curriculum.guesant.net/en/#${type}-${index}`,
        tags: [],
        metadata:
          type === "experience" ? { position: "Contracted Developer" } : {},
      })),
    ),
  };
  const ids = (html, attribute) =>
    [...html.matchAll(new RegExp(`\\b${attribute}=["']?([^"' >]+)`, "g"))].map(
      (match) => match[1],
    );
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        for (const name of ["minecraft", "terminal"]) {
          const prefix = name === "terminal" ? "terminal/" : "";
          const home = await readFile(
            join(output, language.path, prefix, "index.html"),
            "utf8",
          );
          assert.doesNotMatch(
            home,
            /Excluded list fixture|class=["']?list-status/,
          );
          for (const section of source.navigation.sections) {
            const marker = new RegExp(
              `\\bdata-category=["']?${section}["' >]`,
            ).exec(home);
            assert(marker, `${name}/${language.id}/${section}`);
            const tail = home.slice(marker.index + marker[0].length);
            const end = tail.search(
              /\bdata-(?:category|home-update)=|<footer\b/,
            );
            const card = end < 0 ? tail : tail.slice(0, end);
            const page = await readFile(
              join(output, language.path, prefix, section, "index.html"),
              "utf8",
            );
            assert.deepEqual(
              ids(card, "data-link-id"),
              ids(page, "data-link-id"),
              `${name}/${language.id}/${section}/links`,
            );
            assert.deepEqual(
              ids(card, "data-editorial-id"),
              ids(page, "data-editorial-id"),
              `${name}/${language.id}/${section}/editorial`,
            );
            if (
              [
                "career",
                "code",
                "writing",
                "interests",
                "uses",
                "library",
                "curiosities",
              ].includes(section)
            )
              assert(ids(card, "data-editorial-id").length >= 6);
          }
        }
      }
    },
    {},
    editorial,
    feed,
  );
});
test("explicit list limits show localized counts and full destinations without private items", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  editorial.entries.interests = [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `interest-${index}`,
      labels: { en: { title: `Published interest ${index}` } },
    })),
    ...[
      { private: true },
      { public: false },
      { enabled: false },
      { draft: true },
    ].map((flag, index) => ({
      id: `hidden-interest-${index}`,
      ...flag,
      labels: { en: { title: "Excluded list fixture" } },
    })),
  ];
  const gallery = `{{ $locale := lower site.Language.Lang }}
{{ range slice "career" "interests" "reading" }}
  {{ $page := index (where (partial "site-pages.html" (dict "locale" $locale)) "id" .) 0 }}
  {{ $links := partial "section-links.html" (dict "section" $page.section "language" $locale) }}
  {{ partial "section-card.html" (dict "page" $page "links" $links "index" 0 "linkLimit" 2 "editorialLimit" 2) }}
{{ end }}`;
  const terminal = `{{ define "main" }}
{{ $locale := lower site.Language.Lang }}
{{ range slice "career" "interests" "reading" }}
  {{ $page := index (where (partial "site-pages.html" (dict "locale" $locale "interface" "terminal")) "id" .) 0 }}
  {{ $links := partial "section-links.html" (dict "section" $page.section "language" $locale) }}
  {{ partial "terminal-link-list.html" (dict "items" $links "language" $locale "url" (strings.TrimPrefix "/" $page.url | relURL) "limit" 2) }}
  {{ partial "editorial-list.html" (dict "section" $page.id "language" $locale "interface" "terminal" "preview" true "limit" 2) }}
{{ end }}{{ end }}`;
  await fixture(
    (config) => {
      const career = config.sections.find((section) => section.id === "career");
      for (const [index, flags] of [
        { public: false },
        { enabled: false },
      ].entries())
        career.links.push({
          ...structuredClone(career.links[0]),
          id: `hidden-link-${index}`,
          ...flags,
        });
    },
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        for (const name of ["minecraft", "terminal"]) {
          const prefix = name === "terminal" ? "terminal/" : "";
          const html = await readFile(
            join(output, language.path, prefix, "index.html"),
            "utf8",
          );
          const statuses = [
            ...html.matchAll(
              /<p\b[^>]*\bclass=["']?list-status\b[^>]*>[\s\S]*?<\/p>/g,
            ),
          ].map(([value]) => value);
          assert.equal(statuses.length, 2);
          for (const [index, total, section] of [
            [0, 4, "career"],
            [1, 6, "interests"],
          ]) {
            const text = editorial.ui[language.id].list_partial
              .replace("{shown}", "2")
              .replace("{total}", String(total));
            assert(statuses[index].includes(text));
            assert(
              statuses[index].includes(`${language.path}${prefix}${section}/`),
            );
            assert(
              statuses[index].includes(editorial.ui[language.id].list_view_all),
            );
            assert.match(statuses[index], /data-list-shown=["']?2/);
            assert.match(
              statuses[index],
              new RegExp(`data-list-total=["']?${total}`),
            );
          }
          assert.doesNotMatch(html, /hidden-link-|Excluded list fixture/);
          assert.match(html, /Published interest 1/);
          assert.doesNotMatch(html, /Published interest 2/);
        }
      }
    },
    {},
    editorial,
    undefined,
    {
      "partials/category-gallery.html": gallery,
      "terminal-home.html": terminal,
    },
  );
});
test("editorial visibility, untranslated records and search share public data", async () => {
  const editorial = parse(await readFile("src/data/editorial.yaml", "utf8"));
  editorial.entries.uses = [
    {
      id: "confirmed-tool",
      labels: {
        "pt-br": {
          title: "Confirmed Tool",
          description: "Confirmed description",
        },
      },
      tags: ["confirmed-tag"],
    },
    ...[
      { private: true },
      { public: false },
      { enabled: false },
      { draft: true },
    ].map((flag, index) => ({
      id: `hidden-${index}`,
      ...flag,
      labels: { en: { title: "HiddenEditorialSecret" } },
    })),
  ];
  editorial.now["pt-br"] = {
    ...editorial.now["pt-br"],
    working: "Confirmed activity",
    updated: "2026-10-27",
  };
  await fixture(
    () => {},
    async (result, output) => {
      assert.equal(result.status, 0, result.stderr);
      for (const language of source.language_options) {
        const html = await readFile(
          join(output, language.path, "uses/index.html"),
          "utf8",
        );
        assert(html.includes("Confirmed Tool"));
        assert(!html.includes("HiddenEditorialSecret"));
        assert(html.includes("page-uses-confirmed-tool"));
      }
      const json = await collectHTML(join(output, "search"), ".json");
      assert(json.includes("confirmed-tag"));
      assert(json.includes("Confirmed activity"));
      assert(!json.includes("HiddenEditorialSecret"));
      const now = await readFile(
        join(output, "pt-br/agora/index.html"),
        "utf8",
      );
      assert(now.includes("Confirmed activity"));
      assert(now.includes("2026-10-27"));
      assert(now.includes("now-current-focus"));
    },
    {},
    editorial,
  );
});
test("CSS dimension tokens use relative units without fixed pixels", async () => {
  const css = await readFile("src/assets/css/main.css", "utf8");
  assert.doesNotMatch(css, /\b\d*\.?\d+px\b/);
  for (const token of [
    "shell-max",
    "page-gutter",
    "panel-padding",
    "section-gap",
    "divider-width",
    "world-scene-blur",
  ])
    assert(css.includes(`--${token}:`));
  assert(css.includes("@container sections"));
});
test("all public entries belong to an available section or navigation page", () => {
  const ids = new Set();
  for (const section of source.sections) {
    if (section.enabled === false || section.public === false) continue;
    for (const entry of section.links) {
      if (entry.enabled === false || entry.public === false) continue;
      assert(!ids.has(entry.id));
      ids.add(entry.id);
      assert(
        source.navigation.sections.includes(section.id) ||
          source.navigation.links.includes(entry.id),
      );
    }
  }
});
