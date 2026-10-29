import type { EditorialRecord, SiteData } from './site-data.ts';

export const editorialKinds: Record<string, readonly string[]> = {
  career: ['skill', 'experience', 'education'],
  code: ['project', 'case'],
  writing: ['post', 'case'],
  interests: ['interests'],
  uses: ['uses'],
  library: ['library'],
  curiosities: ['curiosities'],
};

function visible(entry: {
  enabled?: boolean;
  public?: boolean;
  private?: boolean;
  draft?: boolean;
}): boolean {
  return (
    entry.enabled !== false &&
    entry.public !== false &&
    !entry.private &&
    !entry.draft
  );
}

function federatedItems(
  data: SiteData,
  sectionID: string,
  locale: string,
): EditorialRecord[] {
  const sourceItems = data.federation.items;

  const resume = sourceItems.filter((item) => {
    return item.source === 'resume';
  });

  const preferredResume = resume.filter((item) => {
    return item.language === locale;
  });

  const resolveItems = () => {
    if (preferredResume.length) {
      return preferredResume;
    }

    return resume.filter((item) => {
      return item.language === 'en';
    });
  };

  const items = [
    ...sourceItems.filter((item) => {
      return item.source === 'blog';
    }),
    ...resolveItems(),
  ];

  const seen = new Set<string>();

  const output: EditorialRecord[] = [];

  for (const item of items) {
    const identity = `${item.source}-${item.id}`;

    if (!editorialKinds[sectionID]?.includes(item.type) || seen.has(identity)) {
      continue;
    }

    const matching = items.filter((candidate) => {
      return candidate.source === item.source && candidate.id === item.id;
    });

    output.push(
      matching.find((candidate) => {
        return candidate.language === locale;
      }) ||
        matching.find((candidate) => {
          return candidate.language === 'en';
        }) ||
        item,
    );
    seen.add(identity);
  }

  return output;
}

function localItems(
  data: SiteData,
  sectionID: string,
  locale: string,
): EditorialRecord[] {
  return (data.editorial.entries?.[sectionID] || [])
    .filter(visible)
    .map((item) => {
      const labels =
        item.labels[locale] || item.labels['pt-br'] || item.labels.en;

      const resolveLanguage = () => {
        if (item.labels[locale]) {
          return locale;
        }

        if (item.labels['pt-br']) {
          return 'pt-br';
        }

        return 'en';
      };

      const language = resolveLanguage();

      if (!item.id || !labels?.title) {
        throw new Error(`Invalid editorial entry: ${sectionID}`);
      }

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
}

function platformFor(url: string): string {
  const host = new URL(url).hostname.toLowerCase();

  if (host.includes('youtube') || host === 'youtu.be') {
    return 'YouTube';
  }

  if (host.split('.')[0] === 'github') {
    return 'GitHub';
  }

  return 'GitLab';
}

function decorateItem(
  item: EditorialRecord,
  data: SiteData,
  locale: string,
): EditorialRecord {
  if (item.type === 'experience') {
    const rawPosition = item.metadata.position;

    const resolvePosition = () => {
      if (typeof rawPosition === 'string') {
        return rawPosition.trim();
      }

      return '';
    };

    const position =
      resolvePosition() ||
      data.editorial.ui[locale]?.affiliation_unspecified ||
      data.editorial.ui.en?.affiliation_unspecified ||
      '';

    return { ...item, title: `${item.title} · ${position}` };
  }

  if (
    item.type !== 'project' ||
    item.source !== 'resume' ||
    typeof item.metadata.content_url !== 'string'
  ) {
    return item;
  }

  const detailsURL = item.metadata.content_url;

  const platform = platformFor(detailsURL);

  return {
    ...item,
    details_url: detailsURL,
    details_label: (
      data.editorial.ui[locale]?.platform_link ||
      data.editorial.ui.en?.platform_link ||
      '{platform}'
    ).replace('{platform}', platform),
  };
}

export function editorialItems(
  data: SiteData,
  sectionID: string,
  locale: string,
): EditorialRecord[] {
  return [
    ...federatedItems(data, sectionID, locale),
    ...localItems(data, sectionID, locale),
  ].map((item) => {
    return decorateItem(item, data, locale);
  });
}
