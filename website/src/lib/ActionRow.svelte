<script lang="ts">
  import Icon from './Icon.svelte';
  import type { LinkDestination } from './site-data.ts';

  let {
    title,
    action,
    thirdPartyLabel,
    interfaceName,
    icon,
    className = '',
    linkID,
    previewID,
  }: {
    title: string;
    action: LinkDestination;
    thirdPartyLabel: string;
    interfaceName: 'minecraft' | 'terminal';
    icon?: string | undefined;
    className?: string;
    linkID?: string;
    previewID?: string | undefined;
  } = $props();
</script>

<a
  class="action-row {className}"
  class:action-row-with-icon={Boolean(icon) && interfaceName === 'minecraft'}
  href={action.href}
  target={action.target}
  rel={action.rel}
  data-link-id={linkID}
  data-preview-id={previewID}
>
  {#if icon && interfaceName === 'minecraft'}
    <span class="action-row-icon link-icon" aria-hidden="true">
      <Icon name={icon} optical />
    </span>
  {/if}
  <span class="action-row-title link-title">{title}</span>
  <span class="action-row-indicators">
    {#if action.thirdParty}<span class="link-third-party-badge">
        {thirdPartyLabel}
      </span>{/if}
    {#if action.external}<span class="external-link-icon" aria-hidden="true">
        {#if interfaceName === 'terminal'}↗{:else}<Icon
            name="external-link"
          />{/if}
      </span>{/if}
  </span>
</a>
