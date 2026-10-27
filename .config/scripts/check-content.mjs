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
import { join, resolve } from "node:path";
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
        federationMount,
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
        }
      }
      for (const path of ["en/now/index.html", "pt-br/agora/index.html"])
        assert(
          (await readFile(join(output, path), "utf8")).includes(
            "now-current-focus",
          ),
        );
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
test("Now preview links resolve an installation prefix only once", async () => {
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
          prefix,
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
