import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import configuration from '../../.config/scripts/configuration.cjs';

let cached;

const visible = (entry) =>
  entry?.enabled !== false &&
  entry?.public !== false &&
  !entry?.private &&
  !entry?.draft;

export async function getSiteData() {
  if (cached) return cached;

  const readYaml = async (name) =>
    parse(await readFile(resolve(`src/data/${name}.yaml`), 'utf8'));

  const [links, editorial, credits, statistics] = await Promise.all(
    ['links', 'editorial', 'credits', 'statistics'].map(readYaml),
  );

  let federation = { version: 1, items: [] };

  try {
    federation = JSON.parse(
      await readFile(
        resolve('.cache/federation/assets/federation.json'),
        'utf8',
      ),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  cached = { links, editorial, credits, statistics, federation };

  return cached;
}

export function pagesFor(data, locale, interfaceName = 'minecraft') {
  const language = data.links.language_options.find(
    (item) => item.id === locale,
  );

  const english = data.links.language_options.find((item) => item.id === 'en');

  const pages = configuration.pagesFor(data.links, locale).map((page) => {
    const fallbackNow = page.id === 'now' && page.fallback;

    const standardURL = fallbackNow ? `${english.path}now/` : page.url;

    let terminalURL = `${language.path}terminal/`;

    if (page.id !== 'home' && !page.fallback)
      terminalURL = `${language.path}terminal/${page.id}/`;

    if (fallbackNow) terminalURL = `${english.path}terminal/now/`;

    return {
      ...page,
      description: page.description || '',
      standard_url: standardURL,
      terminal_url: terminalURL,
      url: interfaceName === 'terminal' ? terminalURL : standardURL,
      section: data.links.sections.find((section) => section.id === page.id),
    };
  });

  return pages;
}

export function routeEntries(data) {
  return data.links.language_options.flatMap(({ id }) =>
    ['minecraft', 'terminal'].flatMap((interfaceName) =>
      pagesFor(data, id, interfaceName)
        .filter((page) => !page.fallback)
        .map((page) => page.url.slice(1, -1)),
    ),
  );
}

export function sectionLinks(data, section, locale) {
  return configuration.linksForSection(data.links, section).map((item) => {
    const labels = item.labels?.[locale] || item.labels?.en || {};

    const url =
      item.localized_urls?.[locale] || item.localized_urls?.en || item.url;

    const snapshot = item.stats ? data.statistics[item.id] : undefined;

    const validSnapshot =
      snapshot?.profile_url === item.url &&
      snapshot?.provider === item.stats?.provider;

    return {
      ...item,
      title: labels.title,
      description: labels.description,
      badge: labels.badge,
      url,
      language: locale,
      statistics: item.stats
        ? validSnapshot
          ? {
              updatedLabel: data.links.statistics.updated[locale],
              updatedAt: new Date(snapshot.updated_at)
                .toISOString()
                .slice(0, 10),
              metrics: item.stats.metrics.map((id) => ({
                id,
                label: data.links.statistics.metrics[id].labels[locale],
                icon: data.links.statistics.metrics[id].icon,
                value: String(snapshot.metrics[id]),
                total: snapshot.available?.[id],
              })),
            }
          : { unavailable: data.links.statistics.unavailable[locale] }
        : undefined,
    };
  });
}

export function destination(data, item) {
  const url = item.url?.trim() || '#';

  const external = /^(https?:|mailto:|tel:)/i.test(url);

  let thirdParty = false;

  if (/^https?:/i.test(url)) {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');

    thirdParty = !data.links.site.first_party_domains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  }

  const target = item.target || (external ? '_blank' : '_self');

  return {
    href: external ? url : url.replace(/^\//, '/'),
    external,
    thirdParty,
    target,
    rel: target === '_blank' ? 'noopener noreferrer' : undefined,
    display: url.replace(/^mailto:/i, ''),
  };
}

export function editorialItems(data, sectionID, locale) {
  const kinds = {
    career: ['skill', 'experience', 'education'],
    code: ['project', 'case'],
    writing: ['post', 'case'],
    interests: ['interests'],
    uses: ['uses'],
    library: ['library'],
    curiosities: ['curiosities'],
  };

  const sourceItems = data.federation.items || [];

  const resume = sourceItems.filter((item) => item.source === 'resume');

  const preferredResume = resume.filter((item) => item.language === locale);

  const federated = [
    ...sourceItems.filter((item) => item.source === 'blog'),
    ...(preferredResume.length
      ? preferredResume
      : resume.filter((item) => item.language === 'en')),
  ];

  const seen = new Set();

  const remoteItems = [];

  for (const item of federated) {
    const identity = `${item.source}-${item.id}`;

    if (!kinds[sectionID]?.includes(item.type) || seen.has(identity)) continue;

    const translated = federated.find(
      (candidate) =>
        candidate.source === item.source &&
        candidate.id === item.id &&
        candidate.language === locale,
    );

    const fallback = federated.find(
      (candidate) =>
        candidate.source === item.source &&
        candidate.id === item.id &&
        candidate.language === 'en',
    );

    remoteItems.push(translated || fallback || item);
    seen.add(identity);
  }

  const localItems = (data.editorial.entries?.[sectionID] || [])
    .filter(visible)
    .map((item) => {
      const labels =
        item.labels?.[locale] ||
        item.labels?.['pt-br'] ||
        item.labels?.en ||
        {};

      const language = item.labels?.[locale]
        ? locale
        : item.labels?.['pt-br']
          ? 'pt-br'
          : 'en';

      if (!item.id || !labels.title)
        throw new Error(`Invalid editorial entry: ${sectionID}`);

      return {
        id: item.id,
        type: sectionID,
        source: 'lobby',
        language,
        title: labels.title,
        summary: labels.description || '',
        url: item.url || '',
        tags: item.tags || [],
        metadata: {
          group: item.group || '',
          status: item.status || '',
          updated: item.updated || '',
        },
      };
    });

  return [...remoteItems, ...localItems].map((item) => {
    const output = { ...item };

    if (item.type === 'experience') {
      const position =
        item.metadata?.position?.trim() ||
        data.editorial.ui[locale].affiliation_unspecified;

      output.title = `${item.title} · ${position}`;
    }

    if (
      item.type === 'project' &&
      item.source === 'resume' &&
      item.metadata?.content_url
    ) {
      const detailsURL = item.metadata.content_url;

      const host = new URL(detailsURL).hostname.toLowerCase();

      const platform =
        host.includes('youtube') || host === 'youtu.be'
          ? 'YouTube'
          : host.split('.')[0] === 'github'
            ? 'GitHub'
            : 'GitLab';

      output.details_url = detailsURL;
      output.details_label = data.editorial.ui[locale].platform_link.replace(
        '{platform}',
        platform,
      );
    }

    return output;
  });
}
