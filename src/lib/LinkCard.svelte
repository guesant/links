<script>
  import Icon from './Icon.svelte';

  let { item, thirdPartyLabel, preview = false, destination } = $props();

  const target = $derived(destination(item));
</script>

<a
  class:category-preview-link={preview}
  class="link-button"
  data-link-id={item.id}
  data-preview-id={preview ? item.id : undefined}
  href={target.href}
  target={target.target}
  rel={target.rel}
>
  <span class="frame-rivet frame-rivet-top-start" aria-hidden="true"></span>
  <span class="frame-rivet frame-rivet-top-end" aria-hidden="true"></span>
  <span class="frame-rivet frame-rivet-bottom-start" aria-hidden="true"></span>
  <span class="frame-rivet frame-rivet-bottom-end" aria-hidden="true"></span>
  <span class="link-summary">
    <span class="link-icon"><Icon name={item.icon} /></span>
    <span class="link-copy">
      <span class="link-heading">
        <span class="link-title">{item.title}</span>
        {#if target.thirdParty}<span class="link-third-party-badge"
            >{thirdPartyLabel}</span
          >{/if}
      </span>
      <span class="link-url"
        ><span class="link-url-icon"><Icon name="link" /></span><span
          class="link-url-text">{target.display}</span
        ></span
      >
      {#if item.description}<span class="link-description"
          >{item.description}</span
        >{/if}
      {#if item.badge}<span class="link-badge">{item.badge}</span>{/if}
    </span>
    {#if target.external}<span class="link-actions"
        ><span class="external-link-icon" aria-hidden="true"
          ><Icon name="external-link" /></span
        ></span
      >{/if}
  </span>
  {#if item.visual}
    <span class="link-visual"
      ><img
        src={item.visual.src}
        alt={item.visual.alt}
        width={item.visual.width}
        height={item.visual.height}
        loading="lazy"
        decoding="async"
      /></span
    >
  {/if}
  {#if item.stats}
    <div class="statistics" data-statistics={item.id}>
      {#if item.statistics?.metrics}
        <dl class="statistics-grid">
          {#each item.statistics.metrics as metric}<div
              class="statistic statistic-{metric.id}"
            >
              <dt><Icon name={metric.icon} /><span>{metric.label}</span></dt>
              <dd>
                {metric.value}{#if metric.total}<span class="statistic-total">
                    / {metric.total}
                  </span>{/if}
              </dd>
            </div>{/each}
        </dl>
        <p class="statistics-updated">
          <span>{item.statistics.updatedLabel}</span>
          <time datetime={item.statistics.updatedAt}
            >{item.statistics.updatedAt}</time
          >
        </p>
      {:else}
        <p>{item.statistics?.unavailable}</p>
      {/if}
    </div>
  {/if}
</a>
