<script lang="ts">
  import LinkCard from './LinkCard.svelte';
  import type { DisplayLinkRecord, LinkDestination } from './site-data.ts';

  let {
    items,
    ui,
    thirdPartyLabel,
    destination,
    preview = false,
  }: {
    items: DisplayLinkRecord[];
    ui: Record<string, string>;
    thirdPartyLabel: string;
    destination: (_item: DisplayLinkRecord) => LinkDestination;
    preview?: boolean;
  } = $props();
</script>

{#if items.length}
  <section class="content-link-group">
    <header class="content-list-heading"><h4>{ui.links}</h4></header>
    <ul class:category-preview={preview} class="link-list">
      {#each items as item}
        <li class="link-row">
          <LinkCard {item} {thirdPartyLabel} {destination} {preview} />
        </li>
      {/each}
    </ul>
  </section>
{/if}
