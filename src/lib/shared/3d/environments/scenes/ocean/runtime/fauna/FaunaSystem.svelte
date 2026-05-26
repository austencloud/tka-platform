<script lang="ts">
  import type { OceanQualityConfig } from "../../quality/ocean-quality";
  import type { Vector3 } from "three";
  import FishBoids from "./fish/FishBoids.svelte";
  import JellyfishSwarm from "./jellyfish/JellyfishSwarm.svelte";

  interface Props {
    quality: OceanQualityConfig;
    rayPosition?: Vector3;
  }

  let { quality, rayPosition }: Props = $props();
</script>

<FishBoids {rayPosition} />

{#if quality.maxJellyfish > 0}
  <JellyfishSwarm {quality} />
{/if}
