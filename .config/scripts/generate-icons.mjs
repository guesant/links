import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { withRasterPage, loadPNG } from './raster-assets.mjs';

const catalog = JSON.parse(await readFile('.config/icon-catalog.json', 'utf8'));

const names = Object.keys(catalog);

const { parse } = createRequire(import.meta.url)('yaml');

const { tile_size: tileSize, compact_tile_size: compactTileSize } = parse(
  await readFile('.config/icon-assets.yaml', 'utf8'),
);

const tiles = await Promise.all(
  names.flatMap((name, column) =>
    ['', '-mask'].map(async (suffix, row) => ({
      png: await loadPNG(
        `src/assets/icons/source/${name}${suffix}.png`,
        tileSize,
        tileSize,
      ),
      column,
      row,
    })),
  ),
);

const favicon = await loadPNG('src/assets/icons/favicon.png', 64, 64);

await withRasterPage(async (page) => {
  const atlas = await page.evaluate(
    async ({ tiles, columns, tileSize, compactTileSize }) => {
      const canvas = document.createElement('canvas');

      canvas.width = columns * tileSize;
      canvas.height = tileSize * 2;

      const context = canvas.getContext('2d');

      context.imageSmoothingEnabled = false;

      const compact = document.createElement('canvas');

      compact.width = columns * compactTileSize;
      compact.height = compactTileSize * 2;

      const compactContext = compact.getContext('2d');

      compactContext.imageSmoothingEnabled = true;
      compactContext.imageSmoothingQuality = 'high';

      for (const tile of tiles) {
        const image = new Image();

        image.src = `data:image/png;base64,${tile.png}`;
        await image.decode();
        context.drawImage(image, tile.column * tileSize, tile.row * tileSize);
        compactContext.drawImage(
          image,
          tile.column * compactTileSize,
          tile.row * compactTileSize,
          compactTileSize,
          compactTileSize,
        );
      }

      return {
        pixel: canvas.toDataURL('image/png').split(',')[1],
        'pixel-compact': compact.toDataURL('image/png').split(',')[1],
      };
    },
    { tiles, columns: names.length, tileSize, compactTileSize },
  );

  await mkdir('.cache/icons', { recursive: true });

  const staging = await mkdtemp('.cache/icons/atlas-');

  try {
    for (const [name, png] of Object.entries(atlas)) {
      const path = `${staging}/${name}.png`;

      await writeFile(path, Buffer.from(png, 'base64'));
      execFileSync('optipng', ['-quiet', '-o3', '-strip', 'all', path]);
      await rename(path, `src/assets/icons/${name}.png`);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  for (const [name, size] of [
    ['favicon', 64],
    ['icon-192', 192],
    ['icon-512', 512],
  ]) {
    const png = await page.evaluate(
      async ({ favicon, size }) => {
        const image = new Image();

        image.src = `data:image/png;base64,${favicon}`;
        await image.decode();

        const canvas = document.createElement('canvas');

        canvas.width = canvas.height = size;

        const context = canvas.getContext('2d');

        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, size, size);

        return canvas.toDataURL('image/png').split(',')[1];
      },
      { favicon, size },
    );

    await writeFile(`src/static/${name}.png`, Buffer.from(png, 'base64'));
  }
});

const manifest = {
  count: names.length,
  tileSize,
  compactTileSize,
  icons: Object.fromEntries(
    names.map((name, column) => [
      name,
      { colored: catalog[name], position: (column / (names.length - 1)) * 100 },
    ]),
  ),
};

await writeFile(
  'src/assets/icons/manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`Generated PNG atlas with ${names.length} icons and PNG favicons`);
