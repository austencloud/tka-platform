<script lang="ts">
  /**
   * Fan3D Component
   *
   * Renders a realistic 3D folding fan with:
   * - Wide arc blade (~150 degrees) using CircleGeometry, double-sided and translucent
   * - 5 spine ribs radiating from the pivot across the blade arc
   * - Thin torus arc rim along the curved outer edge
   * - Short tapered handle extending downward from the pivot with end cap
   *
   * The fan pivot (grip point) is at origin (0,0,0).
   * The blade extends upward (+Y), the handle extends downward (-Y).
   *
   * Uses computePropRotation (unified for all prop types).
   */

  import { T } from "@threlte/core";
  import { DoubleSide } from "three";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "$lib/shared/3d/layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    length,
    thickness,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  // Fan blade radius is ~50% of staff length
  const FAN_BLADE_RATIO = 0.5;

  // Blade arc: ~150 degrees = 2.618 radians
  const BLADE_THETA_LENGTH = 2.618;
  // Center the arc so it fans symmetrically upward from origin
  const BLADE_THETA_START = -BLADE_THETA_LENGTH / 2 + Math.PI / 2;
  const BLADE_SEGMENTS = 48;

  // 5 spine ribs evenly distributed across the blade arc
  const SPINE_COUNT = 5;

  const staffLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const bladeRadius = $derived(staffLength * FAN_BLADE_RATIO);

  const palette = $derived(PROP_COLORS[color]);

  const rotation = $derived(computePropRotation(propState));

  // Handle: ~12% of staff length, tapered (wider at top, narrower at bottom)
  const handleLength = $derived(staffLength * 0.12);
  const handleTopRadius = $derived(baseRadius * 1.3);
  const handleBottomRadius = $derived(baseRadius * 0.9);

  // Spine ribs: very thin cylinders radiating from pivot
  const spineRadius = $derived(baseRadius * 0.3);

  // Outer rim: thin torus arc along the curved edge
  const rimTubeRadius = $derived(baseRadius * 0.25);

  // Compute spine angles and positions. Each spine radiates from origin
  // at evenly spaced angles across the blade arc.
  const spineData = $derived.by(() => {
    const spines: Array<{
      posX: number;
      posY: number;
      rotZ: number;
      len: number;
    }> = [];
    for (let i = 0; i < SPINE_COUNT; i++) {
      // Distribute spines evenly across the arc, including both edges
      const fraction = i / (SPINE_COUNT - 1);
      const angle = BLADE_THETA_START + fraction * BLADE_THETA_LENGTH;
      // Spine center is halfway along its length from origin
      const halfLen = bladeRadius / 2;
      const posX = Math.cos(angle) * halfLen;
      const posY = Math.sin(angle) * halfLen;
      // Rotation to align the cylinder along the radial direction.
      // CylinderGeometry is vertical by default, so rotate to point along the angle.
      const rotZ = angle - Math.PI / 2;
      spines.push({ posX, posY, rotZ, len: bladeRadius });
    }
    return spines;
  });

  // Rim torus rotation: the TorusGeometry arc starts at angle 0 on the XY plane.
  // We need to rotate it so the arc aligns with our blade arc.
  // The torus arc center angle = BLADE_THETA_START
  const rimRotationZ = $derived(BLADE_THETA_START);
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Fan blade: wide arc disc, double-sided with translucency for fabric feel.
         CircleGeometry lies in XY plane by default, extending upward from origin. -->
    <T.Mesh>
      <T.CircleGeometry
        args={[bladeRadius, BLADE_SEGMENTS, BLADE_THETA_START, BLADE_THETA_LENGTH]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.6}
        metalness={0.05}
        side={DoubleSide}
        transparent
        opacity={0.9}
      />
    </T.Mesh>

    <!-- Spine ribs: 5 thin cylinders radiating from the pivot across the blade arc -->
    {#each spineData as spine}
      <T.Mesh
        position={[spine.posX, spine.posY, 0]}
        rotation={[0, 0, spine.rotZ]}
      >
        <T.CylinderGeometry
          args={[spineRadius, spineRadius, spine.len, 6, 1]}
        />
        <T.MeshStandardMaterial
          color={palette.dark}
          roughness={0.4}
          metalness={0.15}
        />
      </T.Mesh>
    {/each}

    <!-- Outer rim: thin torus arc along the curved edge of the blade -->
    <T.Mesh rotation={[0, 0, rimRotationZ]}>
      <T.TorusGeometry
        args={[
          bladeRadius,
          rimTubeRadius,
          8,
          BLADE_SEGMENTS,
          BLADE_THETA_LENGTH,
        ]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.4}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Handle: short tapered cylinder extending downward (-Y) from the pivot -->
    <T.Mesh position={[0, -handleLength / 2, 0]}>
      <T.CylinderGeometry
        args={[handleTopRadius, handleBottomRadius, handleLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Handle end cap: sphere at the bottom of the handle -->
    <T.Mesh position={[0, -handleLength, 0]}>
      <T.SphereGeometry args={[handleBottomRadius, 10, 10]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
