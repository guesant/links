<script lang="ts">
  import IconButton from './IconButton.svelte';
  import SectionMenuItem from './SectionMenuItem.svelte';
  import { currentPage } from './render-utils.ts';
  import type { PageRecord } from './site-data.ts';

  let {
    pages,
    currentID,
    homeURL,
    homeLabel,
    homeIcon,
    label,
    sectionsLabel,
  }: {
    pages: PageRecord[];
    currentID: string;
    homeURL: string;
    homeLabel: string;
    homeIcon: string;
    label: string;
    sectionsLabel: string;
  } = $props();

  let sections = $derived(
    pages.filter((entry) => {
      return entry.type === 'home' || entry.type === 'links-page';
    }),
  );

  let updates = $derived(
    pages.filter((entry) => {
      return entry.id === 'now';
    }),
  );
</script>

<nav class="page-navigation" aria-label={label}>
  <a
    class="navigation-home"
    href={homeURL}
    aria-current={currentPage(currentID === 'home')}
  >
    <IconButton name={homeIcon} />
    <span class="navigation-home-title">{homeLabel}</span>
  </a>
  <span
    class="quick-navigation-divider quick-navigation-divider-start"
    aria-hidden="true"
  ></span>
  <details class="section-switcher" data-section-switcher>
    <summary
      class="section-switcher-trigger"
      aria-controls="section-menu"
      aria-label={sectionsLabel}
    >
      <IconButton name="map" />
      <span class="section-switcher-title">{sectionsLabel}</span>
      <span class="navigation-chevron">
        <IconButton name="chevron-right" />
      </span>
    </summary>
    <nav class="section-menu" id="section-menu" aria-label={sectionsLabel}>
      <ul class="section-menu-list">
        {#each sections as entry}
          <li>
            <SectionMenuItem {entry} active={entry.id === currentID} />
          </li>
        {/each}
      </ul>
      <div class="section-menu-updates">
        {#each updates as entry}
          <SectionMenuItem
            {entry}
            active={entry.id === currentID}
            nowShortcut
          />
        {/each}
      </div>
    </nav>
  </details>
</nav>
