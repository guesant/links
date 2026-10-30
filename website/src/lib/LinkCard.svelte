<script lang="ts">
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import ActionRow from './ActionRow.svelte';
  import type { DisplayLinkRecord } from './site-data.ts';
  import type { ListingDestination } from './listing-presentation.ts';

  let {
    item,
    thirdPartyLabel,
    preview = false,
    destination,
  }: {
    item: DisplayLinkRecord;
    thirdPartyLabel: string;
    preview?: boolean;
    destination: ListingDestination;
  } = $props();

  const target = $derived(destination(item));

  const actionClass = $derived.by((): string => {
    if (preview) {
      return 'link-button category-preview-link';
    }

    return 'link-button';
  });

  const previewID = $derived.by(() => {
    if (preview) {
      return item.id;
    }

    return undefined;
  });
</script>

<article class="link-card">
  <span class="frame-rivet frame-rivet-top-start" aria-hidden="true"></span>
  <span class="frame-rivet frame-rivet-top-end" aria-hidden="true"></span>
  <span class="frame-rivet frame-rivet-bottom-start" aria-hidden="true"></span>
  <span class="frame-rivet frame-rivet-bottom-end" aria-hidden="true"></span>
  <ActionRow
    title={item.title}
    action={target}
    {thirdPartyLabel}
    interfaceName="minecraft"
    icon={item.icon}
    className={actionClass}
    linkID={item.id}
    {previewID}
  />
  <div class="link-card-details">
    <span class="link-url">
      <span class="link-url-icon"><Icon name="link" /></span>
      <span class="link-url-text">{target.display}</span>
    </span>
    {#if item.description}<span class="link-description">
        {item.description}
      </span>{/if}
    {#if item.badge}<span class="link-badge">{item.badge}</span>{/if}
    {#if item.visual}
      <span class="link-visual">
        <img
          src={item.visual.src}
          alt={item.visual.alt}
          width={item.visual.width}
          height={item.visual.height}
          loading="lazy"
          decoding="async"
        />
      </span>
    {/if}
    {#if item.stats}
      <div class="statistics" data-statistics={item.id}>
        {#if item.statistics?.metrics}
          <dl class="statistics-grid">
            {#each item.statistics.metrics as metric}<div
                class="statistic statistic-{metric.id}"
              >
                <dt>
                  <IconButton name={metric.icon} optical />
                  <span>{metric.label}</span>
                </dt>
                <dd>
                  {metric.value}{#if metric.total}<span class="statistic-total">
                      / {metric.total}
                    </span>{/if}
                </dd>
              </div>{/each}
          </dl>
          <p class="statistics-updated">
            <span>{item.statistics.updatedLabel}</span>
            <time datetime={item.statistics.updatedAt}>
              {item.statistics.updatedAt}
            </time>
          </p>
        {:else}
          <p>{item.statistics?.unavailable}</p>
        {/if}
      </div>
    {/if}
  </div>
</article>
