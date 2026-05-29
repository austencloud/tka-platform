<script lang="ts">
  import type { OceanQualityConfig } from "../../quality/ocean-quality";
  import GodRayShafts from "./GodRayShafts.svelte";
  import MarineParticles from "./MarineParticles.svelte";

  interface Props {
    quality: OceanQualityConfig;
  }

  let { quality }: Props = $props();
</script>

{#if quality.enableGodRays}
  <GodRayShafts halfRes={quality.godRayHalfRes} />
{/if}
<!-- Caustics now project onto the seabed material itself (see seabed-caustics.ts);
     the old flat VoronoiCaustics plane poked cyan through every terrain valley. -->
<MarineParticles count={quality.particleCount} />
