import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  getSiteData,
  editorialItems,
  pagesFor,
  routeEntries,
  sectionLinks,
} from '../../src/lib/site-data.js';

const output = resolve('.local/svelte-static');

const assets = resolve('src/assets');

const generated = resolve(output, 'assets/generated');

await rm(output, { recursive: true, force: true });
await mkdir(generated, { recursive: true });
await cp(resolve('src/static'), output, { recursive: true });
await cp(assets, resolve(output, 'assets'), { recursive: true });

const images = resolve(assets, 'images');

const ui = resolve(images, 'ui');

const scenery = resolve(images, 'scenery');

const rail = sharp(resolve(ui, 'suspension-rail.png'));

const railMetadata = await rail.metadata();

const geometry = JSON.parse(
  await readFile(resolve(ui, 'suspension-rail.json'), 'utf8'),
);

const railLeft = Math.floor((railMetadata.width - geometry.width) / 2);

const slices = {};

for (const [name, slice] of Object.entries(geometry.slices)) {
  const path = resolve(generated, `rail-${name}.png`);

  await sharp(resolve(ui, 'suspension-rail.png'))
    .extract({
      left: railLeft,
      top: slice.top,
      width: geometry.width,
      height: slice.height,
    })
    .png()
    .toFile(path);
  slices[name] = `/assets/generated/rail-${name}.png`;
}

const imagesToGenerate = [
  [
    'stone-frame.webp',
    resolve(ui, 'stone-frame.png'),
    {
      extract: { left: 57, top: 57, width: 1140, height: 1140 },
      resize: { width: 384 },
    },
  ],
  [
    'oak-frame.webp',
    resolve(ui, 'oak-frame.png'),
    {
      extract: { left: 57, top: 57, width: 1140, height: 1140 },
      resize: { width: 512 },
    },
  ],
  [
    'oak-drape-start.webp',
    resolve(ui, 'oak-frame.png'),
    {
      extract: { left: 0, top: 0, width: 384, height: 448 },
      resize: { width: 160 },
    },
  ],
  [
    'oak-drape-end.webp',
    resolve(ui, 'oak-frame.png'),
    {
      extract: { left: 870, top: 57, width: 384, height: 448 },
      resize: { width: 160 },
    },
  ],
  [
    'stone-foot-start.webp',
    resolve(ui, 'stone-frame.png'),
    {
      extract: { left: 0, top: 998, width: 384, height: 256 },
      resize: { width: 160 },
    },
  ],
  [
    'stone-foot-end.webp',
    resolve(ui, 'stone-frame.png'),
    {
      extract: { left: 870, top: 998, width: 384, height: 256 },
      resize: { width: 160 },
    },
  ],
  [
    'profile-lantern.webp',
    resolve(generated, 'rail-profile-lantern.png'),
    { resize: { width: 96 } },
  ],
  [
    'aged-oak.webp',
    resolve(ui, 'charcoal-planks.png'),
    { resize: { width: 160 } },
  ],
];

for (const [name, path, options] of imagesToGenerate) {
  let image = sharp(path);

  if (options.extract) image = image.extract(options.extract);

  await image
    .resize(options.resize)
    .webp({ quality: 82 })
    .toFile(resolve(generated, name));
}

for (const [name, path, resize] of [
  ['night-desktop.webp', resolve(scenery, 'night-canyon.png'), { width: 1536 }],
  [
    'night-mobile.webp',
    resolve(scenery, 'night-canyon.png'),
    { width: 384, height: 576, fit: 'cover' },
  ],
  ['day-desktop.webp', resolve(scenery, 'day.png'), { width: 1536 }],
  [
    'day-mobile.webp',
    resolve(scenery, 'day.png'),
    { width: 384, height: 576, fit: 'cover' },
  ],
]) {
  await sharp(path)
    .resize(resize)
    .webp({ quality: 78 })
    .toFile(resolve(generated, name));
}

const substitutions = {
  fontLatin: '/assets/fonts/press-start-2p-latin.woff2',
  fontLatinExt: '/assets/fonts/press-start-2p-latin-ext.woff2',
  bodyFontLatin: '/assets/fonts/oxanium-latin.woff2',
  bodyFontLatinExt: '/assets/fonts/oxanium-latin-ext.woff2',
  terminalFontLatin: '/assets/fonts/jetbrains-mono-latin.woff2',
  terminalFontLatinExt: '/assets/fonts/jetbrains-mono-latin-ext.woff2',
  clouds: '/assets/images/ui/clouds.png',
  stoneFrame: '/assets/generated/stone-frame.webp',
  oakFrame: '/assets/generated/oak-frame.webp',
  oakDrapeStart: '/assets/generated/oak-drape-start.webp',
  oakDrapeEnd: '/assets/generated/oak-drape-end.webp',
  stoneFootStart: '/assets/generated/stone-foot-start.webp',
  stoneFootEnd: '/assets/generated/stone-foot-end.webp',
  profileLantern: '/assets/generated/profile-lantern.webp',
  railChain: slices.chain,
  agedOakSurface: '/assets/generated/aged-oak.webp',
  nightDesktop: '/assets/generated/night-desktop.webp',
  nightMobile: '/assets/generated/night-mobile.webp',
  dayDesktop: '/assets/generated/day-desktop.webp',
  dayMobile: '/assets/generated/day-mobile.webp',
};

for (const file of ['main.css', 'terminal.css']) {
  let css = await readFile(resolve(assets, 'css', file), 'utf8');

  for (const [key, value] of Object.entries(substitutions))
    css = css.replaceAll(`{{ .${key} }}`, value);

  if (css.includes('{{ .')) throw new Error(`Unresolved CSS asset in ${file}`);

  await writeFile(resolve(output, 'assets/css', file), css);
}

const data = await getSiteData();

const searchDirectory = resolve(output, 'search');

await mkdir(searchDirectory, { recursive: true });

for (const language of data.links.language_options) {
  for (const interfaceName of ['minecraft', 'terminal']) {
    const pages = pagesFor(data, language.id, interfaceName).filter(
      (page) => !page.fallback,
    );

    const ui = data.editorial.ui[language.id];

    const entries = [];

    const add = (entry) => entries.push(entry);

    for (const page of pages) {
      add({
        id: `page-${page.id}`,
        title: page.title,
        summary: page.description || '',
        url: page.url,
        type: 'page',
        group: ui.page,
        source: 'lobby',
        language: language.id,
        tags: [],
      });

      if (page.type !== 'links-page') continue;

      for (const item of sectionLinks(data, page.section, language.id)) {
        add({
          id: `${page.id}-${item.id}`,
          title: item.title,
          summary: item.description || '',
          url: item.url,
          type: 'link',
          group: ui[page.id] || ui.page,
          source: 'lobby',
          language: language.id,
          tags: [],
        });
      }

      for (const item of editorialItems(data, page.id, language.id)) {
        add({
          id: `${page.id}-${item.source}-${item.id}`,
          title: item.title,
          summary: item.summary || '',
          url: item.url || `${page.url}#page-${page.id}-${item.id}`,
          details_url: item.details_url || '',
          details_label: item.details_label || '',
          type: item.type,
          group: ui[item.type] || ui[page.id],
          source: item.source,
          language: item.language,
          tags: item.tags || [],
          metadata: item.metadata || {},
        });
      }
    }

    const nowPage = pages.find((page) => page.id === 'now') || pages[0];

    const now = data.links.now[language.id] || data.links.now.en;

    for (const section of now.sections || []) {
      add({
        id: `now-${section.id}`,
        title: section.title,
        summary: section.description || '',
        url: `${nowPage.url}#now-${section.id}`,
        type: 'page',
        group: ui.page,
        source: 'lobby',
        language: data.links.now[language.id] ? language.id : 'en',
        tags: [],
      });
    }

    const activity = data.editorial.now[language.id] || {};

    const activityPage = data.editorial.now[language.id]
      ? nowPage
      : pages.find((page) => page.id === 'home');

    for (const key of [
      'working',
      'building',
      'studying',
      'reading',
      'listening',
      'watching',
    ]) {
      if (!activity[key]) continue;

      add({
        id: `now-activity-${key}`,
        title: ui[key],
        summary: activity[key],
        url: `${activityPage.url}#now-activity-${key}`,
        type: 'page',
        group: ui.page,
        source: 'lobby',
        language: language.id,
        tags: [],
      });
    }

    await writeFile(
      resolve(searchDirectory, `${language.id}-${interfaceName}.json`),
      JSON.stringify(entries),
    );
  }
}

for (const language of data.links.language_options) {
  for (const interfaceName of ['minecraft', 'terminal']) {
    const start = `/${language.id}/${interfaceName === 'terminal' ? 'terminal/' : ''}`;

    await mkdir(resolve(output, 'manifests'), { recursive: true });
    await writeFile(
      resolve(
        output,
        'manifests',
        `${language.id}-${interfaceName}.webmanifest`,
      ),
      JSON.stringify({
        name: data.links.locales[language.id].seo.title,
        short_name: data.links.profile.name,
        description: data.links.locales[language.id].seo.description,
        start_url: start,
        scope: '/',
        display: 'standalone',
        background_color: '#1b1b18',
        theme_color: '#38651f',
        lang: data.links.locales[language.id].ui.html_lang,
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      }),
    );
  }
}

const sitemap = routeEntries(data)
  .map((path) => `<url><loc>https://guesant.net/${path}/</loc></url>`)
  .join('');

const sitemapContent = `<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>`;

await writeFile(resolve(output, 'sitemap.xml'), sitemapContent);

for (const language of data.links.language_options) {
  await mkdir(resolve(output, language.id), { recursive: true });
  await writeFile(resolve(output, language.id, 'sitemap.xml'), sitemapContent);
}

await writeFile(
  resolve(output, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: https://guesant.net/sitemap.xml\n`,
);
