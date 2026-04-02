<script lang="ts">
  /**
   * Sword3D Component
   *
   * Renders a 3D sword:
   * - Flat blade (BoxGeometry) with metallic silver finish
   * - Gold crosspiece/guard at the grip point
   * - Dark brown handle below the guard
   * - Gold pommel sphere at the handle end
   * - Trail indicator sphere for path visualization
   *
   * The hand grips at the guard, so the group is centered there.
   * Blade extends in +Y (thumb direction), handle in -Y (pinky direction).
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS, METAL_COLORS } from "./Prop3DProps";
  import { computePropPosition, computePropRotation } from "./prop3d-transforms";
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
    avatarPosition = { x: 0, y: 0, z: 0 },
    facingAngle = 0,
    gridOffset = 0,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);
  const palette = $derived(PROP_COLORS[color]);

  const staffLength = $derived(length ?? userProportionsState.staffLength);
  const staffRadius = $derived(
    thickness ?? userProportionsState.dimensions.staffRadius * 2
  );

  // Blade: 80% of total length, thin and flat
  const bladeLength = $derived(staffLength * 0.8);
  const bladeWidth = $derived(staffRadius * 1.5);
  const bladeDepth = $derived(staffRadius * 0.3);

  // Guard/crosspiece: perpendicular bar at the grip point
  const guardWidth = $derived(bladeLength * 0.25);
  const guardHeight = $derived(staffRadius * 3);
  const guardDepth = $derived(staffRadius * 0.6);

  // Handle: short cylinder below the guard
  const handleLength = $derived(staffLength * 0.15);
  const handleRadius = $derived(staffRadius * 0.8);

  // Pommel: small sphere at the handle end
  const pommelRadius = $derived(staffRadius * 1.2);

  // Blade center offset: blade extends upward from guard
  const bladeCenterY = $derived(bladeLength / 2);

  // Handle center offset: handle extends downward from guard
  const handleCenterY = $derived(-(handleLength / 2));

  // Pommel position: below the handle
  const pommelY = $derived(-(handleLength + pommelRadius * 0.5));

  const position = $derived(
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );

  const rotation = $derived(computePropRotation(propState, facingAngle));
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer} scale={scale}>
    <!-- Blade: flat box extending upward (+Y = thumb direction) -->
    <T.Mesh position={[0, bladeCenterY, 0]}>
      <T.BoxGeometry args={[bladeWidth, bladeLength, bladeDepth]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.blade}
        roughness={0.2}
        metalness={0.7}
      />
    </T.Mesh>

    <!-- Blade tip: tapered end at the top of the blade -->
    <T.Mesh position={[0, bladeLength, 0]}>
      <T.SphereGeometry args={[bladeWidth * 0.4, 8, 8]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.blade}
        roughness={0.2}
        metalness={0.7}
      />
    </T.Mesh>

    <!-- Guard/crosspiece: perpendicular bar at center (grip point) -->
    <T.Mesh>
      <T.BoxGeometry args={[guardWidth, guardHeight, guardDepth]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.guard}
        roughness={0.3}
        metalness={0.5}
      />
    </T.Mesh>

    <!-- Handle: cylinder extending downward from guard -->
    <T.Mesh position={[0, handleCenterY, 0]}>
      <T.CylinderGeometry
        args={[handleRadius, handleRadius, handleLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={METAL_COLORS.grip}
        roughness={0.7}
        metalness={0.1}
      />
    </T.Mesh>

    <!-- Pommel: gold sphere at the handle end -->
    <T.Mesh position={[0, pommelY, 0]}>
      <T.SphereGeometry args={[pommelRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.guard}
        roughness={0.3}
        metalness={0.5}
      />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh {position} layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
