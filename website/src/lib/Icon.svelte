<script lang="ts">
  import manifest from '../assets/icons/manifest.json';

  export type IconName = keyof typeof manifest.icons;

  let { name = 'link', optical = false }: { name?: string; optical?: boolean } =
    $props();

  const isIconName = (value: string): value is IconName => {
    return Object.hasOwn(manifest.icons, value);
  };

  const resolveIcon = (value: string): IconName => {
    if (isIconName(value)) {
      return value;
    }

    return 'link';
  };

  const icon = $derived(resolveIcon(name));

  const metadata = $derived(manifest.icons[icon]);

  const style = $derived(
    `--icon-sprite: url('/assets/icons/pixel-compact.png'); --icon-sprite-hd: url('/assets/icons/pixel.png'); --icon-columns: ${manifest.count}; --icon-position: ${metadata.position}%; --icon-optical-scale: ${metadata.opticalScale}`,
  );
</script>

<span
  class:site-icon-monochrome={!metadata.colored}
  class:site-icon-optical={optical}
  class="site-icon"
  data-platform={icon}
  data-finish="beveled"
  {style}
  aria-hidden="true"
>
  <span class="site-icon-face"></span>
</span>
