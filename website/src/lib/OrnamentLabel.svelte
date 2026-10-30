<script lang="ts">
  let {
    label,
    id,
    as = 'h2',
    variant = 'profile',
  }: {
    label: string;
    id?: string;
    as?: 'h2' | 'span';
    variant?: 'profile' | 'footer';
  } = $props();
</script>

<svelte:element this={as} {id} class="ornament-label ornament-label-{variant}">
  {label}
</svelte:element>
