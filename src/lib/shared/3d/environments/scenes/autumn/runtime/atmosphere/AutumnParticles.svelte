<script lang="ts">
  /**
   * AutumnParticles
   *
   * Three atmospheric particle layers for the Enchanted Autumn Dusk scene:
   *   1. Leaves    — tumbling amber/red foliage falling through the canopy
   *   2. Spores    — rising bioluminescent motes drifting up from the forest floor
   *   3. Fireflies — warm-glow pulses staged from the near clearing to the lane
   *
   * Each layer is wrapped in {#key count} so a quality-tier change remounts the
   * FallingParticles instance and re-allocates the GPU buffer to the new size.
   */

  import { T } from "@threlte/core";
  import FallingParticles from "../../../../primitives/FallingParticles.svelte";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";
  import {
    allocateAutumnCanopyLeaves,
    allocateAutumnFireflies,
    AUTUMN_FIREFLY_CLUSTERS,
    AUTUMN_LEAF_EMITTERS,
  } from "./autumn-ground-life-layout";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    pondCenter?: [number, number, number];
    active?: boolean;
  }

  let { quality, groundY = 0, pondCenter, active = true }: Props = $props();

  // Leaf area is centered slightly above ground level so the fall looks natural.
  // sporeArea is narrower and lower — motes rise from the forest floor.
  const sporeAreaHeight = 8;
  const leafCounts = $derived(allocateAutumnCanopyLeaves(quality.leafCount));
  const fireflyCounts = $derived(allocateAutumnFireflies(quality.fireflyCount));
</script>

<!-- Each emitter sits beneath a real authored canopy, so no leaf appears to
     enter from the open sky above the performance clearing. -->
{#key quality.leafCount}
  {#each AUTUMN_LEAF_EMITTERS as emitter, index (emitter.id)}
    <T.Group
      position.x={emitter.position[0]}
      position.y={groundY + emitter.area.height * 0.5 + 0.2}
      position.z={emitter.position[1]}
    >
      <!-- Sizes run larger than the old confetti so the leaf silhouette has
           enough screen pixels to read as a leaf rather than a speck. -->
      <FallingParticles
        type="leaves"
        count={leafCounts[index] ?? 0}
        area={emitter.area}
        speed={emitter.fallSpeed}
        colors={[...emitter.colors]}
        sizeRange={[0.07, 0.16]}
        spin={true}
        opacity={0.94}
        emissionShape="ellipse"
        {active}
      />
    </T.Group>
  {/each}
{/key}

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
      sizeRange={[0.008, 0.022]}
      spin={false}
      {active}
    />
  </T.Group>
{/key}

<!-- Warm-glow pulses connect the clearing edge, pond, fallen wood, mushrooms,
     and distant lane without entering the protected performance clearing. -->
{#key quality.fireflyCount}
  {#each AUTUMN_FIREFLY_CLUSTERS as cluster, index (cluster.id)}
    <T.Group
      position.x={cluster.id === "pond" && pondCenter
        ? pondCenter[0]
        : cluster.position[0]}
      position.y={pondCenter ? pondCenter[1] + 1.4 : groundY + 1.4}
      position.z={cluster.id === "pond" && pondCenter
        ? pondCenter[2]
        : cluster.position[1]}
    >
      <FallingParticles
        type="fireflies"
        count={fireflyCounts[index] ?? 0}
        area={cluster.area}
        speed={0.032}
        colors={cluster.id === "pond"
          ? ["#deff9a", "#fff1ad"]
          : ["#fff2a0", "#ffbe3b"]}
        sizeRange={[0.12 * cluster.sizeScale, 0.24 * cluster.sizeScale]}
        spin={false}
        emissionShape="ellipse"
        {active}
      />
    </T.Group>
  {/each}
{/key}
