<script lang="ts">
  import ActionRow from './ActionRow.svelte';
  import type { EditorialRecord, LinkDestination } from './site-data.ts';
  import type { ListingDestination } from './listing-presentation.ts';

  let {
    item,
    ui,
    thirdPartyLabel,
    locale,
    interfaceName,
    sectionID,
    destination,
    headingLevel,
  }: {
    item: EditorialRecord;
    ui: Record<string, string>;
    thirdPartyLabel: string;
    locale: string;
    interfaceName: 'minecraft' | 'terminal';
    sectionID: string;
    destination: ListingDestination;
    headingLevel: 3 | 4 | 5;
  } = $props();

  const primary = $derived.by((): LinkDestination | undefined => {
    if (item.url) {
      return destination({
        url: item.url,
      });
    }

    return undefined;
  });

  const secondary = $derived.by((): LinkDestination | undefined => {
    if (item.details_url) {
      return destination({
        url: item.details_url,
      });
    }

    return undefined;
  });

  const icon = $derived.by((): string | undefined => {
    if (item.type === 'project') {
      return 'code';
    }

    return undefined;
  });

  const metadata = $derived(
    Object.entries(item.metadata).filter(
      ([
        key,
        value,
      ]) => {
        return (
          value &&
          key !== 'content_url' &&
          !(item.type === 'experience' && key === 'position') &&
          !(item.type === 'education' && key === 'degree')
        );
      },
    ),
  );

  function metadataValue(value: EditorialRecord['metadata'][string]): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value;
  }
</script>

<article
  class="editorial-entry"
  data-editorial-type={item.type}
  data-editorial-id={item.id}
  id="page-{sectionID}-{item.id}"
  lang={item.language}
>
  <header class="editorial-entry-heading">
    <svelte:element this={`h${headingLevel}`}>
      {#if primary}<ActionRow
          title={item.title}
          action={primary}
          {thirdPartyLabel}
          {interfaceName}
          {icon}
          className="editorial-primary"
        />{:else}<span class="editorial-information">{item.title}</span>{/if}
    </svelte:element>
    {#if interfaceName === 'terminal'}<span class="editorial-origin">
        {item.source}{#if item.language !== locale}
          · {ui.language}: {item.language}{/if}
      </span>{:else if item.language !== locale}<span class="editorial-origin">
        {ui.language}: {item.language}
      </span>{/if}
  </header>
  {#if item.summary}<p class="editorial-description">{item.summary}</p>{/if}
  {#if secondary && item.details_label}<ActionRow
      title={item.details_label}
      action={secondary}
      {thirdPartyLabel}
      {interfaceName}
      className="editorial-details"
    />{/if}
  {#if item.tags.length}<ul class="editorial-tags">
      {#each item.tags as tag}<li>{tag}</li>{/each}
    </ul>{/if}
  {#if metadata.length}<dl class="editorial-metadata">
      {#each metadata as [key, value]}<div>
          <dt>{ui[key] || key}</dt>
          <dd>{metadataValue(value)}</dd>
        </div>{/each}
    </dl>{/if}
</article>
