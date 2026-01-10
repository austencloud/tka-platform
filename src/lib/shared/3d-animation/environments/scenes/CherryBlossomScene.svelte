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

<!-- Ground with fallen petals - uses dynamic groundY from user proportions -->
<GroundPlane color={palette.ground} opacity={0.9} size={3000} />

<!-- Falling cherry blossom petals -->
<FallingParticles
  type="petals"
  count={120}
  area={{ width: 700, height: 500, depth: 700 }}
  speed={18}
  colors={palette.petals}
  sizeRange={[10, 22]}
  spin={true}
/>
