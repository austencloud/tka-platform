<script lang="ts">
  /**
   * WinterScene
   *
   * A winter environment with falling snow.
   * Used for SNOWFALL background type.
   */

  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";

  // Winter palette - icy blues and whites
  const palette = {
    sky: {
      topColor: "#0a1525",
      midColor: "#1e3a5f",
      bottomColor: "#0a0f15",
    },
    ground: "#e8f0f8", // Snowy white ground
    snow: ["#ffffff", "#e0f0ff", "#c8e0f0", "#a0c8e0"],
  };
</script>

<!-- Sky gradient background -->
<SkyGradient
  topColor={palette.sky.topColor}
  midColor={palette.sky.midColor}
  bottomColor={palette.sky.bottomColor}
/>

<!-- Snowy ground - uses dynamic groundY from user proportions (15m radius) -->
<GroundPlane color={palette.ground} opacity={0.95} size={15} />

<!-- Falling snow (area in meters) -->
<FallingParticles
  type="snow"
  count={150}
  area={{ width: 4, height: 3, depth: 4 }}
  speed={0.1}
  colors={palette.snow}
  sizeRange={[0.02, 0.06]}
  spin={false}
/>
