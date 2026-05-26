<script lang="ts">
  import type { OceanQualityConfig } from "../../quality/ocean-quality";
  import GodRayShafts from "./GodRayShafts.svelte";
  import VoronoiCaustics from "./VoronoiCaustics.svelte";
  import MarineParticles from "./MarineParticles.svelte";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();
</script>

{#if quality.enableGodRays}
  <GodRayShafts halfRes={quality.godRayHalfRes} />
{/if}
<VoronoiCaustics />
<MarineParticles count={quality.particleCount} />
