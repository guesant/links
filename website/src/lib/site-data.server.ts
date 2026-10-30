import { optionalProperty } from './object-fields.ts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import * as configuration from './configuration.ts';
import { validateSiteDocuments } from './data-validation.ts';
import type {
  DisplayLinkRecord,
  PageRecord,
  SectionRecord,
  SiteData,
} from './site-data.ts';

let cached: SiteData | undefined;

export async function getSiteData(
  websiteRoot: string = process.cwd(),
): Promise<SiteData> {
  if (cached) {
    return cached;
  }

  const readYaml = async (name: string): Promise<unknown> => {
    return parse(
      await readFile(resolve(websiteRoot, `src/data/${name}.yaml`), 'utf8'),
    ) as unknown;
  };

  const [
    links,
    editorial,
    credits,
    statistics,
  ] = await Promise.all(
    [
      'links',
      'editorial',
      'credits',
      'statistics',
    ].map(readYaml),
  );

  let federation: unknown = {
    version: 1,
    items: [],
  };

  try {
    federation = JSON.parse(
      await readFile(
        resolve(websiteRoot, '../.cache/federation/assets/federation.json'),
        'utf8',
      ),
    ) as unknown;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }

  cached = validateSiteDocuments({
    links,
    editorial,
    credits,
    statistics,
    federation,
  });

  return cached;
}

export function pagesFor(
  data: SiteData,
  locale: string,
  interfaceName = 'minecraft',
): PageRecord[] {
  const language = data.links.language_options.find((item) => {
    return item.id === locale;
  });

  const english = data.links.language_options.find((item) => {
    return item.id === 'en';
  });

  if (!language || !english) {
    throw new Error(`Unknown language: ${locale}`);
  }

  return configuration.pagesFor(data.links, locale).map((page) => {
    const fallbackNow = page.id === 'now' && page.fallback;

    const resolveStandardURL = () => {
      if (fallbackNow) {
        return `${english.path}now/`;
      }

      return page.url;
    };

    const standardURL = resolveStandardURL();

    let terminalURL = `${language.path}terminal/`;

    if (page.id !== 'home' && !page.fallback) {
      terminalURL = `${language.path}terminal/${page.id}/`;
    }

    if (fallbackNow) {
      terminalURL = `${english.path}terminal/now/`;
    }

    const section = data.links.sections.find((candidate) => {
      return candidate.id === page.id;
    });

    const resolveUrl = () => {
      if (interfaceName === 'terminal') {
        return terminalURL;
      }

      return standardURL;
    };

    return {
      ...page,
      fallback: page.fallback || false,
      description: page.description || '',
      standard_url: standardURL,
      terminal_url: terminalURL,
      url: resolveUrl(),
      ...optionalProperty('section', section),
    };
  });
}

export function routeEntries(data: SiteData): string[] {
  return data.links.language_options.flatMap(({ id }) => {
    return [
      'minecraft',
      'terminal',
    ].flatMap((interfaceName) => {
      return pagesFor(data, id, interfaceName)
        .filter((page) => {
          return !page.fallback;
        })
        .map((page) => {
          return page.url.slice(1, -1);
        });
    });
  });
}

export function sectionLinks(
  data: SiteData,
  section: SectionRecord,
  locale: string,
): DisplayLinkRecord[] {
  return configuration.linksForSection(data.links, section).map((item) => {
    return displayLink(data, item, locale);
  });
}

type ConfiguredLink = ReturnType<typeof configuration.linksForSection>[number];

function localizedVisual(
  visual: ConfiguredLink['visual'],
  locale: string,
): DisplayLinkRecord['visual'] {
  if (!visual) {
    return undefined;
  }

  return {
    ...visual,
    alt: visual.alt[locale] || visual.alt.en || '',
  };
}

function linkStatistics(
  data: SiteData,
  item: ConfiguredLink,
  locale: string,
): DisplayLinkRecord['statistics'] {
  if (!item.stats) {
    return undefined;
  }

  const snapshot = data.statistics[item.id];

  if (
    !snapshot ||
    snapshot.profile_url !== item.url ||
    snapshot.provider !== item.stats.provider
  ) {
    return {
      unavailable:
        data.links.statistics.unavailable[locale] ||
        data.links.statistics.unavailable.en ||
        '',
    };
  }

  return {
    updatedLabel:
      data.links.statistics.updated[locale] ||
      data.links.statistics.updated.en ||
      '',
    updatedAt: new Date(snapshot.updated_at).toISOString().slice(0, 10),
    metrics: item.stats.metrics.map((id) => {
      const metric = data.links.statistics.metrics[id];

      if (!metric) {
        throw new Error(`Unknown metric: ${id}`);
      }

      return {
        id,
        label: metric.labels[locale] || metric.labels.en || id,
        icon: metric.icon,
        value: String(snapshot.metrics[id]),
        ...optionalProperty('total', snapshot.available?.[id]),
      };
    }),
  };
}

function displayLink(
  data: SiteData,
  item: ConfiguredLink,
  locale: string,
): DisplayLinkRecord {
  const { visual, ...baseItem } = item;

  const labels = item.labels[locale] || item.labels.en;

  if (!labels) {
    throw new Error(`Missing link labels: ${item.id}`);
  }

  const url =
    item.localized_urls?.[locale] ||
    item.localized_urls?.en ||
    item.url ||
    Object.values(item.localized_urls || {})[0];

  if (!url) {
    throw new Error(`Missing link destination: ${item.id}`);
  }

  const statistics = linkStatistics(data, item, locale);

  const displayVisual = localizedVisual(visual, locale);

  return {
    ...baseItem,
    title: labels.title,
    url,
    language: locale,
    ...optionalProperty('description', labels.description),
    ...optionalProperty('badge', labels.badge),
    ...optionalProperty('visual', displayVisual),
    ...optionalProperty('statistics', statistics),
  };
}

export { configuration };
