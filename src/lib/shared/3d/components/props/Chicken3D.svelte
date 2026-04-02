<script lang="ts">
  /**
   * Chicken3D Component
   *
   * Renders a 3D chicken stick (a long, thin staff without a T-bar):
   * - Main shaft: thin cylinder (~60% of staff radius thickness)
   * - Length: ~95% of staffLength
   * - Rounded sphere caps on both ends (no T-bar)
   * - Grip ring at center
   * - Trail indicator sphere for path visualization
   *
   * Very minimal, elegant shape. Like a sai without the side prongs.
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

  // Chicken sticks are ~95% of staff length
  const CHICKEN_LENGTH_RATIO = 0.95;
  // Thinner than a staff: ~60% of staff radius
  const CHICKEN_THICKNESS_RATIO = 0.6;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * CHICKEN_LENGTH_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) *
      CHICKEN_THICKNESS_RATIO *
      scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const position = $derived.by(() =>
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );
  const rotation = $derived.by(() =>
    computePropRotation(propState, facingAngle)
  );

  const halfLength = $derived(effectiveLength / 2);

  // End cap radius matches the shaft thickness for a smooth rounded look
  const capRadius = $derived(baseRadius);

  // Grip ring at center
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Main shaft: thin cylinder along Y axis -->
    <T.Mesh>
      <T.CylinderGeometry
        args={[baseRadius, baseRadius, effectiveLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Rounded cap at thumb end (+Y) -->
    <T.Mesh position={[0, halfLength, 0]}>
      <T.SphereGeometry args={[capRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Rounded cap at pinky end (-Y) -->
    <T.Mesh position={[0, -halfLength, 0]}>
      <T.SphereGeometry args={[capRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Center grip ring (white) -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh {position} layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
