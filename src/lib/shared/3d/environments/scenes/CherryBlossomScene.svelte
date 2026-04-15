<script lang="ts">
  /**
   * CherryBlossomScene
   *
   * A cherry blossom environment with falling petals.
   * Used for SAKURA_DRIFT background type.
   */

  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  // Scene feature readiness — synchronous scene, report on mount so the
  // loading curtain can lift. Without this, the "environment" feature stays
  // enabled-but-not-ready forever and allEnabledReady never flips true.
  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    sceneFeatures?.reportReady("environment");
  });

  // Cherry blossom palette - soft pinks and whites
  const palette = {
    sky: {
      topColor: "#1a1520",
      midColor: "#3d2840",
      bottomColor: "#0f0a10",
    },
    ground: "#2a1a25", // Dark pink-tinted ground
    petals: ["#ffb7c5", "#ffc0cb", "#ff69b4", "#fff0f5"],
  };
</script>

<!-- Twilight sky -->
<SkyGradient
  topColor={palette.sky.topColor}
  midColor={palette.sky.midColor}
  bottomColor={palette.sky.bottomColor}
/>

<!-- Ground with fallen petals - uses dynamic groundY from user proportions (15m radius) -->
<GroundPlane color={palette.ground} opacity={0.9} size={15} />

<!-- Falling cherry blossom petals (area in meters) -->
<FallingParticles
  type="petals"
  count={120}
  area={{ width: 3.5, height: 2.5, depth: 3.5 }}
  speed={0.09}
  colors={palette.petals}
  sizeRange={[0.05, 0.11]}
  spin={true}
/>
