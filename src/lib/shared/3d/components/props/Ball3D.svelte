<script lang="ts">
  /**
   * Ball3D Component
   *
   * Renders a 3D contact ball (sphere). Contact balls are fist-sized,
   * semi-transparent, and glossy. You palm-roll them, so there's no
   * grip ring. The rotation quaternion is still applied for consistency
   * with the prop state system, even though a sphere looks the same
   * from every angle.
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
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

  const staffRadius = $derived(
    thickness
      ? thickness / 2
      : userProportionsState.dimensions.staffRadius
  );

  // Contact balls are fist-sized: ~4x the staff tube radius
  const ballRadius = $derived(staffRadius * 4 * scale);

  const position = $derived(
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );

  // Apply rotation for consistency, even though a sphere is rotationally symmetric
  const rotation = $derived(
    computePropRotation(propState, facingAngle)
  );
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Contact ball sphere -->
    <T.Mesh>
      <T.SphereGeometry args={[ballRadius, 32, 32]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.1}
        metalness={0.3}
        opacity={0.85}
        transparent
      />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere at prop position -->
  <T.Mesh {position} layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
