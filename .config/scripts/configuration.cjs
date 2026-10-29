const fs = require('node:fs');
const { parse } = require('yaml');

const visible = (entry) =>
  entry.enabled !== false &&
  entry.public !== false &&
  !entry.private &&
  !entry.draft;

const readConfiguration = (path = 'src/data/links.yaml') =>
  parse(fs.readFileSync(path, 'utf8'));

const visibleLinks = (configuration) =>
  configuration.sections
    .filter(visible)
    .flatMap((section) => (section.links || []).filter(visible));

function linksForSection(configuration, section) {
  const definitions = configuration.sections.flatMap(
    (entry) => entry.links || [],
  );

  const ids = (section.links || []).map((entry) => entry.id);

  for (const id of section.link_refs || []) {
    if (!definitions.some((entry) => entry.id === id))
      throw new Error(`Unknown link reference: ${id}`);

    if (ids.includes(id)) throw new Error(`Duplicate section link: ${id}`);

    ids.push(id);
  }

  if (!visible(section)) return [];

  const catalog = visibleLinks(configuration);

  return ids.flatMap((id) => catalog.filter((entry) => entry.id === id));
}

const localizedURL = (entry, language) =>
  entry.localized_urls?.[language] || entry.localized_urls?.en || entry.url;

function pagesFor(configuration, language) {
  const option = configuration.language_options.find(
    (entry) => entry.id === language,
  );

  const links = visibleLinks(configuration);

  const pages = [
    {
      id: 'home',
      type: 'home',
      title: configuration.navigation.home.labels[language],
      url: option.path,
      icon: configuration.navigation.home.icon,
    },
  ];

  for (const id of configuration.navigation.sections) {
    const section = configuration.sections.find((entry) => entry.id === id);

    if (!section) throw new Error('Unknown navigation section');

    if (!visible(section)) continue;

    pages.push({
      id,
      type: 'links-page',
      title: section.labels[language].title,
      url: `${option.path}${id}/`,
      icon: section.icon || 'book',
      links: linksForSection(configuration, section),
    });
  }

  for (const id of configuration.navigation.links) {
    const entry = links.find((entry) => entry.id === id);

    if (!entry) continue;

    pages.push({
      id,
      type: id,
      title: (entry.labels[language] || entry.labels.en).title,
      url: localizedURL(entry, language),
      icon: entry.icon,
      fallback: !configuration.now[language],
    });
  }

  return pages;
}

module.exports = {
  readConfiguration,
  visible,
  visibleLinks,
  linksForSection,
  localizedURL,
  pagesFor,
};
