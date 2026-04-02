<script lang="ts">
  /**
   * Eightrings3D Component
   *
   * Renders a 3D eightrings (figure-8) prop with:
   * - Two torus rings stacked vertically, forming a figure-8 shape
   * - Upper ring centered at +25% Y, lower ring at -25% Y
   * - Grip torus ring at the center where the two rings overlap
   * - Trail indicator sphere for path visualization
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

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const position = $derived.by(() =>
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );
  const rotation = $derived.by(() =>
    computePropRotation(propState, facingAngle)
  );

  // Each ring: radius ~25% of staffLength
  const ringRadius = $derived(effectiveLength * 0.25);
  const ringTubeRadius = $derived(baseRadius * 0.8);

  // Vertical offset: rings centered at ±25% of total length
  const ringOffset = $derived(effectiveLength * 0.25);

  // Grip ring at center overlap point (smaller, white)
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Upper ring (thumb end, +Y) -->
    <T.Mesh position={[0, ringOffset, 0]}>
      <T.TorusGeometry args={[ringRadius, ringTubeRadius, 16, 32]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Lower ring (pinky end, -Y) -->
    <T.Mesh position={[0, -ringOffset, 0]}>
      <T.TorusGeometry args={[ringRadius, ringTubeRadius, 16, 32]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Grip ring at center overlap -->
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
