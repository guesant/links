<script lang="ts">
  import IconButton from './IconButton.svelte';
  import { currentPage, enabledAttribute } from './render-utils.ts';
  import type { PageRecord } from './site-data.ts';

  let {
    entry,
    active,
    nowShortcut = false,
  }: { entry: PageRecord; active: boolean; nowShortcut?: boolean } = $props();

  const navigationPage = $derived.by(() => {
    if (nowShortcut) {
      return undefined;
    }

    return entry.id;
  });
</script>

<a
  class="section-menu-link"
  data-navigation-page={navigationPage}
  data-now-shortcut={enabledAttribute(nowShortcut)}
  href={entry.url}
  aria-current={currentPage(active)}
>
  <IconButton name={entry.icon || 'link'} optical />
  <span>{entry.title}</span>
  {#if active}
    <span class="navigation-check">
      <IconButton name="check" />
    </span>
  {/if}
</a>
