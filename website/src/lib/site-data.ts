import { linkNavigation } from './link-navigation.ts';

export { editorialItems, editorialKinds } from './editorial-items.ts';

export type LocalizedText = Record<string, string>;

export type LinkLabel = {
  title: string;
  description?: string;
  badge?: string;
};

export type LinkStatistics = {
  provider: string;
  metrics: string[];
};

export type LinkStatisticsSnapshot = {
  updatedLabel?: string;
  updatedAt?: string;
  unavailable?: string;
  metrics?: Array<{
    id: string;
    label: string;
    icon: string;
    value: string;
    total?: string | number;
  }>;
};

export type LinkRecord = {
  id: string;
  icon: string;
  labels: Record<string, LinkLabel>;
  url?: string;
  localized_urls?: Record<string, string>;
  title?: string;
  description?: string;
  badge?: string;
  target?: string;
  enabled?: boolean;
  public?: boolean;
  private?: boolean;
  draft?: boolean;
  featured?: boolean;
  audiences?: string[];
  stats?: LinkStatistics;
  visual?: {
    src: string;
    alt: Record<string, string>;
    width: number;
    height: number;
    kind: string;
  };
  statistics?: LinkStatisticsSnapshot;
};

export type SectionRecord = {
  id: string;
  icon: string;
  enabled?: boolean;
  public?: boolean;
  private?: boolean;
  draft?: boolean;
  labels: Record<string, LinkLabel>;
  links: LinkRecord[];
  link_refs?: string[];
  editorial?: boolean;
};

export type PageRecord = {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string;
  standard_url: string;
  terminal_url: string;
  fallback: boolean;
  icon?: string;
  section?: SectionRecord;
  links?: LinkRecord[];
};

export type LocaleRecord = LinkDocument['locales'][string];

export type NowRecord = LinkDocument['now'][string];

export type DisplayLinkRecord = Omit<
  LinkRecord,
  'labels' | 'url' | 'visual' | 'statistics'
> & {
  title: string;
  url: string;
  language: string;
  description?: string;
  badge?: string;
  visual?: Omit<NonNullable<LinkRecord['visual']>, 'alt'> & { alt: string };
  statistics?: LinkStatisticsSnapshot;
};

export type EditorialRecord = {
  id: string;
  type: string;
  source: string;
  language: string;
  title: string;
  summary: string;
  url: string;
  tags: string[];
  metadata: Record<string, string | string[]>;
  details_url?: string;
  details_label?: string;
};

export type EditorialEntry = {
  id: string;
  url?: string;
  tags?: string[];
  group?: string;
  status?: string;
  updated?: string;
  enabled?: boolean;
  public?: boolean;
  private?: boolean;
  draft?: boolean;
  labels: Record<string, { title: string; description?: string }>;
};

export type CreditLicense = { name: string; url: string; text: string };

export type CreditEntry = {
  id: string;
  name: string;
  authors: string;
  license: string;
  official_url: string;
};

export type StatisticsSnapshot = {
  username: string;
  profile_url: string;
  provider: string;
  updated_at: string;
  metrics: Record<string, number>;
  available?: Record<string, number>;
};

export type FederationItem = {
  id: string;
  source: 'blog' | 'resume';
  language: string;
  type: 'post' | 'case' | 'project' | 'skill' | 'experience' | 'education';
  title: string;
  summary: string;
  url: string;
  tags: string[];
  metadata: Record<string, string | string[]>;
};

export type SiteData = {
  links: LinkDocument;
  editorial: {
    entries: Record<string, EditorialEntry[]>;
    ui: Record<string, Record<string, string>>;
    now: Record<string, Record<string, string>>;
  };
  credits: { licenses: Record<string, CreditLicense>; entries: CreditEntry[] };
  statistics: Record<string, StatisticsSnapshot>;
  federation: { version: 1; items: FederationItem[] };
};

export type PageLoadData = {
  isLanguageEntry: boolean;
  config: {
    profile: LinkDocument['profile'];
    theme: Pick<LinkDocument['theme'], 'appearance' | 'animations_enabled'>;
    navigation: Pick<LinkDocument['navigation'], 'home'>;
    site: LinkDocument['site'];
    language_preference: LinkDocument['language_preference'];
  };
  nowActivity: Record<string, string>;
  editorialUI: Record<string, string>;
  localized: LocaleRecord;
  build: {
    commitLabel: string;
    commitURL: string;
    versionLabel: string;
    workflowLabel: string;
    buildLabel: string;
    workflowURL: string;
  };
  credits: SiteData['credits'];
  locale: string;
  interfaceName: 'minecraft' | 'terminal';
  page: PageRecord;
  pages: PageRecord[];
  languageRoutes: Array<{
    id: string;
    path: string;
    label: string;
    hreflang: string;
    ogLocale: string;
    available: boolean;
    standardURL: string;
    terminalURL: string;
  }>;
  standardHomeURL: string;
  standardPageURL: string;
  terminalPageURL: string;
  homeSections: Array<{
    page: PageRecord;
    links: DisplayLinkRecord[];
    editorial: EditorialRecord[];
  }>;
  quickLinks: Array<
    Pick<DisplayLinkRecord, 'id' | 'title' | 'url' | 'icon' | 'target'>
  >;
  links: DisplayLinkRecord[];
  editorial: EditorialRecord[];
  now: NowRecord;
};

export type LinkDocument = {
  profile: {
    name: string;
    username: string;
    avatar: string;
    birth_date: string;
    same_as_links: string[];
  };
  theme: {
    preset: string;
    appearance: string;
    background: string;
    animations_enabled: boolean;
  };
  language_options: Array<{
    id: string;
    path: string;
    label: string;
    hreflang: string;
  }>;
  sections: SectionRecord[];
  quick_contacts: string[];
  site: {
    repository: string;
    repository_label: string;
    first_party_domains: string[];
  };
  statistics: {
    updated: Record<string, string>;
    unavailable: Record<string, string>;
    metrics: Record<string, { icon: string; labels: Record<string, string> }>;
  };
  locales: Record<
    string,
    {
      seo: { title: string; description: string };
      profile: { bio: string };
      ui: Record<string, string> & { third_party: string; html_lang: string };
      presentation: {
        title: string;
        facts: Array<{ icon: string; text: string }>;
        site_title: string;
        topics: string[];
      };
    }
  >;
  now: Record<
    string,
    {
      seo: { title: string; description: string };
      title: string;
      intro: string;
      sections: Array<{ id: string; title: string; description: string }>;
    }
  >;
  language_preference: { default: string };
  navigation: {
    sections: string[];
    links: string[];
    home: { icon: string; labels: Record<string, string> };
    labels: Record<string, string>;
  };
  home: { illustration_enabled: boolean };
  audiences: Array<{ id: string; labels: Record<string, string> }>;
};

export type LinkDestination = {
  href: string;
  external: boolean;
  thirdParty: boolean;
  target: string;
  rel?: string;
  display: string;
};

export function resolveDestination(
  site: LinkDocument['site'],
  item: Pick<LinkRecord, 'url' | 'target'>,
): LinkDestination {
  const url = item.url?.trim() || '#';

  const navigation = linkNavigation(url);

  const absolute = /^(https?:|mailto:|tel:|\/\/)/i.test(url);

  const external = navigation.external || /^(mailto:|tel:)/i.test(url);

  let thirdParty = false;

  if (/^https?:/i.test(url)) {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');

    thirdParty = !site.first_party_domains.some((domain) => {
      return host === domain || host.endsWith(`.${domain}`);
    });
  }

  const resolveTarget = () => {
    if (navigation.external) {
      return '_blank';
    }

    return item.target || '_self';
  };

  const target = resolveTarget();

  const resolveHref = () => {
    if (absolute) {
      return url;
    }

    return url.replace(/^\//, '/');
  };

  const externalRelAttributes = () => {
    if (target === '_blank') {
      return { rel: 'noopener noreferrer' };
    }

    return {};
  };

  return {
    href: resolveHref(),
    external,
    thirdParty,
    target,
    ...externalRelAttributes(),
    display: url.replace(/^mailto:/i, ''),
  };
}

export function destination(
  data: SiteData,
  item: Pick<LinkRecord, 'url' | 'target'>,
) {
  return resolveDestination(data.links.site, item);
}
