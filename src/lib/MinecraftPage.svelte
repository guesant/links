<script>
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import LinkView from './LinkView.svelte';
  import LinkList from './LinkList.svelte';
  import EditorialList from './EditorialList.svelte';
  import SectionCard from './SectionCard.svelte';
  import { destinationFor } from './render-utils.js';

  let { data } = $props();
  let {
    config,
    editorialData,
    editorialUI,
    localized,
    build,
    locale,
    page,
    pages,
    homeSections,
    quickLinks,
    links,
    editorial,
    now,
  } = $derived(data);
  let language = $derived(
    config.language_options.find((entry) => entry.id === locale),
  );
  let home = $derived(page.id === 'home');
  let profile = $derived({
    ...config.profile,
    bio: localized.profile.bio,
    birthDate: config.profile.birth_date,
  });
  let homeURL = $derived(
    pages.find((entry) => entry.id === 'home')?.url || language.path,
  );
  let footerNav = $derived(
    pages.filter(
      (entry) =>
        entry.type === 'home' ||
        entry.type === 'links-page' ||
        entry.id === 'now',
    ),
  );
  const iconURL = '/assets/generated/rail-terminal.png';
  const lanternURL = '/assets/generated/rail-lantern.png';

  function destination(item) {
    return destinationFor(config, item, locale, 'minecraft');
  }

  function nowSectionLinks(entry) {
    return now.sections.map((section) => ({
      id: `now-${section.id}`,
      title: section.title,
      url: `${entry.url}#now-${section.id}`,
      icon: 'clock',
    }));
  }
</script>

<a class="skip-link" href="#main-content">{localized.ui.skip_link}</a>
<div class="world-scene" aria-hidden="true">
  <div class="world-landscape"></div>
  <div class="world-clouds"></div>
  <div class="world-dim"></div>
</div>
<div class="site-frame">
  <div class="site-shell">
    <header class="profile">
      <span class="frame-ornament frame-ornament-start" aria-hidden="true"
      ></span><span class="frame-ornament frame-ornament-end" aria-hidden="true"
      ></span>
      <div class="profile-copy">
        <div class="profile-avatar" aria-hidden="true">
          {profile.name
            .split(' ')
            .map((part) => part[0])
            .join('')}
        </div>
        {#if home}<h1 class="profile-name">{profile.name}</h1>{:else}<p
            class="profile-name"
          >
            {profile.name}
          </p>{/if}
        <p class="profile-username">@{profile.username}</p>
        <p class="profile-bio">{profile.bio}</p>
        <p class="profile-uptime">
          <span class="profile-uptime-label">{localized.ui.uptime_label}</span
          ><time
            datetime={profile.birthDate}
            data-uptime={profile.birthDate}
            data-uptime-locale={locale}>{profile.birthDate}</time
          >
        </p>
      </div>
    </header>
    <div class="suspended-content">
      <span class="suspension-rail suspension-rail-start" aria-hidden="true"
        ><img
          class="suspension-terminal suspension-terminal-upper"
          src={iconURL}
          width="192"
          height="174"
          alt=""
        /><span class="suspension-body"
          ><span class="suspension-chain suspension-chain-upper"></span><span
            class="suspension-chain suspension-chain-lower"
          ></span>{#if home}<img
              class="suspension-lantern suspension-lantern-upper"
              src={lanternURL}
              width="192"
              height="340"
              alt=""
            /><img
              class="suspension-lantern suspension-lantern-middle"
              src={lanternURL}
              width="192"
              height="340"
              alt=""
            /><img
              class="suspension-lantern suspension-lantern-lower"
              src={lanternURL}
              width="192"
              height="340"
              alt=""
            />{/if}</span
        ><img
          class="suspension-terminal suspension-terminal-lower"
          src={iconURL}
          width="192"
          height="174"
          alt=""
        /></span
      >
      <span class="suspension-rail suspension-rail-end" aria-hidden="true"
        ><img
          class="suspension-terminal suspension-terminal-upper"
          src={iconURL}
          width="192"
          height="174"
          alt=""
        /><span class="suspension-body"
          ><span class="suspension-chain suspension-chain-upper"></span><span
            class="suspension-chain suspension-chain-lower"
          ></span>{#if home}<img
              class="suspension-lantern suspension-lantern-upper"
              src={lanternURL}
              width="192"
              height="340"
              alt=""
            /><img
              class="suspension-lantern suspension-lantern-middle"
              src={lanternURL}
              width="192"
              height="340"
              alt=""
            /><img
              class="suspension-lantern suspension-lantern-lower"
              src={lanternURL}
              width="192"
              height="340"
              alt=""
            />{/if}</span
        ><img
          class="suspension-terminal suspension-terminal-lower"
          src={iconURL}
          width="192"
          height="174"
          alt=""
        /></span
      >
      <div class="quick-access">
        <header class="section-toolbar">
          <h2 class="section-toolbar-title" id="quick-access-title">
            {localized.ui.quick_access_title}
          </h2>
        </header>
        <nav class="page-navigation" aria-labelledby="quick-access-title">
          <a
            class="navigation-home"
            href={homeURL}
            aria-current={home ? 'page' : undefined}
            ><IconButton name={config.navigation.home.icon} /><span
              class="navigation-home-title"
              >{config.navigation.home.labels[locale]}</span
            ></a
          ><span
            class="quick-navigation-divider quick-navigation-divider-start"
            aria-hidden="true"
          ></span>
          <div
            class="quick-contacts"
            role="group"
            aria-label={localized.ui.quick_contacts_label}
          >
            {#each quickLinks as item}<a
                class="quick-contact-link"
                href={destination(item).href}
                target={destination(item).target}
                rel={destination(item).rel}
                title={item.title}
                aria-label={item.title}
                ><span class="quick-contact-icon"
                  ><Icon name={item.icon} /></span
                ><span class="quick-contact-label">{item.title}</span></a
              >{/each}
          </div>
          <span
            class="quick-navigation-divider quick-navigation-divider-end"
            aria-hidden="true"
          ></span>
          <details class="section-switcher" data-section-switcher>
            <summary
              class="section-switcher-trigger"
              aria-controls="section-menu"
              aria-label={localized.ui.navigation_sections}
              ><IconButton name="map" /><span class="section-switcher-title"
                >{localized.ui.navigation_sections}</span
              ><span class="navigation-chevron"
                ><IconButton name="chevron-right" /></span
              ></summary
            >
            <nav
              class="section-menu"
              id="section-menu"
              aria-label={localized.ui.navigation_sections}
            >
              <ul class="section-menu-list">
                {#each pages.filter((entry) => entry.type === 'home' || entry.type === 'links-page') as entry}<li
                  >
                    <a
                      class="section-menu-link"
                      data-navigation-page={entry.id}
                      href={entry.url}
                      aria-current={entry.id === page.id ? 'page' : undefined}
                      ><Icon name={entry.icon} /><span>{entry.title}</span
                      >{#if entry.id === page.id}<span class="navigation-check"
                          ><Icon name="check" /></span
                        >{/if}</a
                    >
                  </li>{/each}
              </ul>
              <div class="section-menu-updates">
                {#each pages.filter((entry) => entry.id === 'now') as entry}<a
                    class="section-menu-link"
                    data-now-shortcut
                    href={entry.url}
                    aria-current={entry.id === page.id ? 'page' : undefined}
                    ><Icon name={entry.icon} /><span>{entry.title}</span></a
                  >{/each}
              </div>
            </nav>
          </details>
        </nav>
      </div>
      <main class="page-content" id="main-content">
        {#if home}
          <section class="presentation-group">
            <header class="section-toolbar">
              <h2 class="section-toolbar-title" id="presentation-title">
                {localized.presentation.title}
              </h2>
            </header>
            <section
              class="presentation home-introduction"
              aria-labelledby="presentation-title"
            >
              <div class="about-context-grid">
                <ul class="about-facts">
                  {#each localized.presentation.facts as fact}<li
                      class="about-fact"
                    >
                      <span class="about-fact-icon"
                        ><Icon name={fact.icon} /></span
                      ><span>{fact.text}</span>
                    </li>{/each}
                </ul>
                <section class="about-site">
                  <h3 class="about-site-title">
                    <IconButton name="target" /><span
                      >{localized.presentation.site_title}</span
                    >
                  </h3>
                  <ul class="about-topics">
                    {#each localized.presentation.topics as topic}<li>
                        <span class="about-topic-check"
                          ><Icon name="check" /></span
                        ><span>{topic}</span>
                      </li>{/each}
                  </ul>
                </section>
              </div>
            </section>
          </section>
          <header class="section-toolbar">
            <h2 class="section-toolbar-title" id="home-categories-title">
              {localized.ui.home_sections_label}
            </h2>
          </header>
          <LinkView ui={localized.ui} pageKey="sections" />
          <section
            class="home-categories"
            id="home-categories"
            aria-labelledby="home-categories-title"
          >
            <div class="category-grid">
              {#each homeSections as section, index}<SectionCard
                  page={section.page}
                  items={section.links}
                  editorial={section.editorial}
                  {editorialUI}
                  {locale}
                  {destination}
                  {index}
                />{/each}
            </div>
          </section>
          {#each pages.filter((entry) => entry.id === 'now') as entry}<section
              class="home-updates"
              data-home-update="now"
            >
              <SectionCard
                page={entry}
                items={nowSectionLinks(entry)}
                editorial={[]}
                {editorialUI}
                {locale}
                {destination}
                update
              />
              <article class="now-activity">
                <dl>
                  {#each Object.entries(editorialData.now[locale] || {}).filter(([key]) => key !== 'updated') as [key, value]}<div
                      id="now-activity-{key}"
                    >
                      <dt>{editorialUI[key]}</dt>
                      <dd>{value}</dd>
                    </div>{/each}
                </dl>
              </article>
            </section>{/each}
        {:else if page.id === 'now'}
          <section class="presentation-group page-introduction">
            <header class="section-toolbar">
              <h1 class="section-toolbar-title" id="now-title">{now.title}</h1>
            </header>
            <div class="presentation page-introduction-content">
              <p class="presentation-intro">{now.intro}</p>
            </div>
          </section>
          <article class="presentation" aria-labelledby="now-title">
            <div class="presentation-focus">
              {#each now.sections as section}<section
                  class="presentation-focus-item"
                  id="now-{section.id}"
                >
                  <span class="presentation-focus-marker"></span>
                  <div class="presentation-focus-copy">
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                </section>{/each}
            </div>
            <dl class="now-activity">
              {#each Object.entries(editorialData.now[locale] || {}).filter(([key]) => key !== 'updated') as [key, value]}<div
                  id="now-activity-{key}"
                >
                  <dt>{editorialUI[key]}</dt>
                  <dd>{value}</dd>
                </div>{/each}
            </dl>
          </article>
        {:else}
          <section
            class="presentation-group page-introduction"
            aria-labelledby="page-title"
          >
            <header class="section-toolbar">
              <h1 class="section-toolbar-title" id="page-title">
                {page.title}
              </h1>
            </header>
            <div class="presentation page-introduction-content">
              <p class="presentation-intro">{page.description}</p>
            </div>
          </section>
          <section class="link-sections" aria-labelledby="page-title">
            <section class="link-section" id={page.id}>
              <LinkView ui={localized.ui} pageKey={page.id} /><LinkList
                items={links}
                ui={editorialUI}
                {destination}
              /><EditorialList
                items={editorial}
                ui={editorialUI}
                sectionID={page.id}
                {locale}
                interfaceName="minecraft"
                pageURL={page.url}
                empty={!links.length}
              />
            </section>
          </section>
        {/if}
      </main>
    </div>
    <footer class="site-footer">
      <span class="frame-ornament frame-ornament-start" aria-hidden="true"
      ></span><span class="frame-ornament frame-ornament-end" aria-hidden="true"
      ></span>
      <nav class="footer-navigation" aria-labelledby="footer-navigation-title">
        <h2 class="footer-navigation-title" id="footer-navigation-title">
          {localized.ui.navigation_label}
        </h2>
        <ul class="footer-navigation-links">
          {#each footerNav as entry}<li>
              <a
                data-navigation-page={entry.id}
                data-now-shortcut={entry.id === 'now' ? '' : undefined}
                href={entry.url}
                aria-current={entry.id === page.id ? 'page' : undefined}
                >{entry.title}</a
              >
            </li>{/each}
        </ul>
      </nav>
      <nav
        class="site-footer-content"
        aria-label={localized.ui.footer_aria_label}
      >
        <button
          class="site-footer-button icon-control"
          type="button"
          data-search-open
          aria-label={editorialUI.search}
          data-tooltip><IconButton name="target" /></button
        ><a
          class="site-footer-repository icon-control"
          href={`https://github.com/${config.site.repository}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={localized.ui.footer_repository}
          data-tooltip
          ><IconButton name="github" /><span
            class="control-tooltip"
            aria-hidden="true">{localized.ui.footer_repository}</span
          ></a
        ><button
          class="site-footer-link site-footer-button icon-control"
          type="button"
          aria-label={localized.ui.credits}
          data-tooltip
          data-dialog-open="credits-dialog"
          data-credits-open
          ><IconButton name="scale-balanced" /><span
            class="control-tooltip"
            aria-hidden="true">{localized.ui.credits}</span
          ></button
        ><button
          class="site-footer-link site-footer-button icon-control"
          type="button"
          aria-label={localized.ui.settings_label}
          data-tooltip
          data-dialog-open="settings-dialog"
          data-settings-open
          ><IconButton name="gear" /><span
            class="control-tooltip"
            aria-hidden="true">{localized.ui.settings_label}</span
          ></button
        ><a
          class="site-footer-link icon-control"
          data-reboot
          data-sveltekit-reload
          data-tooltip
          href={`${page.url}?lobby-boot=1`}
          aria-label={editorialUI.reboot}><IconButton name="desktop" /></a
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
            rel="noopener noreferrer"
            >{build.versionLabel} {build.commitLabel}</a
          >{/if}<span class="footer-meta-separator" aria-hidden="true">·</span
        ><a
          class="site-footer-build"
          href={build.workflowURL}
          target="_blank"
          rel="noopener noreferrer">{build.buildLabel}</a
        >
      </p>
      {#if localized.ui.translation_disclaimer}<p
          class="translation-disclaimer"
        >
          {localized.ui.translation_disclaimer}
        </p>{/if}
      <p class="brand-disclaimer">{localized.ui.brand_disclaimer}</p>
    </footer>
  </div>
</div>
