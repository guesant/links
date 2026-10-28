<script>
  import LinkView from './LinkView.svelte';
  import EditorialList from './EditorialList.svelte';
  import { destinationFor } from './render-utils.js';

  let { data } = $props();
  let {
    config,
    editorialUI,
    localized,
    build,
    locale,
    page,
    pages,
    homeSections,
    links,
    editorial,
    now,
  } = $derived(data);
  let home = $derived(page.id === 'home');

  function destination(item) {
    return destinationFor(config, item, locale, 'terminal');
  }
</script>

<a class="skip-link" href="#main-content">{localized.ui.skip_link}</a>
<div class="terminal-app">
  <header class="terminal-titlebar" aria-label={config.profile.name}>
    <span class="terminal-window-controls" aria-hidden="true"
      ><span class="terminal-window-dot terminal-window-dot-close"></span><span
        class="terminal-window-dot terminal-window-dot-minimize"
      ></span><span class="terminal-window-dot terminal-window-dot-maximize"
      ></span></span
    >
    <p class="terminal-window-label">
      <span>{config.profile.username}@guesant:</span>
      <span>{home ? '~' : `~/${page.id}`}</span>
    </p>
    <button
      class="terminal-window-search"
      type="button"
      data-search-open
      aria-label={editorialUI.search}
      ><span aria-hidden="true">$</span>
      {editorialUI.search} <kbd>Ctrl K</kbd></button
    ><button
      class="terminal-window-settings"
      type="button"
      data-dialog-open="settings-dialog"
      data-settings-open
      aria-label={localized.ui.settings_label}
      ><span aria-hidden="true">$</span> {localized.ui.settings_label}</button
    >
  </header>
  <nav class="terminal-navigation" aria-label={localized.ui.navigation_label}>
    <ul>
      {#each pages.filter((entry) => entry.type === 'home' || entry.type === 'links-page' || entry.id === 'now') as entry}<li
        >
          <a
            href={entry.url}
            aria-current={entry.id === page.id ? 'page' : undefined}
            ><span aria-hidden="true"
              >{entry.id === 'home' ? '~' : entry.id}</span
            ><span>{entry.title}</span></a
          >
        </li>{/each}
      <li>
        <a href={data.standardHomeURL}
          ><span aria-hidden="true">interface</span><span>Minecraft</span></a
        >
      </li>
    </ul>
  </nav>
  {#if home}<header class="terminal-profile">
      <p class="terminal-prompt">whoami</p>
      <h1>{config.profile.name}</h1>
      <p class="terminal-username">@{config.profile.username}</p>
      <p class="terminal-bio">{localized.profile.bio}</p>
      <p class="terminal-uptime">
        <span>{localized.ui.uptime_label}</span>
        <time
          datetime={config.profile.birth_date}
          data-uptime={config.profile.birth_date}
          data-uptime-locale={locale}>{config.profile.birth_date}</time
        >
      </p>
    </header>{/if}
  <main class="terminal-content" id="main-content">
    {#if home}
      <section class="terminal-about">
        <p class="terminal-prompt">cat about.txt</p>
        <h2>{localized.presentation.title}</h2>
        <div class="terminal-about-grid">
          <ul>
            {#each localized.presentation.facts as fact}<li>
                {fact.text}
              </li>{/each}
          </ul>
          <ul>
            {#each localized.presentation.topics as topic}<li>
                {topic}
              </li>{/each}
          </ul>
        </div>
      </section>
      <LinkView ui={localized.ui} pageKey="sections" terminal />
      <section class="terminal-directory">
        <header class="terminal-section-heading">
          <p class="terminal-prompt">ls -la ~/</p>
          <h2>{localized.ui.home_sections_label}</h2>
        </header>
        {#each homeSections as section}<section
            class="terminal-directory-entry"
            data-category={section.page.id}
          >
            <header>
              <h3><a href={section.page.url}>{section.page.title}</a></h3>
              {#if section.page.description}<p>
                  {section.page.description}
                </p>{/if}
            </header>
            <ul class="terminal-link-list">
              {#each section.links as item}<li>
                  <a href={destination(item).href} data-link-id={item.id}
                    ><span>{item.title}</span
                    >{#if destination(item).thirdParty}<span
                        class="terminal-third-party-badge"
                        >{localized.ui.third_party}</span
                      >{/if}<span aria-hidden="true">↗</span></a
                  >
                </li>{/each}
            </ul>
            <EditorialList
              items={section.editorial}
              ui={editorialUI}
              sectionID={section.page.id}
              {locale}
              interfaceName="terminal"
              pageURL={section.page.url}
              empty={!section.links.length}
            />
          </section>{/each}
      </section>
      {#each pages.filter((entry) => entry.id === 'now') as entry}<section
          class="terminal-directory-entry"
        >
          <header>
            <h3><a href={entry.url}>{entry.title}</a></h3>
            <p>{now.intro}</p>
          </header>
          <ul>
            {#each now.sections as section}<li>
                <a href={`${entry.url}#now-${section.id}`}>{section.title}</a>
              </li>{/each}
          </ul>
        </section>{/each}
    {:else if page.id === 'now'}
      <header class="terminal-section-heading">
        <p class="terminal-prompt">cat ~/now/status.txt</p>
        <h1>{now.title}</h1>
        <p>{now.intro}</p>
      </header>
      <div class="terminal-now-list">
        {#each now.sections as section}<section id="now-{section.id}">
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </section>{/each}
      </div>
      <dl class="now-activity">
        {#each Object.entries(data.editorialData.now[locale] || {}).filter(([key]) => key !== 'updated') as [key, value]}<div
            id="now-activity-{key}"
          >
            <dt>{editorialUI[key]}</dt>
            <dd>{value}</dd>
          </div>{/each}
      </dl>
    {:else}
      <header class="terminal-section-heading">
        <p class="terminal-prompt">cd ~/{page.id}/</p>
        <h1>{page.title}</h1>
        {#if page.description}<p>{page.description}</p>{/if}
      </header>
      <LinkView ui={localized.ui} pageKey={page.id} terminal />
      <ul class="terminal-link-list">
        {#each links as item}<li>
            <a
              data-link-id={item.id}
              href={destination(item).href}
              target={destination(item).target}
              rel={destination(item).rel}
              ><span>{item.title}</span>{#if destination(item).thirdParty}<span
                  class="terminal-third-party-badge"
                  >{localized.ui.third_party}</span
                >{/if}<span aria-hidden="true">↗</span></a
            >{#if item.description}<p>{item.description}</p>{/if}
          </li>{/each}
      </ul>
      <EditorialList
        items={editorial}
        ui={editorialUI}
        sectionID={page.id}
        {locale}
        interfaceName="terminal"
        pageURL={page.url}
        empty={!links.length}
      />
    {/if}
  </main>
  <footer class="terminal-footer">
    <nav
      class="terminal-footer-controls"
      aria-label={localized.ui.footer_aria_label}
    >
      <a
        href={`https://github.com/${config.site.repository}`}
        target="_blank"
        rel="noopener noreferrer">{localized.ui.footer_repository}</a
      ><button type="button" data-dialog-open="credits-dialog" data-credits-open
        >{localized.ui.credits}</button
      ><button
        type="button"
        data-dialog-open="settings-dialog"
        data-settings-open>{localized.ui.settings_label}</button
      ><a data-reboot data-sveltekit-reload href={`${page.url}?lobby-boot=1`}
        >{editorialUI.reboot}</a
      >
    </nav>
    <p class="site-footer-meta">
      {#if build.commitLabel === localized.ui.local_commit}<span
          class="site-footer-commit"
          >{build.versionLabel} {build.commitLabel}</span
        >{:else}<a
          class="site-footer-commit"
          href={build.commitURL}
          target="_blank"
          rel="noopener noreferrer">{build.versionLabel} {build.commitLabel}</a
        >{/if}<span class="footer-meta-separator" aria-hidden="true">·</span><a
        class="site-footer-build"
        href={build.workflowURL}
        target="_blank"
        rel="noopener noreferrer">{build.buildLabel}</a
      >
    </p>
    <p class="brand-disclaimer">{localized.ui.brand_disclaimer}</p>
  </footer>
</div>
