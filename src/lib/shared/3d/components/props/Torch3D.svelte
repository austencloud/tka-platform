<script lang="ts">
  /**
   * Torch3D Component
   *
   * Renders a 3D fire torch with correct grip-point origin:
   * - Origin (0,0,0) is where the hand grips the handle
   * - Handle cap extends slightly below the grip (-Y)
   * - Main shaft extends upward from grip (+Y)
   * - Kevlar wick wraps the top ~25% of the shaft
   * - White grip ring sits at origin
   * - Trail indicator sphere for path visualization
   */

  import { T } from "@threlte/core";
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
  const palette = $derived(PROP_COLORS[color]);

  const staffRadius = $derived(
    thickness
      ? thickness / 2
      : userProportionsState.dimensions.staffRadius
  );
  const staffLength = $derived(length ?? userProportionsState.staffLength);

  // Total torch length is 90% of staff length
  const totalLength = $derived(staffLength * 0.9);

  // Handle cap sits 8% of total length below origin
  const handleCapOffset = $derived(totalLength * 0.08);

  // Shaft extends from origin upward, covering ~75% of total length
  const shaftLength = $derived(totalLength * 0.75);
  const shaftRadius = $derived(staffRadius * 2);
  // Shaft center is halfway up the shaft from origin
  const shaftCenterY = $derived(shaftLength / 2);

  // Wick section: top 25% of the torch, wider than shaft
  const wickLength = $derived(totalLength * 0.25);
  const wickRadiusWide = $derived(staffRadius * 4);
  const wickRadiusNarrow = $derived(staffRadius * 3);
  // Wick starts where shaft ends, so its center is offset above shaft top
  const wickCenterY = $derived(shaftLength + wickLength / 2);

  // Handle section: thin cylinder from origin down to cap
  const handleLength = $derived(handleCapOffset);
  const handleRadius = $derived(staffRadius * 1.5);
  const handleCenterY = $derived(-handleLength / 2);

  // Grip ring at origin
  const gripRingMajorRadius = $derived(shaftRadius * 1.3);
  const gripRingTubeRadius = $derived(staffRadius * 0.3);

  // Handle cap sphere radius
  const capRadius = $derived(staffRadius * 2.2);

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer} scale={scale}>
    <!-- Handle cap: small sphere pommel below the grip -->
    <T.Mesh position={[0, -handleCapOffset, 0]}>
      <T.SphereGeometry args={[capRadius, 16, 16]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Handle section: thin cylinder from origin down to cap -->
    <T.Mesh position={[0, handleCenterY, 0]}>
      <T.CylinderGeometry
        args={[handleRadius, handleRadius, handleLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.4}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- White grip ring at origin (hand position) -->
    <T.Mesh>
      <T.TorusGeometry
        args={[gripRingMajorRadius, gripRingTubeRadius, 12, 24]}
      />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>

    <!-- Main shaft: extends upward from origin -->
    <T.Mesh position={[0, shaftCenterY, 0]}>
      <T.CylinderGeometry
        args={[shaftRadius, shaftRadius, shaftLength, 16, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Kevlar wick: wider, tapered dark wrap at the top -->
    <T.Mesh position={[0, wickCenterY, 0]}>
      <T.CylinderGeometry
        args={[wickRadiusNarrow, wickRadiusWide, wickLength, 16, 1]}
      />
      <T.MeshStandardMaterial color="#222222" roughness={0.9} metalness={0} />
    </T.Mesh>

    <!-- Rounded cap at the very top of the wick -->
    <T.Mesh position={[0, shaftLength + wickLength, 0]}>
      <T.SphereGeometry args={[wickRadiusNarrow, 12, 12]} />
      <T.MeshStandardMaterial color="#222222" roughness={0.9} metalness={0} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
