import { error } from '@sveltejs/kit';
import {
  destination,
  editorialItems,
  getSiteData,
  pagesFor,
  routeEntries,
  sectionLinks,
} from '$lib/site-data.js';

export const prerender = true;
export const trailingSlash = 'always';

export async function entries() {
  const data = await getSiteData();
  return routeEntries(data).map((path) => ({ path }));
}

export async function load({ params }) {
  const data = await getSiteData();
  const parts = (params.path || '').split('/').filter(Boolean);
  const locale = parts[0];
  if (!data.links.language_options.some((language) => language.id === locale))
    error(404, 'Page not found');
  const isTerminal = parts[1] === 'terminal';
  const interfaceName = isTerminal ? 'terminal' : 'minecraft';
  const pages = pagesFor(data, locale, interfaceName);
  const pathname = `/${parts.join('/')}`.replace(/\/+$/, '') || '/';
  const standardPages = pagesFor(data, locale, 'minecraft');
  const terminalPages = pagesFor(data, locale, 'terminal');
  const page = pages.find(
    (entry) => entry.url.replace(/\/+$/, '') === pathname,
  );
  if (!page || page.fallback) error(404, 'Page not found');
  const pageID = page.id;
  const localized = data.links.locales[locale];
  const editorialUI = data.editorial.ui[locale];
  const repositoryURL = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || data.links.site.repository}`;
  const commitSHA = process.env.GITHUB_SHA || '';
  const runID = process.env.GITHUB_RUN_ID || '';
  const build = {
    commitLabel:
      commitSHA.length > 7 ? commitSHA.slice(0, 7) : localized.ui.local_commit,
    commitURL: `${repositoryURL}/commit/${commitSHA}`,
    versionLabel: localized.ui.footer_version,
    workflowLabel: localized.ui.footer_workflow,
    buildLabel: localized.ui.local_build,
    workflowURL: runID
      ? `${repositoryURL}/actions/runs/${runID}`
      : repositoryURL,
  };
  const links = page.section ? sectionLinks(data, page.section, locale) : [];
  const editorial = page.section ? editorialItems(data, page.id, locale) : [];
  const now = data.links.now[locale] || data.links.now.en;
  const categoryPages = pages.filter((entry) => entry.type === 'links-page');
  const searchIndex = makeSearchIndex(data, pages, locale);
  const homeSections = categoryPages.map((entry) => ({
    page: entry,
    links: sectionLinks(data, entry.section, locale),
    editorial: editorialItems(data, entry.id, locale),
  }));
  const quickLinks = data.links.quick_contacts.flatMap((id) => {
    for (const section of data.links.sections) {
      const item = (section.links || []).find(
        (link) => link.id === id && visible(link),
      );
      if (item) {
        const labels = item.labels?.[locale] || item.labels?.en || {};
        return [
          {
            ...item,
            title: labels.title,
            url:
              item.localized_urls?.[locale] ||
              item.localized_urls?.en ||
              item.url,
          },
        ];
      }
    }
    return [];
  });
  const languageRoutes = data.links.language_options.map((option) => {
    const standard = pagesFor(data, option.id, 'minecraft');
    const terminal = pagesFor(data, option.id, 'terminal');
    const standardPage = standard.find((entry) => entry.id === pageID);
    const terminalPage = terminal.find((entry) => entry.id === pageID);
    return {
      ...option,
      standardURL:
        standardPage && !standardPage.fallback
          ? standardPage.url
          : standard[0].url,
      terminalURL:
        terminalPage && !terminalPage.fallback
          ? terminalPage.url
          : terminal[0].url,
    };
  });
  return {
    config: data.links,
    editorialData: data.editorial,
    editorialUI,
    localized,
    build,
    credits: data.credits,
    statistics: data.statistics,
    federation: data.federation,
    locale,
    interfaceName,
    page,
    pages,
    standardPages,
    terminalPages,
    languageRoutes,
    standardHomeURL: standardPages.find((entry) => entry.id === 'home').url,
    standardPageURL:
      standardPages.find((entry) => entry.id === pageID && !entry.fallback)
        ?.url || standardPages[0].url,
    terminalPageURL:
      terminalPages.find((entry) => entry.id === pageID && !entry.fallback)
        ?.url || terminalPages[0].url,
    categoryPages,
    homeSections,
    quickLinks,
    links,
    editorial,
    now,
    searchIndex,
  };
}

const visible = (entry) =>
  entry?.enabled !== false &&
  entry?.public !== false &&
  !entry?.private &&
  !entry?.draft;

function makeSearchIndex(data, pages, locale) {
  const ui = data.editorial.ui[locale];
  const entries = [];
  for (const page of pages) {
    const localURL = page.url.replace(/^\//, '/');
    entries.push({
      id: `page-${page.id}`,
      title: page.title,
      summary: page.description || '',
      url: localURL,
      type: 'page',
      group: ui.page,
      source: 'lobby',
      language: page.fallback ? 'en' : locale,
      tags: [],
    });
    if (page.type !== 'links-page') continue;
    const links = sectionLinks(data, page.section, locale);
    for (const item of links) {
      entries.push({
        id: `${page.id}-${item.id}`,
        title: item.title,
        summary: item.description || '',
        url: destination(data, item).href,
        type: 'link',
        group: ui[page.id] || ui.page,
        source: 'lobby',
        language: locale,
        tags: [],
      });
    }
    for (const item of editorialItems(data, page.id, locale)) {
      const url = item.url || `${page.url}#page-${page.id}-${item.id}`;
      entries.push({
        id: `${page.id}-${item.source}-${item.id}`,
        title: item.title,
        summary: item.summary || '',
        url: url.startsWith('/') ? url.replace(/^\//, '/') : url,
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
  const now = data.links.now[locale] || data.links.now.en;
  for (const section of now.sections || []) {
    entries.push({
      id: `now-${section.id}`,
      title: section.title,
      summary: section.description || '',
      url: `${nowPage.url}#now-${section.id}`,
      type: 'page',
      group: ui.page,
      source: 'lobby',
      language: data.links.now[locale] ? locale : 'en',
      tags: [],
    });
  }
  const activity = data.editorial.now[locale] || {};
  const activityPage = data.editorial.now[locale]
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
    entries.push({
      id: `now-activity-${key}`,
      title: ui[key],
      summary: activity[key],
      url: `${activityPage.url}#now-activity-${key}`,
      type: 'page',
      group: ui.page,
      source: 'lobby',
      language: locale,
      tags: [],
    });
  }
  return entries;
}
