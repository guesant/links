import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { loadPNG, withRasterPage } from "./raster-assets.mjs";

const { parse } = createRequire(import.meta.url)("yaml");

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesIn(path) : path;
      }),
    )
  ).flat();
}

test("site sources contain no vector assets or vector image references", async () => {
  for (const path of await filesIn("src")) {
    assert(!path.toLowerCase().endsWith(".svg"), path);
    if (/\.(html|css|js|json)$/.test(path)) {
      assert.doesNotMatch(
        await readFile(path, "utf8"),
        /<svg\b|\.svg\b|image\/svg/i,
        path,
      );
    }
  }
});

test("PNG icon sources and atlas match their catalog", async () => {
  const catalog = JSON.parse(
    await readFile(".config/icon-catalog.json", "utf8"),
  );
  const manifest = JSON.parse(
    await readFile("src/assets/icons/manifest.json", "utf8"),
  );
  const names = Object.keys(catalog);
  const geometry = parse(await readFile(".config/icon-assets.yaml", "utf8"));
  assert.equal(manifest.tileSize, geometry.tile_size);
  assert.equal(manifest.compactTileSize, geometry.compact_tile_size);
  assert.deepEqual(Object.keys(geometry.icons), names);
  assert(
    geometry.display_sizes.every((size) => manifest.tileSize % size === 0),
  );
  assert.equal(manifest.count, names.length);
  assert.deepEqual(Object.keys(manifest.icons), names);
  assert.equal(
    (await readdir("src/assets/icons/source")).length,
    names.length * 2,
  );
  for (const [column, name] of names.entries()) {
    assert.equal(manifest.icons[name].colored, catalog[name]);
    assert.equal(
      manifest.icons[name].position,
      (column / (names.length - 1)) * 100,
    );
    await loadPNG(
      `src/assets/icons/source/${name}.png`,
      manifest.tileSize,
      manifest.tileSize,
    );
    await loadPNG(
      `src/assets/icons/source/${name}-mask.png`,
      manifest.tileSize,
      manifest.tileSize,
    );
  }
  await loadPNG(
    "src/assets/icons/pixel.png",
    names.length * manifest.tileSize,
    manifest.tileSize * 2,
  );
  await loadPNG(
    "src/assets/icons/pixel-compact.png",
    names.length * manifest.compactTileSize,
    manifest.compactTileSize * 2,
  );
});

test("PNG atlas renders each icon without shifting or leaking adjacent tiles", async () => {
  const manifest = JSON.parse(
    await readFile("src/assets/icons/manifest.json", "utf8"),
  );
  const geometry = parse(await readFile(".config/icon-assets.yaml", "utf8"));
  const atlases = await Promise.all(
    [
      ["pixel", manifest.tileSize],
      ["pixel-compact", manifest.compactTileSize],
    ].map(async ([name, tileSize]) => ({
      name,
      tileSize,
      atlas: await loadPNG(
        `src/assets/icons/${name}.png`,
        manifest.count * tileSize,
        tileSize * 2,
      ),
    })),
  );
  const sources = await Promise.all(
    Object.keys(manifest.icons).map(async (name) => ({
      name,
      png: await loadPNG(
        `src/assets/icons/source/${name}.png`,
        manifest.tileSize,
        manifest.tileSize,
      ),
      mask: await loadPNG(
        `src/assets/icons/source/${name}-mask.png`,
        manifest.tileSize,
        manifest.tileSize,
      ),
    })),
  );
  await withRasterPage(async (page) => {
    for (const { name, tileSize, atlas } of atlases) {
      for (const ratio of [1, 2]) {
        for (const size of geometry.display_sizes) {
          const width = manifest.count * size;
          await page.setViewport({
            width,
            height: size * 4,
            deviceScaleFactor: ratio,
          });
          await page.evaluate(
            async ({ sources, atlas, size, tileSize }) => {
              document.body.replaceChildren();
              document.body.style.margin = "0";
              for (const source of sources) {
                for (const key of ["png", "mask"]) {
                  const image = new Image();
                  image.src = `data:image/png;base64,${source[key]}`;
                  await image.decode();
                  if (image.width === tileSize) continue;
                  const canvas = document.createElement("canvas");
                  canvas.width = canvas.height = tileSize;
                  const context = canvas.getContext("2d");
                  context.imageSmoothingEnabled = true;
                  context.imageSmoothingQuality = "high";
                  context.drawImage(image, 0, 0, tileSize, tileSize);
                  source[key] = canvas.toDataURL("image/png").split(",")[1];
                }
              }
              const imageURL = (png) => `url("data:image/png;base64,${png}")`;
              for (const [column, source] of sources.entries()) {
                for (let row = 0; row < 4; row += 1) {
                  const element = document.createElement("span");
                  const isAtlas = row % 2 === 0;
                  const isMask = row >= 2;
                  Object.assign(element.style, {
                    position: "absolute",
                    left: `${column * size}px`,
                    top: `${row * size}px`,
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundImage: imageURL(
                      isAtlas ? atlas : isMask ? source.mask : source.png,
                    ),
                    backgroundRepeat: "no-repeat",
                    backgroundSize: isAtlas
                      ? `${sources.length * 100}% 200%`
                      : "100% 100%",
                    backgroundPosition: isAtlas
                      ? `${(column / (sources.length - 1)) * 100}% ${isMask ? 100 : 0}%`
                      : "0 0",
                    imageRendering: "auto",
                  });
                  document.body.append(element);
                }
              }
              await Promise.all(
                [atlas, ...sources.flatMap(({ png, mask }) => [png, mask])].map(
                  async (png) => {
                    const image = new Image();
                    image.src = `data:image/png;base64,${png}`;
                    await image.decode();
                  },
                ),
              );
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
            },
            { sources, atlas, size, tileSize },
          );
          const screenshot = await page.screenshot({ omitBackground: true });
          const difference = await page.evaluate(
            async ({ png, size, ratio }) => {
              const image = new Image();
              image.src = `data:image/png;base64,${png}`;
              await image.decode();
              const canvas = document.createElement("canvas");
              canvas.width = image.width;
              canvas.height = image.height;
              const context = canvas.getContext("2d");
              context.drawImage(image, 0, 0);
              const pixels = context.getImageData(
                0,
                0,
                image.width,
                image.height,
              ).data;
              const height = size * ratio;
              let changed = 0;
              for (const row of [0, 2]) {
                for (let y = 0; y < height; y += 1)
                  for (let x = 0; x < image.width; x += 1) {
                    const first = ((row * height + y) * image.width + x) * 4;
                    const second = first + height * image.width * 4;
                    if (
                      [0, 1, 2, 3].some(
                        (channel) =>
                          Math.abs(
                            pixels[first + channel] - pixels[second + channel],
                          ) > 2,
                      )
                    )
                      changed += 1;
                  }
              }
              return changed;
            },
            { png: Buffer.from(screenshot).toString("base64"), size, ratio },
          );
          assert.equal(
            difference,
            0,
            `${name} raster mismatch at ${size}px and DPR ${ratio}`,
          );
        }
      }
    }
  });
});

test("six PNG cursors preserve transparency and use one global cursor", async () => {
  const config = parse(await readFile(".config/cursor-assets.yaml", "utf8"));
  const names = ["click", "default", "grab", "pointer", "text", "wait"];
  assert.deepEqual(config.assets.map(({ id }) => id).sort(), names);
  for (const directory of ["src/assets/cursors", "src/static/cursors"]) {
    assert.deepEqual(
      (await readdir(directory)).sort(),
      names.map((id) => `${id}.png`),
    );
  }
  await withRasterPage(async (page) => {
    for (const asset of config.assets) {
      const source = await readFile(asset.source);
      const width = source.readUInt32BE(16);
      const height = source.readUInt32BE(20);
      assert(width >= 512 && height >= 512, asset.source);
      await loadPNG(asset.source, width, height);
      const png = await loadPNG(
        asset.file,
        config.browser_size,
        config.browser_size,
      );
      const pixels = await page.evaluate(
        async ({ png, hotspot, padding }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const data = context.getImageData(
            0,
            0,
            image.width,
            image.height,
          ).data;
          let visible = 0;
          let outside = 0;
          for (let y = 0; y < image.height; y += 1) {
            for (let x = 0; x < image.width; x += 1) {
              if (data[(y * image.width + x) * 4 + 3] <= 16) continue;
              visible += 1;
              if (
                x < padding ||
                y < padding ||
                x >= image.width - padding ||
                y >= image.height - padding
              )
                outside += 1;
            }
          }
          return {
            visible,
            outside,
            hotspot: data[(hotspot[1] * image.width + hotspot[0]) * 4 + 3],
          };
        },
        { png, hotspot: asset.hotspot, padding: config.padding },
      );
      assert(
        pixels.visible > config.browser_size ** 2 * 0.08 &&
          pixels.visible < config.browser_size ** 2 * 0.8,
        asset.id,
      );
      assert.equal(pixels.outside, 0, asset.id);
      assert.equal(pixels.hotspot > 200, asset.id !== "wait", asset.id);
    }
  });
  const css = await readFile("src/assets/css/main.css", "utf8");
  const declarations = css.match(/\bcursor\s*:[^;]+;/g);
  assert.equal(declarations.length, 1);
  const active = config.assets.find(({ id }) => id === "default");
  assert(
    declarations[0].includes(
      `url("/cursors/default.png") ${active.hotspot.join(" ")}`,
    ),
  );
  await assert.rejects(readFile(".config/scripts/generate-cursors.mjs"), {
    code: "ENOENT",
  });
  assert.doesNotMatch(await readFile("justfile", "utf8"), /^cursors:/m);
});

test("favicon and installable icons use PNG at their declared sizes", async () => {
  for (const [name, size] of [
    ["favicon", 64],
    ["icon-192", 192],
    ["icon-512", 512],
  ]) {
    await loadPNG(`src/static/${name}.png`, size, size);
  }
  await loadPNG("src/assets/images/ui/clouds.png", 1000, 320);
});

test("rail slices join matching stems and preserve a complete terminal", async () => {
  const geometry = JSON.parse(
    await readFile("src/assets/images/ui/suspension-rail.json", "utf8"),
  );
  const source = await readFile("src/assets/images/ui/suspension-rail.png");
  const width = source.readUInt32BE(16);
  const height = source.readUInt32BE(20);
  assert(geometry.width <= width);
  for (const slice of Object.values(geometry.slices)) {
    assert(Number.isInteger(slice.top) && slice.top >= 0);
    assert(Number.isInteger(slice.height) && slice.height > 0);
    assert(slice.top + slice.height <= height);
  }
  assert.equal(
    geometry.slices.terminal.top + geometry.slices.terminal.height,
    height,
  );
  await withRasterPage(async (page) => {
    const edges = await page.evaluate(
      async ({ png, geometry }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          image.width,
          image.height,
        ).data;
        const start = Math.floor((image.width - geometry.width) / 2);
        const stem = (y) => {
          const columns = [];
          for (let x = start; x < start + geometry.width; x += 1) {
            if (pixels[(y * image.width + x) * 4 + 3] > 200) columns.push(x);
          }
          return columns;
        };
        const { chain, terminal, coupling } = geometry.slices;
        return {
          first: stem(chain.top),
          last: stem(chain.top + chain.height - 1),
          terminal: stem(terminal.top),
          base: stem(terminal.top + terminal.height - 1),
          coupling: stem(coupling.top + coupling.height - 1),
        };
      },
      { png: source.toString("base64"), geometry },
    );
    assert(edges.first.length > 0);
    assert.deepEqual(edges.first, edges.last);
    assert.deepEqual(edges.first, edges.terminal);
    assert.deepEqual(edges.first, edges.coupling);
    assert.deepEqual(edges.base, []);
  });
});
