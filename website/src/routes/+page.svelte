<script lang="ts">
  import type { PageLoadData } from '$lib/site-data.ts';

  let { data }: { data: PageLoadData } = $props();
</script>

<svelte:head>
  <noscript>
    <meta http-equiv="refresh" content={`0; url=${data.standardHomeURL}`} />
  </noscript>
</svelte:head>
