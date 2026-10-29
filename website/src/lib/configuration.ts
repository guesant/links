import type { LinkDocument, LinkRecord, SectionRecord } from './site-data.ts';

type Publication = Pick<LinkRecord, 'enabled' | 'public' | 'private' | 'draft'>;

type ConfiguredPage = {
  id: string;
  type: string;
  title: string;
  description?: string;
  url: string;
  icon: string;
  fallback?: boolean;
  links?: LinkRecord[];
};

export function visible(entry: Publication): boolean {
  return (
    entry.enabled !== false &&
    entry.public !== false &&
    !entry.private &&
    !entry.draft
  );
}

export function visibleLinks(configuration: LinkDocument): LinkRecord[] {
  return configuration.sections.filter(visible).flatMap((section) => {
    return (section.links || []).filter(visible);
  });
}

export function linksForSection(
  configuration: LinkDocument,
  section: SectionRecord,
): LinkRecord[] {
  const definitions = configuration.sections.flatMap((entry) => {
    return entry.links || [];
  });

  const ids = (section.links || []).map((entry) => {
    return entry.id;
  });

  for (const id of section.link_refs || []) {
    if (
      !definitions.some((entry) => {
        return entry.id === id;
      })
    ) {
      throw new Error(`Unknown link reference: ${id}`);
    }

    if (ids.includes(id)) {
      throw new Error(`Duplicate section link: ${id}`);
    }

    ids.push(id);
  }

  if (!visible(section)) {
    return [];
  }

  const catalog = visibleLinks(configuration);

  return ids.flatMap((id) => {
    return catalog.filter((entry) => {
      return entry.id === id;
    });
  });
}

export function localizedURL(entry: LinkRecord, language: string): string {
  const url =
    entry.localized_urls?.[language] || entry.localized_urls?.en || entry.url;

  if (!url) {
    throw new Error(`Missing URL: ${entry.id}`);
  }

  return url;
}

function sectionPages(
  configuration: LinkDocument,
  language: string,
  path: string,
): ConfiguredPage[] {
  return configuration.navigation.sections.flatMap((id) => {
    const section = configuration.sections.find((entry) => {
      return entry.id === id;
    });

    if (!section) {
      throw new Error('Unknown navigation section');
    }

    if (!visible(section)) {
      return [];
    }

    const label = section.labels[language];

    if (!label) {
      throw new Error(`Missing section language: ${id}:${language}`);
    }

    return [
      {
        id,
        type: 'links-page',
        title: label.title,
        description: label.description || '',
        url: `${path}${id}/`,
        icon: section.icon || 'book',
        links: linksForSection(configuration, section),
      },
    ];
  });
}

function linkedPages(
  configuration: LinkDocument,
  language: string,
): ConfiguredPage[] {
  const links = visibleLinks(configuration);

  return configuration.navigation.links.flatMap((id) => {
    const entry = links.find((entry) => {
      return entry.id === id;
    });

    if (!entry) {
      return [];
    }

    const label = entry.labels[language] || entry.labels.en;

    if (!label) {
      throw new Error(`Missing link language: ${id}:${language}`);
    }

    return [
      {
        id,
        type: id,
        title: label.title,
        url: localizedURL(entry, language),
        icon: entry.icon,
        fallback: !configuration.now[language],
      },
    ];
  });
}

export function pagesFor(
  configuration: LinkDocument,
  language: string,
): ConfiguredPage[] {
  const option = configuration.language_options.find((entry) => {
    return entry.id === language;
  });

  const title = configuration.navigation.home.labels[language];

  if (!option || !title) {
    throw new Error(`Unknown navigation language: ${language}`);
  }

  return [
    {
      id: 'home',
      type: 'home',
      title,
      url: option.path,
      icon: configuration.navigation.home.icon,
    },
    ...sectionPages(configuration, language, option.path),
    ...linkedPages(configuration, language),
  ];
}
