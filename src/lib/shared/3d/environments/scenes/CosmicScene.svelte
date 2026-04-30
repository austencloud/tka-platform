<script lang="ts">
  /**
   * CosmicScene
   *
   * A cosmic space environment with drifting stars.
   * Supports night sky and aurora color variants.
   */

  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import type { CosmicVariant } from "../domain/enums/environment-enums";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  // Scene feature readiness - synchronous scene, report on mount so the
  // loading curtain can lift. Without this, the "environment" feature stays
  // enabled-but-not-ready forever and allEnabledReady never flips true.
  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    sceneFeatures?.reportReady("environment");
  });

  interface Props {
    /** Color variant: night (purple/indigo) or aurora (green/cyan) */
    variant?: CosmicVariant;
  }

  let { variant = "night" }: Props = $props();

  // Color palettes from background themeColors
  const palettes = {
    night: {
      // From NIGHT_SKY: deep purples and indigos
      sky: {
        topColor: "#0a0a1a",
        midColor: "#1e1b4b",
        bottomColor: "#050510",
      },
      stars: ["#ffffff", "#e0e7ff", "#c7d2fe", "#818cf8"],
      asteroid: "#2a2a35", // Dark rocky surface
    },
    aurora: {
      // From AURORA: greens, cyans, magentas
      sky: {
        topColor: "#0a1a1a",
        midColor: "#064e3b",
        bottomColor: "#050a0a",
      },
      stars: ["#22d3ee", "#a855f7", "#0d9488", "#f0abfc"],
      asteroid: "#1a2a2a", // Teal-tinted rock
    },
  };

  const palette = $derived(palettes[variant]);
</script>

<!-- Sky gradient background -->
<SkyGradient
  topColor={palette.sky.topColor}
  midColor={palette.sky.midColor}
  bottomColor={palette.sky.bottomColor}
/>

<!-- Asteroid platform - small rocky surface at avatar feet level (1.25m radius) -->
<GroundPlane color={palette.asteroid} opacity={1} size={1.25} />

<!-- Drifting stars - larger and more numerous for cosmic feel (area in meters) -->
<FallingParticles
  type="stars"
  count={200}
  area={{ width: 7.5, height: 6, depth: 7.5 }}
  speed={0.025}
  colors={palette.stars}
  sizeRange={[0.03, 0.09]}
  spin={false}
/>
