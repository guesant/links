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
async function fixture(mutate, inspect) {
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
    const configPath = join(directory, "hugo.toml");
    await writeFile(
      configPath,
      (await readFile(".config/hugo.toml", "utf8")) +
        `\n[[module.mounts]]\nsource = ${JSON.stringify(data)}\ntarget = "data"\n`,
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
      { encoding: "utf8" },
    );
    await inspect(result, output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
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
test("thematic pages preserve link order and use one canonical LinkedIn entry", () => {
  assert.deepEqual(source.navigation.sections, Object.keys(expectedSections));
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
      Object.keys(expectedSections),
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
      for (const path of ["now/index.html", "agora/index.html"])
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
          /<nav\b[^>]*\bclass=["']?quick-contacts\b[^>]*>[\s\S]*?<\/nav>/,
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
          10,
        );
        assert.match(html, /\bdata-platform=["']?link\b/);
        assert(!html.includes("<nil>"));
        assert.doesNotMatch(html, /\bclass=["']?presentation-art\b/);
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
          html.indexOf("context-navigation") > html.indexOf("home-updates"),
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
