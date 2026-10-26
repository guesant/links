import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const puppeteer = createRequire(
  "/usr/local/lib/node_modules/pa11y-ci/package.json",
)("puppeteer");
const spritePath = resolve("src/assets/cursors/cursor-sprite.svg");
const outputDirectory = resolve("src/static/cursors");
const sprite = await readFile(spritePath, "utf8");
const definitions = [...sprite.matchAll(/<symbol\b[\s\S]*?<\/symbol>/g)]
  .map(([definition]) => definition)
  .join("");
const symbols = new Map(
  [...sprite.matchAll(/<symbol id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)].map(
    ([, id, contents]) => [id, contents],
  ),
);
const rotations = [
  ["n-resize", "resize-ns", 0],
  ["e-resize", "resize-ns", 90],
  ["s-resize", "resize-ns", 180],
  ["w-resize", "resize-ns", 270],
  ["ns-resize", "resize-ns", 0],
  ["ew-resize", "resize-ns", 90],
  ["col-resize", "resize-ns", 0],
  ["row-resize", "resize-ns", 90],
  ["ne-resize", "resize-diagonal", 0],
  ["sw-resize", "resize-diagonal", 180],
  ["nw-resize", "resize-diagonal", 90],
  ["se-resize", "resize-diagonal", 270],
  ["nesw-resize", "resize-diagonal", 0],
  ["nwse-resize", "resize-diagonal", 90],
];
const aliases = new Map([
  ["vertical-text", ["text", 90]],
  ["all-scroll", ["move", 0]],
]);
const cursors = new Map(
  [...symbols].map(([name, contents]) => [name, { contents, rotation: 0 }]),
);

for (const [name, source, rotation] of rotations) {
  cursors.set(name, { contents: symbols.get(source), rotation });
}

for (const [name, [source, rotation]] of aliases) {
  cursors.set(name, { contents: symbols.get(source), rotation });
}

const hotspots = new Map([
  ["default", [1, 1]],
  ["pointer", [13, 5]],
  ["help", [1, 1]],
  ["no-drop", [1, 1]],
  ["progress", [1, 1]],
]);
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 32, height: 32, deviceScaleFactor: 1 });

await mkdir(outputDirectory, { recursive: true });

try {
  for (const [name, cursor] of cursors) {
    const [hotspotX, hotspotY] = hotspots.get(name) || [16, 16];
    const transform = cursor.rotation
      ? `<g transform="rotate(${cursor.rotation} 16 16)">${cursor.contents}</g>`
      : cursor.contents;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" data-hotspot="${hotspotX} ${hotspotY}" shape-rendering="crispEdges"><defs>${definitions}</defs>${transform}</svg>`;
    await writeFile(resolve(outputDirectory, `${name}.svg`), svg);
    await page.setContent(`<!doctype html><style>body{margin:0}</style>${svg}`);
    await page.screenshot({
      path: resolve(outputDirectory, `${name}.png`),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}

console.log(`Generated ${cursors.size} cursor pairs in ${outputDirectory}`);
