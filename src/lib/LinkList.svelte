<script>
  import LinkCard from './LinkCard.svelte';

  let { items, ui, destination, preview = false } = $props();
</script>

{#if items.length}
  <section class="content-link-group">
    <header class="content-list-heading"><h4>{ui.links}</h4></header>
    <ul class:category-preview={preview} class="link-list">
      {#each items as item}
        <li class="link-row">
          <LinkCard
            {item}
            thirdPartyLabel={ui.third_party}
            {destination}
            {preview}
          />
        </li>
      {/each}
    </ul>
  </section>
{/if}
