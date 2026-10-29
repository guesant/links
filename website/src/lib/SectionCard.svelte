<script lang="ts">
  import Icon from './Icon.svelte';
  import LinkList from './LinkList.svelte';
  import EditorialList from './EditorialList.svelte';
  import { enabledAttribute } from './render-utils.ts';
  import type {
    DisplayLinkRecord,
    EditorialRecord,
    LinkDestination,
    PageRecord,
  } from './site-data.ts';

  let {
    page,
    items,
    editorial,
    editorialUI,
    thirdPartyLabel,
    locale,
    destination,
    index = 0,
    update = false,
  }: {
    page: PageRecord;
    items: DisplayLinkRecord[];
    editorial: EditorialRecord[];
    editorialUI: Record<string, string>;
    thirdPartyLabel: string;
    locale: string;
    destination: (_item: DisplayLinkRecord) => LinkDestination;
    index?: number;
    update?: boolean;
  } = $props();
</script>

<article
  class="category-card"
  data-category={page.id}
  data-ornament={index % 3}
  data-rail-anchor={enabledAttribute(
    update || ['writing', 'games'].includes(page.id),
  )}
  aria-labelledby="category-{page.id}-title"
>
  <div class="category-summary">
    <div class="category-heading">
      <span class="category-icon" aria-hidden="true">
        <Icon name={page.icon || 'link'} optical />
      </span>
      <h2 class="category-title" id="category-{page.id}-title">{page.title}</h2>
    </div>
    {#if page.description}<div class="category-copy">
        <p class="category-description">{page.description}</p>
      </div>{/if}
  </div>
  <div class="category-links">
    {#if items.length}<LinkList
        {items}
        ui={editorialUI}
        {thirdPartyLabel}
        {destination}
        preview
      />{/if}
    {#if !update}<EditorialList
        items={editorial}
        ui={editorialUI}
        {thirdPartyLabel}
        sectionID={page.id}
        {locale}
        interfaceName="minecraft"
        pageURL={page.url}
        empty={!items.length}
      />{/if}
  </div>
</article>
