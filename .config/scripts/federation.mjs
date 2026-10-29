import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireWebsite } from './paths.cjs';

const { parse } = requireWebsite('yaml');

const types = new Set([
  'post',
  'case',
  'project',
  'skill',
  'experience',
  'education',
]);

const metadataKeys = new Set([
  'date',
  'updated',
  'categories',
  'position',
  'degree',
  'area',
  'start_date',
  'end_date',
  'content_url',
]);

const text = (value, max = 12000) => {
  if (typeof value !== 'string' || value.length > max) {
    throw new Error('Invalid federation text');
  }

  return value;
};

export function validateFeed(feed, source) {
  if (
    feed?.version !== 1 ||
    feed.source !== source.id ||
    !Array.isArray(feed.items) ||
    feed.items.length > 10000
  ) {
    throw new Error(`Invalid feed: ${source.id}`);
  }

  const ids = new Set();

  const items = feed.items.map((entry) => {
    if (
      typeof entry.id !== 'string' ||
      !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(entry.id) ||
      !types.has(entry.type)
    ) {
      throw new Error('Invalid federation identity');
    }

    const language = text(entry.language, 20)
      .toLowerCase()
      .replaceAll('_', '-');

    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(language)) {
      throw new Error('Invalid federation language');
    }

    const key = `${entry.id}:${language}`;

    if (ids.has(key)) {
      throw new Error(`Duplicate federation entry: ${key}`);
    }

    ids.add(key);

    const url = new URL(text(entry.url, 2048));

    if (
      url.origin !== source.origin ||
      url.username ||
      url.password ||
      url.protocol !== 'https:'
    ) {
      throw new Error('Invalid federation canonical URL');
    }

    if (
      entry.private ||
      entry.draft ||
      entry.public === false ||
      entry.enabled === false
    ) {
      throw new Error('Nonpublic federation entry');
    }

    if (!entry.title?.trim()) {
      throw new Error('Missing federation title');
    }

    if (!Array.isArray(entry.tags) || entry.tags.length > 100) {
      throw new Error('Invalid federation tags');
    }

    const metadata = {};

    for (const [key, value] of Object.entries(entry.metadata || {})) {
      if (!metadataKeys.has(key)) {
        continue;
      }

      const resolveValue = () => {
        if (key === 'categories') {
          return value.map((item) => {
            return text(item, 200);
          });
        }

        return text(value, 2048);
      };

      metadata[key] = resolveValue();

      if (key === 'content_url') {
        const destination = new URL(metadata[key]);

        if (
          source.id !== 'resume' ||
          entry.type !== 'project' ||
          destination.protocol !== 'https:' ||
          destination.username ||
          destination.password ||
          destination.port ||
          ![
            'github.com',
            'gitlab.com',
            'www.youtube.com',
            'youtube.com',
            'youtu.be',
          ].includes(destination.hostname)
        ) {
          throw new Error('Invalid public content URL');
        }

        metadata[key] = destination.href;
      }
    }

    return {
      id: entry.id,
      source: source.id,
      language,
      type: entry.type,
      title: text(entry.title, 1000),
      summary: text(entry.summary),
      url: url.href,
      tags: entry.tags.map((tag) => {
        return text(tag, 200);
      }),
      metadata,
    };
  });

  return { version: 1, source: source.id, items };
}

export async function loadFeed(
  source,
  { cacheDirectory, localFile, fetcher = fetch, warn = console.warn },
) {
  await mkdir(cacheDirectory, { recursive: true });

  const cache = resolve(cacheDirectory, `${source.id}.json`);

  let feed;

  if (localFile) {
    feed = validateFeed(JSON.parse(await readFile(localFile, 'utf8')), source);
  } else {
    let bytes;

    try {
      const response = await fetcher(source.url, {
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      bytes = await response.text();
    } catch (error) {
      try {
        feed = validateFeed(JSON.parse(await readFile(cache, 'utf8')), source);
      } catch {
        throw new Error(
          `No valid feed or cache for ${source.id}: ${error.message}`,
        );
      }

      warn(`Using last valid ${source.id} feed: ${error.message}`);
    }

    if (bytes !== undefined) {
      if (bytes.length > 5_000_000) {
        throw new Error('Federation feed too large');
      }

      feed = validateFeed(JSON.parse(bytes), source);
    }
  }

  await writeFile(`${cache}.tmp`, JSON.stringify(feed));
  await rename(`${cache}.tmp`, cache);

  return feed;
}

export async function syncFederation() {
  const config = parse(await readFile('.config/federation.yaml', 'utf8'));

  const feeds = await Promise.all(
    config.sources.map((source) => {
      return loadFeed(source, {
        cacheDirectory: resolve('.cache/federation'),
        localFile: process.env[`LOBBY_${source.id.toUpperCase()}_FEED`],
      });
    }),
  );

  const directory = resolve('.cache/federation/assets');

  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, 'federation.json.tmp'),
    JSON.stringify({
      version: 1,
      items: feeds.flatMap((feed) => {
        return feed.items;
      }),
    }),
  );
  await rename(
    resolve(directory, 'federation.json.tmp'),
    resolve(directory, 'federation.json'),
  );
}
