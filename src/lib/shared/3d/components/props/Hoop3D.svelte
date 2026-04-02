<script lang="ts">
  /**
   * Hoop3D Component
   *
   * Renders a 3D hoop (ring) prop. The hand grabs the BOTTOM of the ring,
   * so the grip point is at the group origin (0,0,0) and the ring center
   * is offset upward by the ring's radius. This means the bottom of the
   * torus touches the origin where the hand holds it.
   *
   * Uses computeFlatPropRotation because hoops are planar props that
   * naturally lie in the XY plane, not cylindrical like staves.
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
  import {
    computePropPosition,
    computeFlatPropRotation,
  } from "./prop3d-transforms";
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

  const effectiveLength = $derived(length ?? userProportionsState.staffLength);
  const staffRadius = $derived(
    thickness
      ? thickness / 2
      : userProportionsState.dimensions.staffRadius
  );

  // Ring radius: ~35% of staff length
  const ringRadius = $derived(effectiveLength * 0.35 * scale);

  // Tube radius: same thickness as a staff shaft
  const tubeRadius = $derived(staffRadius * 1.0 * scale);

  // Grip indicator ring dimensions (small white torus at origin)
  const gripOuterRadius = $derived(staffRadius * 1.4 * scale);
  const gripTubeRadius = $derived(staffRadius * 0.15 * scale);

  const position = $derived(
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );

  // Hoops are planar props — use flat rotation (no 90-degree horizontal tilt)
  const rotation = $derived(
    computeFlatPropRotation(propState, facingAngle)
  );
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Main hoop ring: center offset upward by ringRadius so the
         bottom of the torus sits at the origin (the grip point) -->
    <T.Mesh position={[0, ringRadius, 0]}>
      <T.TorusGeometry args={[ringRadius, tubeRadius, 16, 32]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Grip indicator: small white ring at origin where the hand holds -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere at prop position -->
  <T.Mesh {position} layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
