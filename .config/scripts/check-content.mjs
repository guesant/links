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

const { parse, stringify } = createRequire(import.meta.url)("yaml");
const source = parse(await readFile("src/data/links.yaml", "utf8"));
const collectHTML = async (directory) => {
  let html = "";
  for (const file of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, file.name);
    if (file.isDirectory()) html += await collectHTML(path);
    else if (file.name.endsWith(".html")) html += await readFile(path, "utf8");
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
      assert(html.includes("/prefix/pt-br/networks/"));
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
