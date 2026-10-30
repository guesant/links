<script lang="ts">
  import LinkCard from './LinkCard.svelte';
  import ContentListHeading from './ContentListHeading.svelte';
  import type { DisplayLinkRecord } from './site-data.ts';
  import type { ListingDestination } from './listing-presentation.ts';

  let {
    items,
    ui,
    thirdPartyLabel,
    destination,
    preview = false,
    sectionID,
    headingLevel = 3,
  }: {
    items: DisplayLinkRecord[];
    ui: Record<string, string>;
    thirdPartyLabel: string;
    destination: ListingDestination;
    preview?: boolean;
    sectionID: string;
    headingLevel?: 2 | 3 | 4;
  } = $props();
</script>

{#if items.length}
  <section class="content-link-group" id="links-{sectionID}">
    <ContentListHeading label={ui.links} level={headingLevel} />
    <ul class:category-preview={preview} class="link-list divided-list">
      {#each items as item}
        <li class="link-row">
          <LinkCard {item} {thirdPartyLabel} {destination} {preview} />
        </li>
      {/each}
    </ul>
  </section>
{/if}
