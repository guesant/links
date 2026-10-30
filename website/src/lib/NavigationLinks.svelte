<script lang="ts">
  import { currentPage, emptyAttribute } from './render-utils.ts';
  import type { PageRecord } from './site-data.ts';

  let {
    pages,
    currentID,
    placement,
  }: {
    pages: PageRecord[];
    currentID: string;
    placement: 'header' | 'footer';
  } = $props();
</script>

<ul class="navigation-links {placement}-navigation-links">
  {#each pages as entry}
    <li>
      <a
        data-navigation-page={entry.id}
        data-now-shortcut={emptyAttribute(entry.id === 'now')}
        href={entry.url}
        aria-current={currentPage(entry.id === currentID)}
      >
        {entry.title}
      </a>
    </li>
  {/each}
</ul>
