<script lang="ts">
  import type { OceanQualityConfig } from "../../quality/ocean-quality";
  import FishBoids from "./fish/FishBoids.svelte";
  import JellyfishSwarm from "./jellyfish/JellyfishSwarm.svelte";
  import type { CursorRay } from "../interaction/OceanInteraction.svelte";

  interface Props {
    quality: OceanQualityConfig;
    cursorRay?: CursorRay;
  }

  let { quality, cursorRay }: Props = $props();
</script>

<FishBoids {cursorRay} />

{#if quality.maxJellyfish > 0}
  <JellyfishSwarm {quality} />
{/if}
