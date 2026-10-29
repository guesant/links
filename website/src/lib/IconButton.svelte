<script lang="ts">
  import Icon from './Icon.svelte';

  let { name, optical = false }: { name: string; optical?: boolean } = $props();
</script>

<span class="button-icon" aria-hidden="true"><Icon {name} {optical} /></span>
