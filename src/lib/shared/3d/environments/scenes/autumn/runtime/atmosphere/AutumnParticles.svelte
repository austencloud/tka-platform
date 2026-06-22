<script lang="ts">
  /**
   * AutumnParticles
   *
   * Three atmospheric particle layers for the Enchanted Autumn Dusk scene:
   *   1. Leaves    — tumbling amber/red foliage falling through the canopy
   *   2. Spores    — rising bioluminescent motes drifting up from the forest floor
   *   3. Fireflies — warm-glow pulses clustered near the pond
   *
   * Each layer is wrapped in {#key count} so a quality-tier change remounts the
   * FallingParticles instance and re-allocates the GPU buffer to the new size.
   */

  import { T } from "@threlte/core";
  import FallingParticles from "../../../../primitives/FallingParticles.svelte";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    pondCenter?: [number, number, number];
  }

  let { quality, groundY = 0, pondCenter }: Props = $props();

  // Leaf area is centered slightly above ground level so the fall looks natural.
  // sporeArea is narrower and lower — motes rise from the forest floor.
  const leafAreaHeight = 18;
  const sporeAreaHeight = 8;
</script>

<!-- ── Leaves ─────────────────────────────────────────────────────────────── -->
<!-- Slow-tumbling foliage falling through a 40×18×40 m canopy column.        -->
{#key quality.leafCount}
  <T.Group position.y={groundY + leafAreaHeight * 0.5}>
    <FallingParticles
      type="leaves"
      count={quality.leafCount}
      area={{ width: 40, height: leafAreaHeight, depth: 40 }}
      speed={0.12}
      colors={["#b5571a", "#d98324", "#8a2e16", "#e0a040"]}
      sizeRange={[0.06, 0.14]}
      spin={true}
    />
  </T.Group>
{/key}

<!-- ── Spores ─────────────────────────────────────────────────────────────── -->
<!-- Bioluminescent teal motes rising from the forest floor.                  -->
<!-- type="bubbles" rises (gravity −0.100), additive blending, circle shape.  -->
{#key quality.sporeCount}
  <T.Group position.y={groundY + sporeAreaHeight * 0.5}>
    <FallingParticles
      type="bubbles"
      count={quality.sporeCount}
      area={{ width: 30, height: sporeAreaHeight, depth: 30 }}
      speed={0.03}
      colors={["#9af9e0", "#00c8b4"]}
      sizeRange={[0.02, 0.05]}
      spin={false}
    />
  </T.Group>
{/key}

<!-- ── Fireflies ──────────────────────────────────────────────────────────── -->
<!-- Warm-glow pulses clustered in a 12×5×12 m zone near the pond.            -->
<!-- When pondCenter is provided the group offsets to that XZ position.        -->
{#key quality.fireflyCount}
  <T.Group
    position.x={pondCenter ? pondCenter[0] : 0}
    position.y={pondCenter ? pondCenter[1] + 1 : groundY + 2}
    position.z={pondCenter ? pondCenter[2] : 0}
  >
    <FallingParticles
      type="fireflies"
      count={quality.fireflyCount}
      area={{ width: 12, height: 5, depth: 12 }}
      speed={0.04}
      colors={["#ffe9a0", "#ffcf66"]}
      sizeRange={[0.04, 0.09]}
      spin={false}
    />
  </T.Group>
{/key}
