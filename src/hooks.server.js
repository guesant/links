import { getSiteData, pagesFor } from './lib/site-data.js';

const escapeAttribute = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');

export async function handle({ event, resolve }) {
  const data = await getSiteData();

  return resolve(event, {
    transformPageChunk: ({ html }) => {
      const parts = event.url.pathname.split('/').filter(Boolean);

      const languages = data.links.language_options.map((option) => option.id);

      const hasLanguage = languages.includes(parts[0]);

      const language = hasLanguage ? parts[0] : 'pt-br';

      const terminal = parts[1] === 'terminal';

      const interfaceName = terminal ? 'terminal' : 'minecraft';

      const bodyClass = terminal
        ? 'terminal-interface'
        : 'theme-minecraft appearance-system background-default';

      const currentPages = pagesFor(data, language, interfaceName);

      const pathname = `/${parts.join('/')}`.replace(/\/+$/, '') || '/';

      const currentPage = currentPages.find(
        (entry) => entry.url.replace(/\/+$/, '') === pathname,
      );

      const page = currentPage?.id || 'home';

      const routes = data.links.language_options.map((option) => {
        const translated = pagesFor(data, option.id, interfaceName).find(
          (entry) => entry.id === page,
        );

        const home = pagesFor(data, option.id, interfaceName).find(
          (entry) => entry.id === 'home',
        );

        return {
          id: option.id,
          home: home.url,
          url: translated && !translated.fallback ? translated.url : '',
        };
      });

      const languageConfig = JSON.stringify({
        default: data.links.language_preference.default,
        current: hasLanguage && currentPage ? language : '',
        neutral: !hasLanguage || !currentPage,
        routes,
      });

      return html
        .replace('__LANG__', data.links.locales[language].ui.html_lang)
        .replace('__INTERFACE__', interfaceName)
        .replace('__PAGE__', page)
        .replace('__BODY_CLASS__', bodyClass)
        .replace('__LANGUAGE_CONFIG__', escapeAttribute(languageConfig));
    },
  });
}
