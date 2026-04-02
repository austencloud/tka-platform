<script lang="ts">
  /**
   * Buugeng3D Component
   *
   * Renders a 3D buugeng (S-shaped curved staff) with:
   * - Center straight section at the grip point (~20% of total length)
   * - Upper arm angled ~30° from center, extending upward-right
   * - Lower arm mirrored at ~30°, extending downward-left
   * - Small sphere caps at each arm tip
   * - Center grip ring (torus, matching Staff3D/Club3D style)
   * - Trail indicator sphere for path visualization
   *
   * The S-curve is approximated with 3 cylinders. Overall length is ~90%
   * of staffLength since buugeng are slightly shorter than full staves.
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

  // Buugeng are ~90% of staff length
  const BUUGENG_LENGTH_RATIO = 0.9;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * BUUGENG_LENGTH_RATIO * scale
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

  // Arm thickness is 2x the base staff radius
  const armRadius = $derived(baseRadius * 2);

  // Center section: ~20% of total length, sits at the grip point
  const centerLength = $derived(effectiveLength * 0.2);

  // Each arm: remaining length split between upper and lower
  // Total arm extent = (effectiveLength - centerLength) / 2
  const armLength = $derived((effectiveLength - centerLength) / 2);

  // S-curve angle: each arm tilts ~30° from the center axis
  const ARM_ANGLE = Math.PI / 6; // 30 degrees

  // Arm offset from center: positioned so the arm base meets the center section ends
  const armOffsetY = $derived(
    centerLength / 2 + (armLength / 2) * Math.cos(ARM_ANGLE)
  );
  const armOffsetX = $derived((armLength / 2) * Math.sin(ARM_ANGLE));

  // Tip positions (end of each arm, for sphere caps)
  const tipOffsetY = $derived(
    centerLength / 2 + armLength * Math.cos(ARM_ANGLE)
  );
  const tipOffsetX = $derived(armLength * Math.sin(ARM_ANGLE));

  // Sphere cap radius at arm tips
  const tipCapRadius = $derived(armRadius * 1.2);

  // Grip ring at center
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Center straight section at grip point -->
    <T.Mesh>
      <T.CylinderGeometry
        args={[armRadius, armRadius, centerLength, 16, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Upper arm: angled 30° toward +X, extending in +Y direction -->
    <T.Mesh
      position={[armOffsetX, armOffsetY, 0]}
      rotation={[0, 0, -ARM_ANGLE]}
    >
      <T.CylinderGeometry args={[armRadius, armRadius, armLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Lower arm: mirrored, angled 30° toward -X, extending in -Y direction -->
    <T.Mesh
      position={[-armOffsetX, -armOffsetY, 0]}
      rotation={[0, 0, -ARM_ANGLE]}
    >
      <T.CylinderGeometry args={[armRadius, armRadius, armLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Upper arm tip cap -->
    <T.Mesh position={[tipOffsetX, tipOffsetY, 0]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Lower arm tip cap -->
    <T.Mesh position={[-tipOffsetX, -tipOffsetY, 0]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
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
