import { optionalProperty } from './object-fields.ts';
import type {
  LinkDocument,
  LinkRecord,
  SectionRecord,
  SiteData,
} from './site-data.ts';
import {
  validateCredits,
  validateEditorial,
  validateFederation,
  validateStatistics,
} from './content-validation.ts';
import {
  array,
  optionalBoolean,
  optionalString,
  record,
  requiredBoolean,
  requiredText,
  strings,
  text,
  validateTextMap,
} from './validation-primitives.ts';

function validateLinks(value: unknown): void {
  const links = record(value, 'links data');

  const profile = record(links.profile, 'links.profile');

  text(profile.name, 'links.profile.name');
  text(profile.username, 'links.profile.username');
  text(profile.birth_date, 'links.profile.birth_date');
  strings(profile.same_as_links, 'links.profile.same_as_links');

  const site = record(links.site, 'links.site');

  text(site.repository, 'links.site.repository');
  strings(site.first_party_domains, 'links.site.first_party_domains');

  const preference = record(
    links.language_preference,
    'links.language_preference',
  );

  const navigation = record(links.navigation, 'links.navigation');

  const languages = array(links.language_options, 'links.language_options');

  if (!languages.length) {
    throw new Error('Invalid links.language_options: empty list');
  }

  for (const [
    index,
    entry,
  ] of languages.entries()) {
    const language = record(entry, `links.language_options[${index}]`);

    text(language.id, `links.language_options[${index}].id`);
    text(language.path, `links.language_options[${index}].path`);
  }

  const languageIDs = new Set(
    languages.map((entry, index) => {
      return requiredText(
        record(entry, `links.language_options[${index}]`).id,
        `links.language_options[${index}].id`,
      );
    }),
  );

  if (languageIDs.size !== languages.length) {
    throw new Error('Invalid links.language_options: duplicate language id');
  }

  text(preference.default, 'links.language_preference.default');

  if (!languageIDs.has(preference.default)) {
    throw new Error('Invalid links.language_preference.default');
  }

  const localized = record(links.locales, 'links.locales');

  for (const id of languageIDs) {
    const locale = record(localized[id], `links.locales.${id}`);

    record(locale.seo, `links.locales.${id}.seo`);
    record(locale.profile, `links.locales.${id}.profile`);
    record(locale.ui, `links.locales.${id}.ui`);
    record(locale.presentation, `links.locales.${id}.presentation`);
  }

  const navigationSections = strings(
    navigation.sections,
    'links.navigation.sections',
  );

  const navigationLinks = strings(navigation.links, 'links.navigation.links');

  record(navigation.home, 'links.navigation.home');

  const sections = array(links.sections, 'links.sections');

  const sectionIDs = new Set<string>();

  const linkIDs = new Set<string>();

  for (const [
    index,
    entry,
  ] of sections.entries()) {
    const section = record(entry, `links.sections[${index}]`);

    text(section.id, `links.sections[${index}].id`);

    if (sectionIDs.has(section.id)) {
      throw new Error(`Duplicate links.sections id: ${section.id}`);
    }

    sectionIDs.add(section.id);

    for (const item of array(
      section.links || [],
      `links.sections[${index}].links`,
    )) {
      const link = record(item, `links.sections[${index}].links[]`);

      text(link.id, `links.sections[${index}].links[].id`);

      if (linkIDs.has(link.id)) {
        throw new Error(`Duplicate links.sections link id: ${link.id}`);
      }

      linkIDs.add(link.id);

      if (link.url !== undefined) {
        text(link.url, `links.sections[${index}].links[].url`);

        if (/^\s*(javascript|data|vbscript):/i.test(link.url)) {
          throw new Error(`Invalid links.sections[${index}].links[].url`);
        }
      } else if (link.localized_urls === undefined) {
        throw new Error(
          `Missing destination at links.sections[${index}].links[]`,
        );
      }

      if (link.localized_urls !== undefined) {
        const localizedURLs = record(
          link.localized_urls,
          `links.sections[${index}].links[].localized_urls`,
        );

        for (const [
          locale,
          destination,
        ] of Object.entries(localizedURLs)) {
          if (!languageIDs.has(locale)) {
            throw new Error(`Unknown localized URL language: ${locale}`);
          }

          text(
            destination,
            `links.sections[${index}].links[].localized_urls.${locale}`,
          );

          if (/^\s*(javascript|data|vbscript):/i.test(destination)) {
            throw new Error(
              `Invalid localized URL at links.sections[${index}].links[]`,
            );
          }
        }
      }

      for (const flag of [
        'enabled',
        'public',
        'private',
        'draft',
      ]) {
        if (link[flag] !== undefined && typeof link[flag] !== 'boolean') {
          throw new Error(`Invalid link visibility flag: ${flag}`);
        }
      }

      const labels = record(
        link.labels,
        `links.sections[${index}].links[].labels`,
      );

      for (const language of languageIDs) {
        const localizedLabel = record(
          labels[language],
          `links.sections[${index}].links[].labels.${language}`,
        );

        text(
          localizedLabel.title,
          `links.sections[${index}].links[].labels.${language}.title`,
        );
      }
    }

    if (section.link_refs !== undefined) {
      strings(section.link_refs, `links.sections[${index}].link_refs`);
    }

    const labels = record(section.labels, `links.sections[${index}].labels`);

    for (const language of languageIDs) {
      const localizedLabel = record(
        labels[language],
        `links.sections[${index}].labels.${language}`,
      );

      text(
        localizedLabel.title,
        `links.sections[${index}].labels.${language}.title`,
      );
      text(
        localizedLabel.description,
        `links.sections[${index}].labels.${language}.description`,
      );
    }
  }

  const quickContacts = strings(links.quick_contacts, 'links.quick_contacts');

  for (const id of quickContacts) {
    if (!linkIDs.has(id)) {
      throw new Error(`Unknown quick contact link: ${id}`);
    }
  }

  for (const id of navigationSections) {
    if (!sectionIDs.has(id)) {
      throw new Error(`Unknown navigation section: ${id}`);
    }
  }

  for (const id of navigationLinks) {
    if (!linkIDs.has(id)) {
      throw new Error(`Unknown navigation link: ${id}`);
    }
  }

  for (const [
    index,
    entry,
  ] of sections.entries()) {
    const section = record(entry, `links.sections[${index}]`);

    const resolveRefs = () => {
      if (section.link_refs) {
        return strings(section.link_refs, `links.sections[${index}].link_refs`);
      }

      return [];
    };

    const refs = resolveRefs();

    const ownLinks = array(
      section.links || [],
      `links.sections[${index}].links`,
    ).map((link, linkIndex) => {
      return requiredText(
        record(link, `links.sections[${index}].links[${linkIndex}]`).id,
        `links.sections[${index}].links[${linkIndex}].id`,
      );
    });

    if (
      new Set([
        ...ownLinks,
        ...refs,
      ]).size !==
      ownLinks.length + refs.length
    ) {
      throw new Error(`Duplicate link in section ${section.id}`);
    }

    for (const id of refs) {
      if (!linkIDs.has(id)) {
        throw new Error(`Unknown link reference: ${id}`);
      }
    }
  }
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`Invalid ${label}`);
  }

  return Number(value);
}

function validateNow(
  value: unknown,
  label: string,
): LinkDocument['now'][string] {
  const source = record(value, label);

  const seo = record(source.seo, `${label}.seo`);

  const sections = array(source.sections, `${label}.sections`).map(
    (rawSection, index) => {
      const itemLabel = `${label}.sections[${index}]`;

      const section = record(rawSection, itemLabel);

      return {
        id: requiredText(section.id, `${itemLabel}.id`),
        title: requiredText(section.title, `${itemLabel}.title`),
        description: requiredText(
          section.description,
          `${itemLabel}.description`,
        ),
      };
    },
  );

  return {
    seo: {
      title: requiredText(seo.title, `${label}.seo.title`),
      description: requiredText(seo.description, `${label}.seo.description`),
    },
    title: requiredText(source.title, `${label}.title`),
    intro: requiredText(source.intro, `${label}.intro`),
    sections,
  };
}

function localizedLinkLabels(
  value: unknown,
  label: string,
  languages: Set<string>,
): NonNullable<LinkRecord['labels']> {
  const source = record(value, label);

  const labels: NonNullable<LinkRecord['labels']> = {};

  for (const language of languages) {
    const raw = record(source[language], `${label}.${language}`);

    const description = optionalString(
      raw.description,
      `${label}.${language}.description`,
    );

    const badge = optionalString(raw.badge, `${label}.${language}.badge`);

    labels[language] = {
      title: requiredText(raw.title, `${label}.${language}.title`),
      ...optionalProperty('description', description),
      ...optionalProperty('badge', badge),
    };
  }

  return labels;
}

function linkFromUnknown(
  value: unknown,
  label: string,
  languages: Set<string>,
): LinkRecord {
  const source = record(value, label);

  const url = optionalString(source.url, `${label}.url`);

  const localizedURLs: Record<string, string> = {};

  if (source.localized_urls !== undefined) {
    const rawURLs = record(source.localized_urls, `${label}.localized_urls`);

    for (const [
      language,
      rawURL,
    ] of Object.entries(rawURLs)) {
      if (!languages.has(language)) {
        throw new Error(`Unknown localized URL language: ${language}`);
      }

      localizedURLs[language] = requiredText(
        rawURL,
        `${label}.localized_urls.${language}`,
      );
    }
  }

  if (!url && !Object.keys(localizedURLs).length) {
    throw new Error(`Missing destination at ${label}`);
  }

  const resolveAudiences = () => {
    if (source.audiences === undefined) {
      return undefined;
    }

    return strings(source.audiences, `${label}.audiences`);
  };

  const audiences = resolveAudiences();

  const flags = {
    enabled: optionalBoolean(source.enabled, `${label}.enabled`),
    public: optionalBoolean(source.public, `${label}.public`),
    private: optionalBoolean(source.private, `${label}.private`),
    draft: optionalBoolean(source.draft, `${label}.draft`),
    featured: optionalBoolean(source.featured, `${label}.featured`),
  };

  const title = optionalString(source.title, `${label}.title`);

  const description = optionalString(
    source.description,
    `${label}.description`,
  );

  const badge = optionalString(source.badge, `${label}.badge`);

  const target = optionalString(source.target, `${label}.target`);

  let stats: LinkRecord['stats'];

  if (source.stats !== undefined) {
    const rawStats = record(source.stats, `${label}.stats`);

    stats = {
      provider: requiredText(rawStats.provider, `${label}.stats.provider`),
      metrics: strings(rawStats.metrics, `${label}.stats.metrics`),
    };
  }

  let visual: LinkRecord['visual'];

  if (source.visual !== undefined) {
    const rawVisual = record(source.visual, `${label}.visual`);

    visual = {
      src: requiredText(rawVisual.src, `${label}.visual.src`),
      alt: validateTextMap(rawVisual.alt, `${label}.visual.alt`),
      kind: requiredText(rawVisual.kind, `${label}.visual.kind`),
      width: positiveInteger(rawVisual.width, `${label}.visual.width`),
      height: positiveInteger(rawVisual.height, `${label}.visual.height`),
    };
  }

  const localizedURLFields = () => {
    if (Object.keys(localizedURLs).length) {
      return {
        localized_urls: localizedURLs,
      };
    }

    return {};
  };

  return {
    id: requiredText(source.id, `${label}.id`),
    ...optionalProperty('url', url),
    ...localizedURLFields(),
    icon: requiredText(source.icon, `${label}.icon`),
    labels: localizedLinkLabels(source.labels, `${label}.labels`, languages),
    ...optionalProperty('title', title),
    ...optionalProperty('description', description),
    ...optionalProperty('badge', badge),
    ...optionalProperty('target', target),
    ...optionalProperty('audiences', audiences),
    ...optionalProperty('stats', stats),
    ...optionalProperty('visual', visual),
    ...optionalProperty('enabled', flags.enabled),
    ...optionalProperty('public', flags.public),
    ...optionalProperty('private', flags.private),
    ...optionalProperty('draft', flags.draft),
    ...optionalProperty('featured', flags.featured),
  };
}

function sectionFromUnknown(
  value: unknown,
  index: number,
  languages: Set<string>,
): SectionRecord {
  const label = `links.sections[${index}]`;

  const source = record(value, label);

  const links = array(source.links ?? [], `${label}.links`).map(
    (item, linkIndex) => {
      return linkFromUnknown(item, `${label}.links[${linkIndex}]`, languages);
    },
  );

  const resolveSectionReferences = () => {
    if (source.link_refs === undefined) {
      return undefined;
    }

    return strings(source.link_refs, `${label}.link_refs`);
  };

  const refs = resolveSectionReferences();

  const enabled = optionalBoolean(source.enabled, `${label}.enabled`);

  const isPublic = optionalBoolean(source.public, `${label}.public`);

  const editorial = optionalBoolean(source.editorial, `${label}.editorial`);

  const isPrivate = optionalBoolean(source.private, `${label}.private`);

  const draft = optionalBoolean(source.draft, `${label}.draft`);

  const icon = optionalString(source.icon, `${label}.icon`) || 'book';

  const labels: SectionRecord['labels'] = {};

  const rawLabels = record(source.labels, `${label}.labels`);

  for (const language of languages) {
    const localized = record(
      rawLabels[language],
      `${label}.labels.${language}`,
    );

    labels[language] = {
      title: requiredText(localized.title, `${label}.labels.${language}.title`),
      description: requiredText(
        localized.description,
        `${label}.labels.${language}.description`,
      ),
    };
  }

  return {
    id: requiredText(source.id, `${label}.id`),
    icon,
    labels,
    links,
    ...optionalProperty('link_refs', refs),
    ...optionalProperty('editorial', editorial),
    ...optionalProperty('draft', draft),
    ...optionalProperty('private', isPrivate),
    ...optionalProperty('enabled', enabled),
    ...optionalProperty('public', isPublic),
  };
}

function linkDocumentFromUnknown(value: unknown): LinkDocument {
  validateLinks(value);

  const source = record(value, 'links data');

  const languageOptions = array(
    source.language_options,
    'links.language_options',
  ).map((item, index) => {
    const label = `links.language_options[${index}]`;

    const language = record(item, label);

    return {
      id: requiredText(language.id, `${label}.id`),
      path: requiredText(language.path, `${label}.path`),
      label: requiredText(language.label, `${label}.label`),
      hreflang: requiredText(language.hreflang, `${label}.hreflang`),
    };
  });

  const languages = new Set(
    languageOptions.map(({ id }) => {
      return id;
    }),
  );

  const rawProfile = record(source.profile, 'links.profile');

  const rawTheme = record(source.theme, 'links.theme');

  const rawSite = record(source.site, 'links.site');

  const rawPreference = record(
    source.language_preference,
    'links.language_preference',
  );

  const rawNavigation = record(source.navigation, 'links.navigation');

  const rawHomeNavigation = record(rawNavigation.home, 'links.navigation.home');

  const defaultLanguage = requiredText(
    rawPreference.default,
    'links.language_preference.default',
  );

  if (!languages.has(defaultLanguage)) {
    throw new Error('Invalid links.language_preference.default');
  }

  const sections = array(source.sections, 'links.sections').map(
    (section, index) => {
      return sectionFromUnknown(section, index, languages);
    },
  );

  const languageStatistics = record(source.statistics, 'links.statistics');

  const rawMetricDefinitions = record(
    languageStatistics.metrics,
    'links.statistics.metrics',
  );

  const metrics: LinkDocument['statistics']['metrics'] = {};

  for (const [
    id,
    rawMetric,
  ] of Object.entries(rawMetricDefinitions)) {
    const metric = record(rawMetric, `links.statistics.metrics.${id}`);

    metrics[id] = {
      icon: requiredText(metric.icon, `links.statistics.metrics.${id}.icon`),
      labels: validateTextMap(
        metric.labels,
        `links.statistics.metrics.${id}.labels`,
      ),
    };
  }

  const rawLocales = record(source.locales, 'links.locales');

  const locales: LinkDocument['locales'] = {};

  for (const language of languages) {
    const label = `links.locales.${language}`;

    const locale = record(rawLocales[language], label);

    const seo = record(locale.seo, `${label}.seo`);

    const profile = record(locale.profile, `${label}.profile`);

    const presentation = record(locale.presentation, `${label}.presentation`);

    const ui = validateTextMap(locale.ui, `${label}.ui`);

    const facts = array(presentation.facts, `${label}.presentation.facts`).map(
      (fact, index) => {
        const itemLabel = `${label}.presentation.facts[${index}]`;

        const item = record(fact, itemLabel);

        return {
          icon: requiredText(item.icon, `${itemLabel}.icon`),
          text: requiredText(item.text, `${itemLabel}.text`),
        };
      },
    );

    locales[language] = {
      seo: {
        title: requiredText(seo.title, `${label}.seo.title`),
        description: requiredText(seo.description, `${label}.seo.description`),
      },
      profile: {
        bio: requiredText(profile.bio, `${label}.profile.bio`),
      },
      ui: {
        ...ui,
        third_party: requiredText(ui.third_party, `${label}.ui.third_party`),
        html_lang: requiredText(ui.html_lang, `${label}.ui.html_lang`),
      },
      presentation: {
        title: requiredText(presentation.title, `${label}.presentation.title`),
        facts,
        site_title: requiredText(
          presentation.site_title,
          `${label}.presentation.site_title`,
        ),
        topics: strings(presentation.topics, `${label}.presentation.topics`),
      },
    };
  }

  const rawNow = record(source.now, 'links.now');

  const now: LinkDocument['now'] = {};

  for (const [
    language,
    content,
  ] of Object.entries(rawNow)) {
    now[language] = validateNow(content, `links.now.${language}`);
  }

  const rawAudiences = array(source.audiences, 'links.audiences').map(
    (value, index) => {
      const label = `links.audiences[${index}]`;

      const audience = record(value, label);

      return {
        id: requiredText(audience.id, `${label}.id`),
        labels: validateTextMap(audience.labels, `${label}.labels`),
      };
    },
  );

  const rawHome = record(source.home, 'links.home');

  const navigationSections = strings(
    rawNavigation.sections,
    'links.navigation.sections',
  );

  const navigationLinks = strings(
    rawNavigation.links,
    'links.navigation.links',
  );

  const statistics = {
    updated: validateTextMap(
      languageStatistics.updated,
      'links.statistics.updated',
    ),
    unavailable: validateTextMap(
      languageStatistics.unavailable,
      'links.statistics.unavailable',
    ),
    metrics,
  };

  return {
    profile: {
      name: requiredText(rawProfile.name, 'links.profile.name'),
      username: requiredText(rawProfile.username, 'links.profile.username'),
      avatar: optionalString(rawProfile.avatar, 'links.profile.avatar') ?? '',
      birth_date: requiredText(
        rawProfile.birth_date,
        'links.profile.birth_date',
      ),
      same_as_links: strings(
        rawProfile.same_as_links,
        'links.profile.same_as_links',
      ),
    },
    theme: {
      preset: requiredText(rawTheme.preset, 'links.theme.preset'),
      appearance: requiredText(rawTheme.appearance, 'links.theme.appearance'),
      background: requiredText(rawTheme.background, 'links.theme.background'),
      animations_enabled: requiredBoolean(
        rawTheme.animations_enabled,
        'links.theme.animations_enabled',
      ),
    },
    language_options: languageOptions,
    sections,
    quick_contacts: strings(source.quick_contacts, 'links.quick_contacts'),
    site: {
      repository: requiredText(rawSite.repository, 'links.site.repository'),
      repository_label: requiredText(
        rawSite.repository_label,
        'links.site.repository_label',
      ),
      first_party_domains: strings(
        rawSite.first_party_domains,
        'links.site.first_party_domains',
      ),
    },
    statistics,
    locales,
    now,
    language_preference: {
      default: defaultLanguage,
    },
    navigation: {
      sections: navigationSections,
      links: navigationLinks,
      home: {
        icon: requiredText(
          rawHomeNavigation.icon,
          'links.navigation.home.icon',
        ),
        labels: validateTextMap(
          rawHomeNavigation.labels,
          'links.navigation.home.labels',
        ),
      },
      labels: validateTextMap(rawNavigation.labels, 'links.navigation.labels'),
    },
    home: {
      illustration_enabled: requiredBoolean(
        rawHome.illustration_enabled,
        'links.home.illustration_enabled',
      ),
    },
    audiences: rawAudiences,
  };
}

export function validateSiteDocuments(input: {
  links: unknown;
  editorial: unknown;
  credits: unknown;
  statistics: unknown;
  federation: unknown;
}): SiteData {
  return {
    links: linkDocumentFromUnknown(input.links),
    editorial: validateEditorial(input.editorial),
    credits: validateCredits(input.credits),
    statistics: validateStatistics(input.statistics),
    federation: validateFederation(input.federation),
  };
}
