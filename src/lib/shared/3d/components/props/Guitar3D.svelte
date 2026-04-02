<script lang="ts">
  /**
   * Guitar3D Component
   *
   * Renders a 3D guitar-shaped prop:
   * - Neck: long thin cylinder (~60% of staffLength, radius ~staffRadius)
   * - Body: flattened ellipsoid at the pinky end (-Y), scaled x=1.5, y=0.3, z=1
   * - Headstock: small flat box at the thumb end (+Y)
   * - Grip at the neck center
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

  // Neck: ~60% of total length
  const neckLength = $derived(effectiveLength * 0.6);
  const neckRadius = $derived(baseRadius);
  const halfLength = $derived(effectiveLength / 2);

  // Body: flattened ellipsoid at the pinky end (-Y)
  // Base sphere radius is ~20% of staffLength, then scaled to flatten
  const bodyBaseRadius = $derived(effectiveLength * 0.2);
  // Position the body center at the bottom of the neck
  const bodyYOffset = $derived(-halfLength + bodyBaseRadius * 0.3);

  // Headstock: small flat box at thumb end (+Y)
  const headstockWidth = $derived(baseRadius * 3);
  const headstockHeight = $derived(effectiveLength * 0.08);
  const headstockDepth = $derived(baseRadius * 1.5);
  const headstockYOffset = $derived(halfLength);

  // Grip ring at center of the neck
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Neck: thin cylinder along Y axis -->
    <T.Mesh position={[0, halfLength - neckLength / 2, 0]}>
      <T.CylinderGeometry
        args={[neckRadius, neckRadius, neckLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Body: flattened ellipsoid at the pinky end (-Y) -->
    <!-- Scale x=1.5, y=0.3, z=1 to create a wide, flat guitar body shape -->
    <T.Mesh
      position={[0, bodyYOffset, 0]}
      scale={[1.5, 0.3, 1]}
    >
      <T.SphereGeometry args={[bodyBaseRadius, 24, 16]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Headstock: small flat box at thumb end (+Y) -->
    <T.Mesh position={[0, headstockYOffset, 0]}>
      <T.BoxGeometry
        args={[headstockWidth, headstockHeight, headstockDepth]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Center grip ring (white, at the hand point) -->
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
