<script lang="ts">
  import geometry from '../assets/images/ui/suspension-rail.json';

  let { lanternCount }: { lanternCount: number } = $props();

  const lanternPositions = [
    'upper',
    'middle',
    'lower',
    'bottom',
  ];

  const couplingURL = '/assets/generated/rail-coupling.png';

  const couplingWebpURL = '/assets/generated/rail-coupling.webp';

  const lanternURL = '/assets/generated/rail-lantern.png';

  const lanternWebpURL = '/assets/generated/rail-lantern.webp';
</script>

{#each ['start', 'end'] as side}
  <span class="suspension-rail suspension-rail-{side}" aria-hidden="true">
    <picture>
      <source type="image/webp" srcset={couplingWebpURL} />
      <img
        class="suspension-terminal suspension-terminal-upper"
        src={couplingURL}
        width={geometry.width}
        height={geometry.slices.coupling.height}
        alt=""
        loading="lazy"
        decoding="async"
        fetchpriority="low"
      />
    </picture>
    <span class="suspension-body">
      <span class="suspension-chain suspension-chain-upper"></span>
      <span class="suspension-chain suspension-chain-lower"></span>
      {#each lanternPositions.slice(0, lanternCount) as position, index}
        <picture>
          <source type="image/webp" srcset={lanternWebpURL} />
          <img
            class="suspension-lantern suspension-lantern-{position}"
            data-rail-lantern={index}
            src={lanternURL}
            width={geometry.width}
            height={geometry.slices.lantern.height}
            alt=""
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          />
        </picture>
      {/each}
    </span>
    <picture>
      <source type="image/webp" srcset={couplingWebpURL} />
      <img
        class="suspension-terminal suspension-terminal-lower"
        src={couplingURL}
        width={geometry.width}
        height={geometry.slices.coupling.height}
        alt=""
        loading="lazy"
        decoding="async"
        fetchpriority="low"
      />
    </picture>
  </span>
{/each}
