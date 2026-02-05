<script lang="ts">
  /**
   * EmberScene
   *
   * A volcanic/fire environment with rising embers.
   * Used for EMBER_GLOW background type.
   */

  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";

  // Ember palette - fiery oranges and reds
  const palette = {
    sky: {
      topColor: "#0a0505",
      midColor: "#2a0a0a",
      bottomColor: "#1a0808",
    },
    ground: "#1a0a0a", // Dark volcanic rock
    embers: ["#ff6b35", "#ff8c42", "#ffc145", "#ff4500"],
  };
</script>

<!-- Smoky dark sky -->
<SkyGradient
  topColor={palette.sky.topColor}
  midColor={palette.sky.midColor}
  bottomColor={palette.sky.bottomColor}
/>

<!-- Volcanic ground - uses dynamic groundY from user proportions (15m radius) -->
<GroundPlane color={palette.ground} opacity={0.95} size={15} />

<!-- Rising embers (area in meters) -->
<FallingParticles
  type="embers"
  count={100}
  area={{ width: 3, height: 2.5, depth: 3 }}
  speed={0.15}
  colors={palette.embers}
  sizeRange={[0.02, 0.05]}
  spin={false}
/>
