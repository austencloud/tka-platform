<script lang="ts">
  /**
   * Guitar3D Component
   *
   * Renders a 3D guitar-shaped prop with:
   * - Flat-backed neck (BoxGeometry, slightly tapered toward headstock)
   * - Wider headstock at the thumb end (+Y)
   * - Figure-8 body using two scaled spheres (upper and lower bout)
   * - Dark sound hole circle on the body face
   * - Grip ring at the neck center (origin)
   * - Trail indicator sphere for path visualization
   *
   * The hand grips at roughly the neck center (origin).
   * Neck/headstock extend in +Y, body extends in -Y.
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

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const rotation = $derived(computePropRotation(propState));

  // === Neck: 55% of total length, flat-backed box ===
  const neckLength = $derived(effectiveLength * 0.55);
  const neckWidthBottom = $derived(baseRadius * 2.2); // wider near body
  const neckWidthTop = $derived(baseRadius * 1.6); // narrower near headstock
  const neckDepth = $derived(baseRadius * 1.2); // flat-backed
  // Neck extends upward from origin
  const neckCenterY = $derived(neckLength / 2);

  // === Headstock: wider flat piece at top of neck ===
  const headstockWidth = $derived(baseRadius * 3.5);
  const headstockHeight = $derived(effectiveLength * 0.08);
  const headstockDepth = $derived(baseRadius * 1.4);
  const headstockY = $derived(neckLength + headstockHeight / 2);

  // === Body: figure-8 using two scaled spheres ===
  const bodyRadius = $derived(effectiveLength * 0.15);

  // Upper bout: smaller sphere, positioned closer to neck
  const upperBoutY = $derived(-(effectiveLength * 0.15));
  const upperBoutScaleX = $derived(1.2);
  const upperBoutScaleY = $derived(0.25);
  const upperBoutScaleZ = $derived(0.8);

  // Lower bout: larger sphere, positioned further from neck
  const lowerBoutY = $derived(-(effectiveLength * 0.32));
  const lowerBoutScaleX = $derived(1.5);
  const lowerBoutScaleY = $derived(0.25);
  const lowerBoutScaleZ = $derived(1.0);

  // === Sound hole: dark circle on the body face ===
  const soundHoleRadius = $derived(bodyRadius * 0.35);
  const soundHoleY = $derived(-(effectiveLength * 0.24));
  // Offset slightly forward (+Z) so it sits on the body surface
  const soundHoleZ = $derived(bodyRadius * lowerBoutScaleZ * 0.95);

  // === Grip ring at origin ===
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);

  // Darker body color for the guitar wood
  const bodyColor = $derived(palette.dark);
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Neck: flat-backed box, slightly tapered -->
    <!-- Using average width since BoxGeometry doesn't taper natively -->
    <T.Mesh position={[0, neckCenterY, 0]}>
      <T.BoxGeometry
        args={[
          (neckWidthBottom + neckWidthTop) / 2,
          neckLength,
          neckDepth,
        ]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Fretboard face: slightly darker strip on the neck front -->
    <T.Mesh
      position={[0, neckCenterY, neckDepth / 2 + 0.001]}
    >
      <T.BoxGeometry
        args={[
          (neckWidthBottom + neckWidthTop) / 2 * 0.85,
          neckLength * 0.95,
          0.002,
        ]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.5}
        metalness={0.1}
      />
    </T.Mesh>

    <!-- Headstock: wider flat piece at the top -->
    <T.Mesh position={[0, headstockY, 0]}>
      <T.BoxGeometry
        args={[headstockWidth, headstockHeight, headstockDepth]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.4}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Upper bout: smaller sphere for the figure-8 top half -->
    <T.Mesh
      position={[0, upperBoutY, 0]}
      scale={[upperBoutScaleX, upperBoutScaleY, upperBoutScaleZ]}
    >
      <T.SphereGeometry args={[bodyRadius, 24, 16]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Lower bout: larger sphere for the figure-8 bottom half -->
    <T.Mesh
      position={[0, lowerBoutY, 0]}
      scale={[lowerBoutScaleX, lowerBoutScaleY, lowerBoutScaleZ]}
    >
      <T.SphereGeometry args={[bodyRadius, 24, 16]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Sound hole: dark circle on the body face -->
    <T.Mesh
      position={[0, soundHoleY, soundHoleZ]}
      rotation={[Math.PI / 2, 0, 0]}
    >
      <T.CircleGeometry args={[soundHoleRadius, 24]} />
      <T.MeshStandardMaterial
        color="#1a1008"
        roughness={0.9}
        metalness={0}
        side={2}
      />
    </T.Mesh>

    <!-- Center grip ring (white, at the hand point) -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
