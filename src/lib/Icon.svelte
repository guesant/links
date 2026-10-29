<script>
  import manifest from '../assets/icons/manifest.json';

  let { name = 'link' } = $props();

  const icon = $derived(manifest.icons[name] ? name : 'link');

  const metadata = $derived(manifest.icons[icon]);

  const style = $derived(
    `--icon-sprite: url('/assets/icons/pixel-compact.png'); --icon-sprite-hd: url('/assets/icons/pixel.png'); --icon-columns: ${manifest.count}; --icon-position: ${metadata.position}%`,
  );
</script>

<span
  class:site-icon-monochrome={!metadata.colored}
  class="site-icon"
  data-platform={icon}
  data-finish="beveled"
  {style}
  aria-hidden="true"><span class="site-icon-face"></span></span
>
