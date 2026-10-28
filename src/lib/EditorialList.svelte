<script>
  import Icon from './Icon.svelte';

  let {
    items,
    ui,
    sectionID,
    locale,
    interfaceName,
    pageURL,
    empty = false,
  } = $props();
  const kinds = {
    career: ['skill', 'experience', 'education'],
    code: ['project', 'case'],
    writing: ['post', 'case'],
    interests: ['interests'],
    uses: ['uses'],
    library: ['library'],
    curiosities: ['curiosities'],
  };
  const groups = $derived(
    (kinds[sectionID] || [...new Set(items.map((item) => item.type))])
      .map((type) => ({
        type,
        items: items.filter((item) => item.type === type),
      }))
      .filter((group) => group.items.length),
  );
  const missing = $derived(
    (kinds[sectionID] || []).filter(
      (type) => !items.some((item) => item.type === type),
    ),
  );
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
                  <span class="editorial-entry-icon" aria-hidden="true"
                    ><Icon name="code" /></span
                  >
                {/if}
                <h3>
                  {#if item.url}<a href={item.url}>{item.title}</a
                    >{:else}{item.title}{/if}
                </h3>
                {#if interfaceName === 'minecraft' && item.type === 'project' && item.url}<span
                    class="editorial-entry-indicator external-link-icon"
                    aria-hidden="true"><Icon name="external-link" /></span
                  >{/if}
                {#if interfaceName === 'terminal'}<span class="editorial-origin"
                    >{item.source}{#if item.language !== locale}
                      · {ui.language}: {item.language}{/if}</span
                  >{:else if item.language !== locale}<span
                    class="editorial-origin"
                    >{ui.language}: {item.language}</span
                  >{/if}
              </header>
              {#if item.summary}<p class="editorial-description">
                  {item.summary}
                </p>{/if}
              {#if item.details_url}<a
                  class="editorial-details"
                  href={item.details_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  ><span>{item.details_label}</span><span
                    class="link-third-party-badge">{ui.third_party}</span
                  ><span class="external-link-icon" aria-hidden="true"
                    ><Icon name="external-link" /></span
                  ></a
                >{/if}
              {#if item.tags?.length}<ul class="editorial-tags">
                  {#each item.tags as tag}<li>{tag}</li>{/each}
                </ul>{/if}
              {#if Object.values(item.metadata || {}).some(Boolean)}
                <dl class="editorial-metadata">
                  {#each Object.entries(item.metadata || {}).filter(([key, value]) => value && key !== 'content_url' && !(item.type === 'experience' && key === 'position')) as [key, value]}
                    <div>
                      <dt>{ui[key] || key}</dt>
                      <dd>{Array.isArray(value) ? value.join(', ') : value}</dd>
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
