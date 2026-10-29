import type { Handle } from '@sveltejs/kit';
import { getSiteData, pagesFor } from './lib/site-data.server.ts';

export const handle: Handle = async ({ event, resolve }) => {
  const data = await getSiteData();

  return resolve(event, {
    preload: ({ type }) => {
      return type !== 'js';
    },
    transformPageChunk: ({ html }) => {
      const parts = event.url.pathname.split('/').filter(Boolean);

      const languages = data.links.language_options.map((option) => {
        return option.id;
      });

      const hasLanguage = !!parts[0] && languages.includes(parts[0]);

      const resolveLanguage = () => {
        if (hasLanguage && parts[0]) {
          return parts[0];
        }

        return data.links.language_preference.default;
      };

      const language = resolveLanguage();

      const terminal = parts[1] === 'terminal';

      const resolveInterfaceName = () => {
        if (terminal) {
          return 'terminal';
        }

        return 'minecraft';
      };

      const interfaceName = resolveInterfaceName();

      const resolveBodyClass = () => {
        if (terminal) {
          return 'terminal-interface';
        }

        return 'theme-minecraft appearance-system background-default';
      };

      const bodyClass = resolveBodyClass();

      const resolveEarlyHead = () => {
        if (terminal) {
          return '<link rel="preload" href="/assets/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous"><link rel="stylesheet" href="/assets/css/reset.css"><link rel="stylesheet" href="/assets/css/terminal.css">';
        }

        return '<link rel="preload" href="/assets/fonts/press-start-2p-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous"><link rel="preload" href="/assets/fonts/oxanium-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous"><link rel="preload" href="/assets/generated/aged-oak.webp" as="image" type="image/webp" fetchpriority="high"><link rel="stylesheet" href="/assets/css/minecraft.css">';
      };

      const earlyHead = resolveEarlyHead();

      const currentPages = pagesFor(data, language, interfaceName);

      const pathname = `/${parts.join('/')}`.replace(/\/+$/, '') || '/';

      const currentPage = currentPages.find((entry) => {
        return entry.url.replace(/\/+$/, '') === pathname;
      });

      const page = currentPage?.id || 'home';

      return html
        .replace(
          '__LANG__',
          data.links.locales[language]?.ui.html_lang ||
            data.links.locales.en?.ui.html_lang ||
            'en',
        )
        .replace('__INTERFACE__', interfaceName)
        .replace('__PAGE__', page)
        .replace('__BODY_CLASS__', bodyClass)
        .replace('__EARLY_HEAD__', earlyHead);
    },
  });
};
