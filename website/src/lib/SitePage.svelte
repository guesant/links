<script lang="ts">
  import IconButton from '$lib/IconButton.svelte';
  import MinecraftPage from '$lib/MinecraftPage.svelte';
  import TerminalPage from '$lib/TerminalPage.svelte';
  import type { PageLoadData } from '$lib/site-data.ts';

  let { data }: { data: PageLoadData } = $props();

  let terminal = $derived(data.interfaceName === 'terminal');

  let {
    config,
    editorialUI,
    localized,
    locale,
    page,
    languageRoutes,
    standardHomeURL,
  } = $derived(data);

  let home = $derived(page.id === 'home');

  let credits = $derived(data.credits.entries);

  let title = $derived.by(() => {
    if (home) {
      return localized.seo.title;
    }

    if (page.id === 'now') {
      return data.now.seo.title;
    }

    return `${page.title} | ${config.profile.name}`;
  });

  let description = $derived.by(() => {
    if (home) {
      return localized.seo.description;
    }

    if (page.id === 'now') {
      return data.now.seo.description;
    }

    return page.description || localized.seo.description;
  });

  let canonical = $derived(`https://guesant.net${page.url}`);

  let siteCanonical = $derived(`https://guesant.net/${locale}/`);

  let defaultRoute = $derived(
    languageRoutes.find((option) => {
      return option.id === config.language_preference.default;
    }),
  );

  const robots = $derived.by(() => {
    if (data.isLanguageEntry) {
      return 'noindex, follow';
    }

    return 'index, follow';
  });

  const defaultLanguageURL = $derived.by(() => {
    if (terminal) {
      return defaultRoute?.terminalURL || standardHomeURL;
    }

    return defaultRoute?.standardURL || standardHomeURL;
  });

  function languageURL(option: PageLoadData['languageRoutes'][number]): string {
    if (terminal) {
      return option.terminalURL;
    }

    return option.standardURL;
  }

  function themeLabel(theme: string): string {
    if (theme === 'system') {
      return localized.ui.theme_system || '';
    }

    if (theme === 'dark') {
      return localized.ui.theme_dark || '';
    }

    return localized.ui.theme_light || '';
  }

  function pageIdentity(): Record<string, string | { '@id': string }> {
    if (home) {
      return {
        '@type': 'ProfilePage',
        '@id': `${canonical}#profile`,
        mainEntity: { '@id': `${siteCanonical}#person` },
      };
    }

    return {
      '@type': 'WebPage',
      '@id': `${canonical}#page`,
      about: { '@id': `${siteCanonical}#person` },
    };
  }

  let structuredData = $derived(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': `${siteCanonical}#person`,
          name: config.profile.name,
          alternateName: `@${config.profile.username}`,
          url: siteCanonical,
          image: 'https://guesant.net/images/og-image.png',
          sameAs: data.quickLinks
            .filter((item) => {
              return config.profile.same_as_links.includes(item.id);
            })
            .map((item) => {
              return item.url;
            }),
        },
        {
          '@type': 'WebSite',
          '@id': `${siteCanonical}#website`,
          url: siteCanonical,
          name: localized.seo.title,
          description: localized.seo.description,
          inLanguage: localized.ui.html_lang,
          publisher: { '@id': `${siteCanonical}#person` },
        },
        {
          ...pageIdentity(),
          url: canonical,
          name: title,
          description,
          inLanguage: localized.ui.html_lang,
          isPartOf: { '@id': `${siteCanonical}#website` },
        },
      ],
    }).replaceAll('<', '\\u003c'),
  );

  let structuredDataMarkup = $derived(
    '<scr' +
      'ipt type="application/ld+json">' +
      structuredData +
      '</scr' +
      'ipt>',
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="author" content={config.profile.name} />
  <meta name="creator" content={config.profile.name} />
  <meta name="publisher" content={config.profile.name} />
  <meta name="robots" content={robots} />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta name="theme-color" content="#111111" />
  <link rel="canonical" href={canonical} />
  <link rel="icon" href="/favicon.png" type="image/png" sizes="64x64" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link
    rel="manifest"
    href={`/manifests/${locale}-${data.interfaceName}.webmanifest`}
  />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:site_name" content={`${config.profile.name} | Links`} />
  <meta property="og:locale" content={localized.ui.og_locale} />
  {#each languageRoutes.filter((option) => {
    return option.id !== locale;
  }) as option}
    <meta property="og:locale:alternate" content={option.ogLocale} />
  {/each}
  <meta property="og:image" content="https://guesant.net/images/og-image.png" />
  <meta
    property="og:image:secure_url"
    content="https://guesant.net/images/og-image.png"
  />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={title} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta
    name="twitter:image"
    content="https://guesant.net/images/og-image.png"
  />
  <meta name="twitter:image:alt" content={title} />
  {#each languageRoutes as option}
    <link
      rel="alternate"
      hreflang={option.hreflang}
      href={`https://guesant.net${languageURL(option)}`}
    />
  {/each}
  <link
    rel="alternate"
    hreflang="x-default"
    href={`https://guesant.net${defaultLanguageURL}`}
  />
  {@html structuredDataMarkup}
</svelte:head>

{#if terminal}
  <TerminalPage {data} />
{:else}
  <MinecraftPage {data} />
{/if}

<dialog
  class="app-dialog settings-dialog"
  id="settings-dialog"
  aria-labelledby="settings-dialog-title"
>
  <div class="app-dialog-content settings-content">
    <header class="app-dialog-header">
      <h2 id="settings-dialog-title">
        <IconButton name="gear" />
        <span>{localized.ui.settings_label}</span>
      </h2>
      <form method="dialog">
        <button
          class="dialog-close"
          type="submit"
          data-dialog-close
          aria-label={localized.ui.settings_close}
        >
          <IconButton name="xmark" />
        </button>
      </form>
    </header>
    <div class="site-controls">
      <div class="toggle-control interface-control">
        <span class="toggle-label" id="interface-label">
          {editorialUI.interface}
        </span>
        <div
          class="toggle-group"
          role="radiogroup"
          aria-labelledby="interface-label"
        >
          <input
            class="toggle-input"
            type="radio"
            name="interface"
            id="interface-minecraft"
            value="minecraft"
            data-interface-option
            data-interface-url={data.standardPageURL}
            checked={!terminal}
          />
          <label class="toggle-button" for="interface-minecraft">
            Minecraft
          </label>
          <input
            class="toggle-input"
            type="radio"
            name="interface"
            id="interface-terminal"
            value="terminal"
            data-interface-option
            data-interface-url={data.terminalPageURL}
            checked={terminal}
          />
          <label class="toggle-button" for="interface-terminal">Terminal</label>
        </div>
      </div>
      <div class="toggle-control language-control">
        <span class="toggle-label" id="language-label">
          <IconButton name="language" />
          <span>{localized.ui.language_aria_label}</span>
        </span>
        <div class="language-select-wrap">
          <select
            class="language-select"
            aria-labelledby="language-label"
            data-language-switcher
          >
            {#each languageRoutes as option}<option
                value={languageURL(option)}
                data-language={option.id}
                selected={option.id === locale}
              >
                {option.label}
              </option>{/each}
          </select>
          <span class="language-select-icon">
            <IconButton name="chevron-right" />
          </span>
        </div>
      </div>
      <div class="toggle-control">
        <span class="toggle-label" id="theme-label">
          {localized.ui.theme_label}
        </span>
        <div
          class="toggle-group"
          role="radiogroup"
          aria-labelledby="theme-label"
        >
          {#each ['system', 'dark', 'light'] as theme}<input
              class="toggle-input"
              type="radio"
              name="theme"
              id="theme-{theme}"
              value={theme}
              data-theme-option
              checked={theme === config.theme.appearance}
            />
            <label class="toggle-button" for="theme-{theme}">
              {themeLabel(theme)}
            </label>{/each}
        </div>
      </div>
      <div class="toggle-control motion-control">
        <span class="toggle-label" id="motion-label">
          {localized.ui.animations_label}
        </span>
        <div
          class="toggle-group toggle-group-motion"
          role="radiogroup"
          aria-labelledby="motion-label"
        >
          <input
            class="toggle-input"
            type="radio"
            name="motion"
            id="motion-on"
            value="on"
            data-motion-option
            checked={config.theme.animations_enabled !== false}
          />
          <label class="toggle-button" for="motion-on">
            {localized.ui.animations_enabled}
          </label>
          <input
            class="toggle-input"
            type="radio"
            name="motion"
            id="motion-off"
            value="off"
            data-motion-option
            checked={config.theme.animations_enabled === false}
          />
          <label class="toggle-button" for="motion-off">
            {localized.ui.animations_disabled}
          </label>
        </div>
      </div>
    </div>
  </div>
</dialog>

{#key `${locale}:${terminal}`}
  <dialog
    class="app-dialog search-dialog"
    id="search-dialog"
    aria-labelledby="search-title"
    data-search-index={`/search/${locale}-${data.interfaceName}.json`}
    data-search-empty={editorialUI.search_empty}
    data-search-start={editorialUI.search_start}
    data-search-loading={editorialUI.search_loading}
    data-search-source={editorialUI.source}
    data-search-language={editorialUI.language}
    data-search-unavailable={editorialUI.search_unavailable}
    data-search-partial={editorialUI.list_partial}
  >
    <div class="app-dialog-content">
      <header class="app-dialog-header">
        <h2 id="search-title">{editorialUI.search}</h2>
        <form method="dialog">
          <button
            type="submit"
            class="dialog-close"
            aria-label={localized.ui.settings_close}
          >
            <IconButton name="xmark" />
          </button>
        </form>
      </header>
      <label for="search-query" class="visually-hidden">
        {editorialUI.search}
      </label>
      <input
        id="search-query"
        type="search"
        placeholder={editorialUI.search_placeholder}
        autocomplete="off"
      />
      <p id="search-status" role="status" aria-live="polite">
        {editorialUI.search_start}
      </p>
      <button
        type="button"
        class="ui-button search-retry"
        data-search-retry
        hidden
      >
        {editorialUI.search_retry}
      </button>
      <div id="search-results"></div>
    </div>
  </dialog>
{/key}

<dialog
  class="app-dialog credits-dialog"
  id="credits-dialog"
  data-credits-dialog
  aria-labelledby="credits-dialog-title"
  aria-describedby="credits-dialog-description"
>
  <div class="app-dialog-content credits-dialog-content">
    <header class="app-dialog-header credits-dialog-header">
      <div class="credits-dialog-heading">
        <h2 id="credits-dialog-title">{localized.ui.credits_dialog_title}</h2>
        <p id="credits-dialog-description">
          {localized.ui.credits_dialog_description}
        </p>
      </div>
      <form method="dialog">
        <button
          class="dialog-close"
          type="submit"
          data-dialog-close
          aria-label={localized.ui.credits_close}
        >
          <IconButton name="xmark" />
        </button>
      </form>
    </header>
    <div class="credits-list">
      {#each credits as credit}<section
          class="credit-entry"
          aria-labelledby="credit-{credit.id}-title"
        >
          <h3 id="credit-{credit.id}-title">{credit.name}</h3>
          <dl class="credit-entry-meta">
            <div>
              <dt>{localized.ui.credits_authors}</dt>
              <dd>{credit.authors}</dd>
            </div>
            <div>
              <dt>{localized.ui.credits_license}</dt>
              <dd>
                <a
                  class="credit-license-link"
                  href={data.credits.licenses[credit.license]?.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.credits.licenses[credit.license]?.name ||
                    credit.license}
                </a>
              </dd>
            </div>
          </dl>
          <details class="credit-license">
            <summary>{localized.ui.credits_license_text}</summary>
            <pre>{data.credits.licenses[credit.license]?.text || ''}</pre>
          </details>
          <a
            class="credit-official-link"
            href={credit.official_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {localized.ui.credits_official_url}
          </a>
        </section>{/each}
    </div>
  </div>
</dialog>

<dialog
  id="bios-dialog"
  class="bios-dialog"
  aria-labelledby="bios-title"
  aria-describedby="bios-status"
>
  <div class="bios-screen">
    <header class="bios-header">
      <h2 id="bios-title">
        GuesantBIOS v5.0
        <br />
        Interface initialization monitor
      </h2>
      <span class="bios-status-badge">STARTUP CHECK</span>
    </header>
    <div class="bios-post" aria-hidden="true">
      <p class="bios-post-line" data-bios-step="1" hidden>
        Runtime loader : Ready
      </p>
      <p class="bios-post-line" data-bios-step="4" hidden>
        Configuration : Loaded
      </p>
      <p class="bios-post-line bios-post-muted" data-bios-step="8" hidden>
        Checking interface modules ...
      </p>
      {#each ['Navigation', 'Content index', 'User preferences', 'Display controls'] as item, index}<p
          class="bios-post-line bios-post-drive"
          data-bios-step={11 + index * 2}
          hidden
        >
          Module 0{index} : {item}
        </p>{/each}
      <p class="bios-boot-line" data-bios-boot-line hidden>
        Starting interface: <span data-bios-interface></span>
        <span data-bios-progress></span>
        <span class="bios-cursor"></span>
      </p>
    </div>
    <p class="visually-hidden" id="bios-status" role="status">
      {editorialUI.bios_status}
    </p>
    <footer class="bios-footer">
      <button type="button" data-bios-skip>
        {editorialUI.bios_skip} · Esc
      </button>
      <span>Automatic startup sequence</span>
    </footer>
    <p class="bios-build-stamp">LOBBY-BOOT-5.0</p>
  </div>
</dialog>
