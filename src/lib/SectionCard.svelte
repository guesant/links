<script>
  import Icon from './Icon.svelte';
  import LinkList from './LinkList.svelte';
  import EditorialList from './EditorialList.svelte';

  let {
    page,
    items,
    editorial,
    editorialUI,
    locale,
    destination,
    index = 0,
    update = false,
  } = $props();
</script>

<article
  class="category-card"
  data-category={page.id}
  data-ornament={index % 3}
  aria-labelledby="category-{page.id}-title"
>
  <div class="category-summary">
    <div class="category-heading">
      <span class="category-icon" aria-hidden="true"
        ><Icon name={page.icon || 'link'} /></span
      >
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
        {destination}
        preview
      />{/if}
    {#if !update}<EditorialList
        items={editorial}
        ui={editorialUI}
        sectionID={page.id}
        {locale}
        interfaceName="minecraft"
        pageURL={page.url}
        empty={!items.length}
      />{/if}
  </div>
</article>
