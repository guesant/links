import {
  languageDestination,
  languageFor,
  selectedLanguage,
  type LanguageContext,
} from './language-preference.ts';

export const languageStorageKey = 'guesant-links-language';

type LanguagePage = { context: LanguageContext; url: URL };

type Dependencies = {
  page: () => LanguagePage | null;
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  languages: () => readonly string[];
  navigate: (_url: URL) => Promise<void>;
  replaceURL: (_url: URL) => void;
  fallback: (_url: URL) => void;
};

export type LanguageNavigation = {
  normalize: () => Promise<void>;
  select: (_id: string) => Promise<void>;
  beforeNavigate: (_url: URL | null) => void;
  destroy: () => void;
};

export function createLanguageNavigation(
  dependencies: Dependencies,
): LanguageNavigation {
  let generation = 0;

  let pending = false;

  let destroyed = false;

  let fellBack = false;

  let destination: string | null = null;

  const savedLanguage = (): string | null => {
    try {
      return dependencies.storage().getItem(languageStorageKey);
    } catch {
      return null;
    }
  };

  const remember = (id: string): boolean => {
    try {
      const storage = dependencies.storage();

      storage.setItem(languageStorageKey, id);

      return storage.getItem(languageStorageKey) === id;
    } catch {
      return false;
    }
  };

  const navigate = async (url: URL): Promise<void> => {
    const request = ++generation;

    pending = true;
    destination = url.href;

    try {
      await dependencies.navigate(url);
    } catch {
      if (!destroyed && request === generation && !fellBack) {
        fellBack = true;
        dependencies.fallback(url);
      }
    } finally {
      if (request === generation) {
        pending = false;
        destination = null;
      }
    }
  };

  return {
    async normalize(): Promise<void> {
      const page = dependencies.page();

      if (!page || pending || destroyed) {
        return;
      }

      const { context, url } = page;

      const selected = selectedLanguage(
        context,
        url,
        savedLanguage(),
        dependencies.languages(),
      );

      if (!selected) {
        return;
      }

      const explicit = languageFor(context, url.searchParams.get('lang'));

      const target = languageDestination(selected, url) || new URL(url);

      if (explicit && remember(explicit.id)) {
        target.searchParams.delete('lang');
      }

      if (target.href === url.href) {
        return;
      }

      if (target.pathname === url.pathname) {
        dependencies.replaceURL(target);
      } else {
        await navigate(target);
      }
    },
    async select(id: string): Promise<void> {
      const page = dependencies.page();

      if (!page || destroyed) {
        return;
      }

      const route = languageFor(page.context, id);

      const target = route && languageDestination(route, page.url, true);

      if (!target) {
        return;
      }

      if (remember(id)) {
        target.searchParams.delete('lang');
      } else {
        target.searchParams.set('lang', id);
      }

      if (target.href !== page.url.href) {
        await navigate(target);
      }
    },
    beforeNavigate(url: URL | null): void {
      if (pending && url?.href !== destination) {
        generation++;
        pending = false;
        destination = null;
      }
    },
    destroy(): void {
      destroyed = true;
      generation++;
    },
  };
}
