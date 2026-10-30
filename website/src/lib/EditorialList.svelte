<script lang="ts">
  import Icon from './Icon.svelte';
  import { linkNavigation } from './link-navigation.ts';
  import { editorialKinds, type EditorialRecord } from './site-data.ts';

  let {
    items,
    ui,
    thirdPartyLabel,
    sectionID,
    locale,
    interfaceName,
    pageURL,
    empty = false,
  }: {
    items: EditorialRecord[];
    ui: Record<string, string>;
    thirdPartyLabel: string;
    sectionID: string;
    locale: string;
    interfaceName: string;
    pageURL: string;
    empty?: boolean;
  } = $props();

  const groups = $derived(
    (
      editorialKinds[sectionID] || [
        ...new Set(
          items.map((item) => {
            return item.type;
          }),
        ),
      ]
    )
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
    (editorialKinds[sectionID] || []).filter((type) => {
      return !items.some((item) => {
        return item.type === type;
      });
    }),
  );

  function metadataValue(
    value: EditorialRecord['metadata'][string],
  ): string | number | boolean {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value;
  }
</script>

{#if items.length}
  <div class="editorial-list" data-editorial-section={sectionID}>
    {#each groups as group}
      <section class="editorial-group" data-editorial-kind={group.type}>
        <header class="content-list-heading">
          <h4>{ui[group.type] || ui[sectionID]}</h4>
        </header>
        <div class="editorial-group-items">
          {#each group.items as item}
            <article
              class="editorial-entry"
              data-editorial-type={item.type}
              data-editorial-id={item.id}
              id="page-{sectionID}-{item.id}"
              lang={item.language}
            >
              <header class="editorial-entry-heading">
                {#if interfaceName === 'minecraft' && item.type === 'project'}
                  <span class="editorial-entry-icon" aria-hidden="true">
                    <Icon name="code" optical />
                  </span>
                {/if}
                <h3>
                  {#if item.url}<a
                      href={item.url}
                      target={linkNavigation(item.url).target}
                      rel={linkNavigation(item.url).rel}
                    >
                      {item.title}
                    </a>{:else}{item.title}{/if}
                </h3>
                {#if item.url && linkNavigation(item.url).external}<span
                    class="editorial-entry-indicator external-link-icon"
                    aria-hidden="true"
                  >
                    {#if interfaceName === 'terminal'}↗{:else}<Icon
                        name="external-link"
                      />{/if}
                  </span>{/if}
                {#if interfaceName === 'terminal'}<span
                    class="editorial-origin"
                  >
                    {item.source}{#if item.language !== locale}
                      · {ui.language}: {item.language}{/if}
                  </span>{:else if item.language !== locale}<span
                    class="editorial-origin"
                  >
                    {ui.language}: {item.language}
                  </span>{/if}
              </header>
              {#if item.summary}<p class="editorial-description">
                  {item.summary}
                </p>{/if}
              {#if item.details_url}<a
                  class="editorial-details"
                  href={item.details_url}
                  target={linkNavigation(item.details_url).target}
                  rel={linkNavigation(item.details_url).rel}
                >
                  <span>{item.details_label}</span>
                  <span class="link-third-party-badge">{thirdPartyLabel}</span>
                  {#if linkNavigation(item.details_url).external}<span
                      class="external-link-icon"
                      aria-hidden="true"
                    >
                      {#if interfaceName === 'terminal'}↗{:else}<Icon
                          name="external-link"
                        />{/if}
                    </span>{/if}
                </a>{/if}
              {#if item.tags?.length}<ul class="editorial-tags">
                  {#each item.tags as tag}<li>{tag}</li>{/each}
                </ul>{/if}
              {#if Object.values(item.metadata || {}).some(Boolean)}
                <dl class="editorial-metadata">
                  {#each Object.entries(item.metadata || {}).filter( ([key, value]) => {
                      return value && key !== 'content_url' && !(item.type === 'experience' && key === 'position') && !(item.type === 'education' && key === 'degree');
                    } ) as [key, value]}
                    <div>
                      <dt>{ui[key] || key}</dt>
                      <dd>{metadataValue(value)}</dd>
                    </div>
                  {/each}
                </dl>
              {/if}
            </article>
          {/each}
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
    <a class="editorial-related" href={pageURL}>{ui.related}</a>
  </div>
{/if}
