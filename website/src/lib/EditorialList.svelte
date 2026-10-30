<script lang="ts">
  import ActionRow from './ActionRow.svelte';
  import ContentListHeading from './ContentListHeading.svelte';
  import EditorialEntry from './EditorialEntry.svelte';
  import {
    itemHeadingLevel,
    type EmptyAction,
    type ListingDestination,
  } from './listing-presentation.ts';
  import { editorialKinds, type EditorialRecord } from './site-data.ts';

  let {
    items,
    ui,
    thirdPartyLabel,
    sectionID,
    locale,
    interfaceName,
    destination,
    emptyAction,
    headingLevel = 3,
    empty = false,
  }: {
    items: EditorialRecord[];
    ui: Record<string, string>;
    thirdPartyLabel: string;
    sectionID: string;
    locale: string;
    interfaceName: 'minecraft' | 'terminal';
    destination: ListingDestination;
    emptyAction?: EmptyAction | undefined;
    headingLevel?: 2 | 3 | 4;
    empty?: boolean;
  } = $props();

  const kinds = $derived(
    editorialKinds[sectionID] || [
      ...new Set(
        items.map((item) => {
          return item.type;
        }),
      ),
    ],
  );

  const groups = $derived(
    kinds
      .map((type) => {
        return {
          type,
          items: items.filter((item) => {
            return item.type === type;
          }),
        };
      })
      .filter((group) => {
        return group.items.length;
      }),
  );

  const missing = $derived(
    kinds.filter((type) => {
      return !items.some((item) => {
        return item.type === type;
      });
    }),
  );

  const fallback = $derived.by(() => {
    if (emptyAction) {
      return destination({
        url: emptyAction.href,
      });
    }

    return undefined;
  });
</script>

{#if items.length}
  <div class="editorial-list" data-editorial-section={sectionID}>
    {#each groups as group}
      <section class="editorial-group" data-editorial-kind={group.type}>
        <ContentListHeading
          label={ui[group.type] || ui[sectionID]}
          level={headingLevel}
        />
        <div class="editorial-group-items divided-list">
          {#each group.items as item}<EditorialEntry
              {item}
              {ui}
              {thirdPartyLabel}
              {locale}
              {interfaceName}
              {sectionID}
              {destination}
              headingLevel={itemHeadingLevel(headingLevel)}
            />{/each}
        </div>
      </section>
    {/each}
  </div>
{/if}

{#if missing.length || (empty && !items.length)}
  <div class="editorial-empty-state" data-editorial-empty={sectionID}>
    {#if missing.length}{#each missing as type}<p
          class="editorial-empty"
          data-empty-kind={type}
        >
          {ui[`empty_${type}`] || ui.empty}
        </p>{/each}{:else}<p class="editorial-empty">{ui.empty}</p>{/if}
    {#if fallback && emptyAction}<ActionRow
        title={emptyAction.label}
        action={fallback}
        {thirdPartyLabel}
        {interfaceName}
        className="editorial-related"
      />{/if}
  </div>
{/if}
