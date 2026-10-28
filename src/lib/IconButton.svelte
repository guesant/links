<script>
  import Icon from './Icon.svelte';
  let { name } = $props();
</script>

<span class="button-icon" aria-hidden="true"><Icon {name} /></span>
