<script lang="ts">
  import { requiredText } from './validation-primitives.ts';

  let { label, level = 3 }: { label: string | undefined; level?: 2 | 3 | 4 } =
    $props();

  const title = $derived(requiredText(label, 'listing.heading'));
</script>

<header class="content-list-heading">
  <svelte:element this={`h${level}`}>{title}</svelte:element>
</header>
