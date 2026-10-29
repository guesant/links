import { error } from '@sveltejs/kit';
import { localizedURL } from './configuration.ts';
import { requiredText } from './validation-primitives.ts';
import {
  editorialItems,
  type LinkRecord,
  type PageRecord,
  type PageLoadData,
} from './site-data.ts';
import { getSiteData, pagesFor, sectionLinks } from './site-data.server.ts';

export async function loadPageData(
  path: string,
  isLanguageEntry: boolean = false,
): Promise<PageLoadData> {
  const data = await getSiteData();

  const parts = path.split('/').filter(Boolean);

  const locale = parts[0];

  if (
    !locale ||
    !data.links.language_options.some((language) => {
      return language.id === locale;
    })
  ) {
    error(404, 'Page not found');
  }

  const isTerminal = parts[1] === 'terminal';

  const resolveInterfaceName = () => {
    if (isTerminal) {
      return 'terminal';
    }

    return 'minecraft';
  };

  const interfaceName = resolveInterfaceName();

  const pages = pagesFor(data, locale, interfaceName);

  const pathname = `/${parts.join('/')}`.replace(/\/+$/, '') || '/';

  const standardPages = pagesFor(data, locale, 'minecraft');

  const terminalPages = pagesFor(data, locale, 'terminal');

  const page = pages.find((entry) => {
    return entry.url.replace(/\/+$/, '') === pathname;
  });

  if (!page || page.fallback) {
    error(404, 'Page not found');
  }

  const pageID = page.id;

  const localized = data.links.locales[locale];

  const editorialUI = data.editorial.ui[locale];

  if (!localized || !editorialUI) {
    error(404, 'Page not found');
  }

  const repositoryURL = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || data.links.site.repository}`;

  const commitSHA = process.env.GITHUB_SHA || '';

  const runID = process.env.GITHUB_RUN_ID || '';

  const uiText = (key: string): string => {
    return requiredText(localized.ui[key], `links.locales.${locale}.ui.${key}`);
  };

  const resolveCommitLabel = () => {
    if (commitSHA.length > 7) {
      return commitSHA.slice(0, 7);
    }

    return uiText('local_commit');
  };

  const resolveWorkflowURL = () => {
    if (runID) {
      return `${repositoryURL}/actions/runs/${runID}`;
    }

    return repositoryURL;
  };

  const build = {
    commitLabel: resolveCommitLabel(),
    commitURL: `${repositoryURL}/commit/${commitSHA}`,
    versionLabel: uiText('footer_version'),
    workflowLabel: uiText('footer_workflow'),
    buildLabel: uiText('local_build'),
    workflowURL: resolveWorkflowURL(),
  };

  const resolveLinks = () => {
    if (page.section) {
      return sectionLinks(data, page.section, locale);
    }

    return [];
  };

  const links = resolveLinks();

  const resolveEditorial = () => {
    if (page.section) {
      return editorialItems(data, page.id, locale);
    }

    return [];
  };

  const editorial = resolveEditorial();

  const now = data.links.now[locale] || data.links.now.en;

  if (!now) {
    throw new Error('Missing default personal update');
  }

  const categoryPages = pages.filter((entry) => {
    return entry.type === 'links-page';
  });

  const standardHomePage = standardPages.find((entry) => {
    return entry.id === 'home';
  });

  const firstStandardPage = standardPages[0];

  const firstTerminalPage = terminalPages[0];

  if (!standardHomePage || !firstStandardPage || !firstTerminalPage) {
    error(404, 'Page not found');
  }

  const quickLinks = data.links.quick_contacts.flatMap((id) => {
    for (const section of data.links.sections) {
      const item = (section.links || []).find((link: LinkRecord) => {
        return link.id === id && visible(link);
      });

      if (item) {
        const labels = item.labels?.[locale] || item.labels?.en;

        if (!labels) {
          throw new Error(`Missing link labels: ${id}`);
        }

        return [
          {
            ...item,
            title: labels.title,
            url: localizedURL(item, locale),
          },
        ];
      }
    }

    return [];
  });

  const languageRoutes = data.links.language_options.map((option) => {
    const standard = pagesFor(data, option.id, 'minecraft');

    const terminal = pagesFor(data, option.id, 'terminal');

    const standardPage = standard.find((entry) => {
      return entry.id === pageID;
    });

    const terminalPage = terminal.find((entry) => {
      return entry.id === pageID;
    });

    const resolveStandardURL = () => {
      if (standardPage && !standardPage.fallback) {
        return standardPage.url;
      }

      return standard[0]?.url || '/';
    };

    const resolveTerminalURL = () => {
      if (terminalPage && !terminalPage.fallback) {
        return terminalPage.url;
      }

      return terminal[0]?.url || '/';
    };

    return {
      ...option,
      ogLocale: data.links.locales[option.id]?.ui.og_locale || '',
      available: Boolean(standardPage && !standardPage.fallback),
      standardURL: resolveStandardURL(),
      terminalURL: resolveTerminalURL(),
    };
  });

  const clientConfig = {
    profile: data.links.profile,
    theme: {
      appearance: data.links.theme.appearance,
      animations_enabled: data.links.theme.animations_enabled,
    },
    navigation: { home: data.links.navigation.home },
    site: data.links.site,
    language_preference: data.links.language_preference,
  };

  const resolveHomeSections = () => {
    if (pageID === 'home') {
      return categoryPages.map((entry) => {
        if (!entry.section) {
          throw new Error(`Missing section: ${entry.id}`);
        }

        return {
          page: pageSummary(entry),
          links: sectionLinks(data, entry.section, locale),
          editorial: editorialItems(data, entry.id, locale),
        };
      });
    }

    return [];
  };

  const homeSections = resolveHomeSections();

  return {
    isLanguageEntry,
    config: clientConfig,
    nowActivity: data.editorial.now[locale] || {},
    editorialUI,
    localized,
    build,
    credits: data.credits,
    locale,
    interfaceName,
    page: pageSummary(page),
    pages: pages.map(pageSummary),
    languageRoutes,
    standardHomeURL: standardHomePage.url,
    standardPageURL:
      standardPages.find((entry) => {
        return entry.id === pageID && !entry.fallback;
      })?.url || firstStandardPage.url,
    terminalPageURL:
      terminalPages.find((entry) => {
        return entry.id === pageID && !entry.fallback;
      })?.url || firstTerminalPage.url,
    homeSections,
    quickLinks,
    links,
    editorial,
    now,
  };
}

function pageSummary(entry: PageRecord): PageRecord {
  const summary = { ...entry };

  delete summary.section;
  delete summary.links;

  return summary;
}

const visible = (entry: {
  enabled?: boolean;
  public?: boolean;
  private?: boolean;
  draft?: boolean;
}) => {
  return (
    entry?.enabled !== false &&
    entry?.public !== false &&
    !entry?.private &&
    !entry?.draft
  );
};
