<script lang="ts">
  /**
   * Fan3D Component
   *
   * Renders a 3D folding fan with:
   * - Semi-circular blade (CircleGeometry with thetaLength = PI)
   * - Double-sided material so the fan is visible from both sides
   * - Short cylindrical handle/grip at the pivot point
   * - Trail indicator sphere for path visualization
   *
   * The fan pivot is at the hand grip (origin of the group).
   * The blade extends upward (+Y) from the grip as a half-disc.
   *
   * Uses computeFlatPropRotation since fans are planar props,
   * not cylindrical like staves.
   */

  import { T } from "@threlte/core";
  import { DoubleSide } from "three";
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

  // Layer for first-person viewmodel system
  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  // Fan blade radius is ~60% of staff length
  const FAN_BLADE_RATIO = 0.6;

  const bladeRadius = $derived(
    (length ?? userProportionsState.staffLength) * FAN_BLADE_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  // Position uses the same shared transform
  const position = $derived.by(() =>
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );

  // Fans are flat/planar, so use the flat rotation (no 90-degree horizontal tilt)
  const rotation = $derived.by(() =>
    computeFlatPropRotation(propState, facingAngle)
  );

  // Handle dimensions: short cylinder below the blade pivot
  const handleLength = $derived(bladeRadius * 0.18);
  const handleRadius = $derived(baseRadius * 1.2);

  // The fan blade is a semi-circle (thetaLength = PI).
  // CircleGeometry args: [radius, segments, thetaStart, thetaLength]
  // thetaStart = -PI/2 centers the semi-circle so it extends upward (+Y)
  const bladeThetaStart = -Math.PI / 2;
  const bladeThetaLength = Math.PI;
  const bladeSegments = 32;

  // Blade thickness: thin cylinder for a slight 3D feel
  const bladeThickness = $derived(baseRadius * 0.15);

  // Grip ring at the pivot point (same style as Staff3D)
  const gripOuterRadius = $derived(baseRadius * 1.4);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Fan blade: semi-circular disc, double-sided so it's visible from both sides.
         The CircleGeometry lies in the XY plane by default. The blade extends
         upward from the origin (the grip/pivot point). -->
    <T.Mesh>
      <T.CircleGeometry
        args={[bladeRadius, bladeSegments, bladeThetaStart, bladeThetaLength]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.5}
        metalness={0.1}
        side={DoubleSide}
      />
    </T.Mesh>

    <!-- Blade edge rim: a slightly darker border along the curved edge.
         Uses a thin torus arc to outline the semi-circle. -->
    <T.Mesh>
      <T.TorusGeometry
        args={[
          bladeRadius,
          bladeThickness,
          8,
          bladeSegments,
          bladeThetaLength,
        ]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.4}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Handle: short cylinder extending downward (-Y) from the pivot -->
    <T.Mesh position={[0, -handleLength / 2, 0]}>
      <T.CylinderGeometry
        args={[handleRadius, handleRadius * 0.85, handleLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Handle end cap -->
    <T.Mesh position={[0, -handleLength, 0]}>
      <T.SphereGeometry args={[handleRadius * 0.85, 10, 10]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Grip ring at pivot point (white, at the hand position) -->
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
