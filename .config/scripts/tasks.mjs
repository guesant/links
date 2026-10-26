import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import configuration from "./configuration.cjs";
import accessibilityViewports from "./accessibility-viewports.mjs";

const { parse } = createRequire(import.meta.url)("yaml");
const config = parse(await readFile("src/data/links.yaml", "utf8"));
const command = (name, args = [], env = {}, cwd = process.cwd()) =>
  new Promise((accept, reject) => {
    const process = spawn(name, args, {
      cwd,
      stdio: "inherit",
      env: { ...globalThis.process.env, ...env },
    });
    process.on("error", reject);
    process.on("exit", (code, signal) =>
      code === 0
        ? accept()
        : reject(new Error(`${name} failed: ${code ?? signal}`)),
    );
  });
const routes = config.language_options.flatMap((language) =>
  configuration
    .pagesFor(config, language.id)
    .filter((page) => !page.fallback)
    .map((page) => page.url),
);
const build = (destination = ".local/build/site", baseURL) =>
  command(
    "hugo",
    [
      "--source",
      "src",
      "--config",
      resolve(".config/hugo.toml"),
      "--minify",
      "--cleanDestinationDir",
      "--noBuildLock",
      "--printPathWarnings",
      "--destination",
      resolve(destination),
      ...(baseURL ? ["--baseURL", baseURL] : []),
    ],
    {
      HUGO_GITHUB_REPOSITORY:
        process.env.GITHUB_REPOSITORY || config.site.repository,
      HUGO_GITHUB_SERVER_URL:
        process.env.GITHUB_SERVER_URL || "https://github.com",
      HUGO_GITHUB_SHA: process.env.GITHUB_SHA || "",
      HUGO_GITHUB_RUN_ID: process.env.GITHUB_RUN_ID || "",
      HUGO_BUILD_DATE: new Date().toISOString(),
      HUGO_BUILD_DATE_LABEL:
        new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
    },
  );
async function withServer(task) {
  const server = spawn(
    "serve",
    ["--no-clipboard", "--listen", "tcp://127.0.0.1:4173", ".local/build/qa"],
    { stdio: "ignore" },
  );
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await fetch("http://127.0.0.1:4173/");
        if (response.ok) break;
      } catch {}
      if (attempt >= 50) throw new Error("Preview server did not start");
      await setTimeout(100);
    }
    await task();
  } finally {
    server.kill("SIGTERM");
  }
}
async function tests() {
  await command("node", [
    "--test",
    ".config/scripts/check-stats.mjs",
    ".config/scripts/check-content.mjs",
    ".config/scripts/check-link-retries.mjs",
    ".config/scripts/check-raster.mjs",
  ]);
}
async function check() {
  await command("prettier", [
    "--check",
    ".config/**/*.mjs",
    ".config/**/*.cjs",
    ".config/**/*.json",
    ".config/**/*.yaml",
    ".devcontainer/*.json",
    ".github/workflows/*.yml",
    "src/assets/css/*.css",
    "src/assets/js/*.js",
    "src/assets/**/*.json",
    "src/data/*.yaml",
    "README.md",
  ]);
  await command("just", ["--fmt", "--check"]);
  await command("actionlint");
  await command("zizmor", ["--offline", ".github/workflows"]);
  await tests();
  await mkdir(".local/reports", { recursive: true });
  await build(".local/build/qa", "http://127.0.0.1:4173/");
  const pa11y = JSON.parse(await readFile(".config/pa11yci.json", "utf8"));
  pa11y.urls = routes.flatMap((path) =>
    ["dark", "light"].map((theme) => ({
      url: `http://127.0.0.1:4173${path}`,
      actions: [
        "click element [data-settings-open]",
        `click element label[for="theme-${theme}"]`,
        "click element #settings-dialog [data-dialog-close]",
      ],
    })),
  );
  pa11y.urls.push(
    ...config.language_options.flatMap((language) =>
      ["dark", "light"].flatMap((theme) =>
        ["settings", "credits"].map((dialog) => ({
          url: `http://127.0.0.1:4173${language.path}`,
          actions: [
            "click element [data-settings-open]",
            `click element label[for="theme-${theme}"]`,
            ...(dialog === "credits"
              ? [
                  "click element #settings-dialog [data-dialog-close]",
                  "click element [data-credits-open]",
                ]
              : []),
          ],
        })),
      ),
    ),
  );
  await withServer(async () => {
    await accessibilityViewports(
      pa11y.urls.slice(0, routes.length * 2),
      pa11y.defaults,
    );
    await writeFile(".local/reports/pa11y.json", JSON.stringify(pa11y));
    await command("pa11y-ci", ["--config=.local/reports/pa11y.json"]);
    await command("node", [".config/scripts/check-layout.cjs"], {
      QA_BASE_URL: "http://127.0.0.1:4173",
      QA_REPORT_DIR: resolve(".local/reports"),
    });
  });
  await build(".local/build/lighthouse", "http://localhost/");
  const lighthouse = JSON.parse(
    await readFile(".config/lighthouserc.json", "utf8"),
  );
  lighthouse.ci.collect.url = routes.map((path) => `http://localhost${path}`);
  lighthouse.ci.collect.staticDistDir = resolve(".local/build/lighthouse");
  lighthouse.ci.upload.outputDir = "reports";
  await writeFile(".local/reports/lighthouse.json", JSON.stringify(lighthouse));
  await mkdir(".cache/lighthouseci", { recursive: true });
  await command(
    "lhci",
    ["autorun", `--config=${resolve(".local/reports/lighthouse.json")}`],
    {},
    resolve(".cache/lighthouseci"),
  );
  await build();
  await command("node", [".config/scripts/verify-links.mjs"]);
}
const task = process.argv[2];
try {
  switch (task) {
    case "dev":
      await command("hugo", [
        "server",
        "--source",
        "src",
        "--config",
        resolve(".config/hugo.toml"),
        "--bind",
        "0.0.0.0",
        "--port",
        "4173",
        "--noBuildLock",
        "--baseURL",
        "http://localhost:4173/",
        "--destination",
        resolve(".local/build/dev"),
      ]);
      break;
    case "build":
      await build();
      break;
    case "preview":
      await command("serve", [
        "--no-clipboard",
        "--listen",
        "tcp://0.0.0.0:4173",
        ".local/build/site",
      ]);
      break;
    case "test":
      await tests();
      break;
    case "check":
      await check();
      break;
    case "format":
    case "format-fix":
      await command("prettier", [
        task === "format" ? "--check" : "--write",
        ".config/**/*.mjs",
        ".config/**/*.cjs",
        ".config/**/*.json",
        ".config/**/*.yaml",
        ".devcontainer/*.json",
        ".github/workflows/*.yml",
        "src/assets/css/*.css",
        "src/assets/js/*.js",
        "src/assets/**/*.json",
        "src/data/*.yaml",
        "README.md",
      ]);
      await command("just", [
        "--fmt",
        ...(task === "format" ? ["--check"] : []),
      ]);
      break;
    default:
      throw new Error("Unknown task");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
