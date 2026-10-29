<script lang="ts">
  import {
    afterNavigate,
    beforeNavigate,
    goto,
    replaceState,
  } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, type Snippet } from 'svelte';
  import SitePage from '$lib/SitePage.svelte';
  import { languageContext } from '$lib/language-preference.ts';
  import {
    createLanguageNavigation,
    type LanguageNavigation,
  } from '$lib/language-navigation.ts';
  import type { PageLoadData } from '$lib/site-data.ts';

  let { children }: { children: Snippet } = $props();

  let data: PageLoadData | null = $derived.by(() => {
    if (page.status < 400 && page.data.page) {
      return page.data as PageLoadData;
    }

    return null;
  });

  let navigation: LanguageNavigation | undefined;

  onMount(() => {
    navigation = createLanguageNavigation({
      page: () => {
        if (!data) {
          return null;
        }

        return {
          context: languageContext(data),
          url: new URL(window.location.href),
        };
      },
      storage: () => {
        return window.localStorage;
      },
      languages: () => {
        return navigator.languages || [navigator.language];
      },
      navigate: async (url) => {
        await goto(url, {
          replaceState: true,
          keepFocus: true,
          noScroll: true,
        });

        if (page.status >= 400) {
          throw new Error('Language destination could not be loaded');
        }
      },
      replaceURL: (url) => {
        replaceState(url, page.state);
      },
      fallback: (url) => {
        window.location.replace(url.href);
      },
    });

    return () => {
      navigation?.destroy();
    };
  });

  const changeLanguage = (event: Event): void => {
    const select = event.target;

    if (
      select instanceof HTMLSelectElement &&
      select.matches('[data-language-switcher]')
    ) {
      const id = select.selectedOptions.item(0)?.dataset.language;

      if (id) {
        void navigation?.select(id);
      }
    }
  };

  beforeNavigate(({ to }) => {
    navigation?.beforeNavigate(to?.url || null);
  });

  afterNavigate(() => {
    if (data) {
      document.documentElement.dataset.interface = data.interfaceName;
      document.documentElement.dataset.page = data.page.id;
      document.documentElement.lang = data.localized.ui.html_lang;
      document.body.className = bodyClass(data.interfaceName);
    }

    requestAnimationFrame(() => {
      return document.dispatchEvent(new Event('lobby:navigate'));
    });
    queueMicrotask(() => {
      void navigation?.normalize();
    });
  });

  function bodyClass(interfaceName: PageLoadData['interfaceName']): string {
    if (interfaceName === 'terminal') {
      return 'terminal-interface';
    }

    return 'theme-minecraft appearance-system background-default';
  }
</script>

<svelte:document onchange={changeLanguage} />

{#if data}
  <SitePage {data} />
{/if}
{@render children()}
